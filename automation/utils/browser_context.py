"""
utils/browser_context.py — Browser context factory helpers.

Provides utility functions to create Playwright browser contexts
configured for compliance auditing (clean-slate, with network capture).
"""

from __future__ import annotations

import os
from typing import Callable

from playwright.sync_api import Browser, BrowserContext, Page


# ---------------------------------------------------------------------------
# Default user-agent mimicking a real Chrome browser with audit tag
# ---------------------------------------------------------------------------
_DEFAULT_UA = (
    "Mozilla/5.0 (X11; Linux x86_64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36 ComplianceSentinel/1.0"
)


def create_pristine_context(
    browser: Browser,
    *,
    viewport: dict | None = None,
    user_agent: str = _DEFAULT_UA,
    locale: str = "en-GB",
    timezone_id: str = "Europe/London",
) -> BrowserContext:
    """
    Create a fresh BrowserContext that simulates a first-time visitor:

    - No cookies, no local/session storage
    - JavaScript enabled
    - Realistic viewport and locale (UK by default for GDPR relevance)

    Args:
        browser: A running Playwright Browser instance.
        viewport: Dict with ``width`` and ``height`` keys. Defaults to 1280×800.
        user_agent: Override the User-Agent string.
        locale: Browser locale (affects Accept-Language header).
        timezone_id: IANA timezone identifier.

    Returns:
        A configured BrowserContext ready for compliance auditing.
    """
    if viewport is None:
        viewport = {"width": 1280, "height": 800}

    return browser.new_context(
        ignore_https_errors=True,
        java_script_enabled=True,
        viewport=viewport,
        user_agent=user_agent,
        locale=locale,
        timezone_id=timezone_id,
    )


def attach_network_capture(
    page: Page,
    captured: list[dict],
    *,
    filter_fn: Callable[[dict], bool] | None = None,
) -> None:
    """
    Register a ``request`` listener on *page* that appends each outgoing
    request to the *captured* list.

    Args:
        page: The Playwright Page to monitor.
        captured: A mutable list to which captured request dicts are appended.
        filter_fn: Optional predicate — only requests for which
                   ``filter_fn(request_dict)`` returns ``True`` are captured.
                   Defaults to capturing all requests.
    """

    def _on_request(request) -> None:
        entry = {
            "url": request.url,
            "method": request.method,
            "resource_type": request.resource_type,
            "headers": dict(request.headers),
        }
        if filter_fn is None or filter_fn(entry):
            captured.append(entry)

    page.on("request", _on_request)


def get_page_cookies(page: Page) -> dict[str, str]:
    """
    Return all cookies currently set on *page* as a plain ``{name: value}``
    dictionary for easy inspection.
    """
    context = page.context
    cookies = context.cookies()
    return {c["name"]: c["value"] for c in cookies}
