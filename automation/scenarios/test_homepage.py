"""
scenarios/test_homepage.py — Homepage prior-consent audit.

Verifies that no third-party tracking requests are fired when a first-time
visitor lands on the homepage before interacting with the cookie banner.
"""

import allure
import pytest

from automation.conftest import BASE_URL, assert_no_pre_consent_tracking
from automation.utils.network_baseline import classify_requests, summarise_violations


@allure.epic("GDPR / ePrivacy Compliance")
@allure.feature("Prior Consent Audit")
@allure.story("Homepage — Pre-consent network baseline")
class TestHomepagePriorConsent:
    """Audit the homepage for tracking requests fired before consent."""

    @allure.title("No tracking pixels fired on homepage load (pre-consent)")
    @allure.severity(allure.severity_level.CRITICAL)
    def test_no_tracking_on_homepage_load(self, audited_page):
        """
        GIVEN  a brand-new browser session (no cookies, no consent)
        WHEN   the homepage is loaded
        THEN   no third-party tracking / analytics requests should be fired.
        """
        page, captured_requests = audited_page

        with allure.step("Navigate to homepage"):
            page.goto(BASE_URL, wait_until="networkidle", timeout=30_000)
            allure.attach(
                page.url,
                name="Final URL",
                attachment_type=allure.attachment_type.TEXT,
            )

        with allure.step("Classify captured network requests"):
            classified = classify_requests(captured_requests)
            summary = summarise_violations(classified["tracking"])
            allure.attach(
                summary,
                name="Network request summary",
                attachment_type=allure.attachment_type.TEXT,
            )

        with allure.step("Assert no pre-consent tracking requests were fired"):
            assert_no_pre_consent_tracking(captured_requests)

    @allure.title("Cookie banner is present on homepage load")
    @allure.severity(allure.severity_level.NORMAL)
    def test_cookie_banner_present(self, audited_page):
        """
        GIVEN  a brand-new browser session
        WHEN   the homepage is loaded
        THEN   a cookie consent banner / notice should be visible.
        """
        page, _ = audited_page

        with allure.step("Navigate to homepage"):
            page.goto(BASE_URL, wait_until="domcontentloaded", timeout=30_000)

        with allure.step("Check for consent banner element"):
            # Common selectors used by consent management platforms
            banner_selectors = [
                "[id*='cookie']",
                "[id*='consent']",
                "[class*='cookie']",
                "[class*='consent']",
                "[aria-label*='cookie']",
                "[aria-label*='consent']",
                "#onetrust-banner-sdk",
                ".optanon-alert-box-wrapper",
            ]
            banner_found = any(
                page.locator(sel).count() > 0 for sel in banner_selectors
            )
            allure.attach(
                str(banner_found),
                name="Cookie banner detected",
                attachment_type=allure.attachment_type.TEXT,
            )
            assert banner_found, (
                "No cookie consent banner detected on homepage. "
                "A compliant site must inform users before setting non-essential cookies."
            )
