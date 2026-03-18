"""
conftest.py — Global test fixtures for the Compliance Sentinel Platform.

Provides shared Playwright browser context, network interception helpers,
and Allure metadata decorators used across all scenario tests.
"""

import pytest
import allure
import os

from playwright.sync_api import sync_playwright, BrowserContext, Page


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

BASE_URL: str = os.environ.get("AUDIT_BASE_URL", "https://example.com")

CONSENT_COOKIE_NAMES: list[str] = [
    "cookieconsent_status",
    "OptanonConsent",
    "OptanonAlertBoxClosed",
    "CookieConsent",
    "gdpr_consent",
    "euconsent-v2",
]

KNOWN_TRACKING_DOMAINS: list[str] = [
    "google-analytics.com",
    "analytics.google.com",
    "doubleclick.net",
    "googletagmanager.com",
    "facebook.com",
    "connect.facebook.net",
    "adyen.com",
    "pay.google.com",
]


# ---------------------------------------------------------------------------
# Session-scoped browser fixture (one browser per pytest session)
# ---------------------------------------------------------------------------


@pytest.fixture(scope="session")
def browser_instance():
    """Launch a Chromium browser for the entire test session."""
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-dev-shm-usage"],
        )
        yield browser
        browser.close()


# ---------------------------------------------------------------------------
# Function-scoped context fixture (fresh context per test — no shared state)
# ---------------------------------------------------------------------------


@pytest.fixture
def pristine_context(browser_instance) -> BrowserContext:
    """
    Return a brand-new browser context with:
    - All cookies cleared (simulates a first-time visitor)
    - JavaScript enabled
    - No saved storage state

    This ensures we measure what happens *before* any consent is given.
    """
    context: BrowserContext = browser_instance.new_context(
        ignore_https_errors=True,
        java_script_enabled=True,
        # Simulate a realistic desktop viewport
        viewport={"width": 1280, "height": 800},
        user_agent=(
            "Mozilla/5.0 (X11; Linux x86_64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/124.0.0.0 Safari/537.36 ComplianceSentinel/1.0"
        ),
    )
    yield context
    context.close()


# ---------------------------------------------------------------------------
# Function-scoped page fixture with network capture
# ---------------------------------------------------------------------------


@pytest.fixture
def audited_page(pristine_context: BrowserContext) -> tuple[Page, list[dict]]:
    """
    Open a new page and intercept all outgoing network requests.

    Returns:
        (page, captured_requests) — the Playwright Page and a list of
        captured request dicts keyed by url, method, resource_type, headers.
    """
    captured_requests: list[dict] = []

    page: Page = pristine_context.new_page()

    def _on_request(request) -> None:
        captured_requests.append(
            {
                "url": request.url,
                "method": request.method,
                "resource_type": request.resource_type,
                "headers": dict(request.headers),
            }
        )

    page.on("request", _on_request)
    yield page, captured_requests
    page.close()


# ---------------------------------------------------------------------------
# Helper: assert no pre-consent tracking calls were made
# ---------------------------------------------------------------------------


def assert_no_pre_consent_tracking(
    captured_requests: list[dict],
    consent_cookies: list[str] | None = None,
) -> list[dict]:
    """
    Examine captured_requests and raise an AssertionError if any request
    to a known tracking domain was fired before consent was recorded.

    Returns the list of violating requests so tests can attach them to
    Allure as evidence.
    """
    violations: list[dict] = []
    for req in captured_requests:
        for domain in KNOWN_TRACKING_DOMAINS:
            if domain in req["url"]:
                violations.append(req)
                break

    if violations:
        urls = "\n".join(v["url"] for v in violations)
        allure.attach(
            urls,
            name="Pre-consent tracking requests",
            attachment_type=allure.attachment_type.TEXT,
        )
        pytest.fail(
            f"Prior consent violation — {len(violations)} tracking request(s) "
            f"fired before consent was obtained:\n{urls}"
        )

    return violations
