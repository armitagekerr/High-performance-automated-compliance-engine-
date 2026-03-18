"""
scenarios/test_pdp.py — Product Detail Page (PDP) prior-consent audit.

Verifies that no third-party tracking requests are fired when a first-time
visitor lands on a product page before interacting with the cookie banner.
Particular attention is paid to advertising pixels (Meta, Google Ads)
that commonly fire on PDP page-view events.
"""

import allure
import pytest

from automation.conftest import BASE_URL, assert_no_pre_consent_tracking
from automation.utils.network_baseline import classify_requests, summarise_violations

# Path appended to BASE_URL to reach a representative product page.
# Override via the PDP_PATH environment variable in CI if needed.
import os

PDP_PATH: str = os.environ.get("PDP_PATH", "/products/sample-product")


@allure.epic("GDPR / ePrivacy Compliance")
@allure.feature("Prior Consent Audit")
@allure.story("Product Detail Page — Pre-consent network baseline")
class TestPDPPriorConsent:
    """Audit the PDP for tracking requests fired before consent."""

    @allure.title("No tracking pixels fired on PDP load (pre-consent)")
    @allure.severity(allure.severity_level.CRITICAL)
    def test_no_tracking_on_pdp_load(self, audited_page):
        """
        GIVEN  a brand-new browser session (no cookies, no consent)
        WHEN   a product detail page is loaded
        THEN   no third-party tracking / advertising requests should be fired.
        """
        page, captured_requests = audited_page
        url = BASE_URL.rstrip("/") + PDP_PATH

        with allure.step(f"Navigate to PDP: {url}"):
            page.goto(url, wait_until="networkidle", timeout=30_000)
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

    @allure.title("No Google Ads / DoubleClick beacons on PDP load (pre-consent)")
    @allure.severity(allure.severity_level.CRITICAL)
    def test_no_google_ads_beacon_on_pdp(self, audited_page):
        """
        GIVEN  a brand-new browser session
        WHEN   a product detail page is loaded
        THEN   no requests to doubleclick.net or googleadservices.com should fire.

        These beacons are used for remarketing lists and are strictly non-essential.
        """
        page, captured_requests = audited_page
        url = BASE_URL.rstrip("/") + PDP_PATH

        with allure.step(f"Navigate to PDP: {url}"):
            page.goto(url, wait_until="networkidle", timeout=30_000)

        with allure.step("Filter for Google Ads / DoubleClick requests"):
            ads_domains = ["doubleclick.net", "googleadservices.com", "googlesyndication.com"]
            violations = [
                req for req in captured_requests
                if any(d in req["url"] for d in ads_domains)
            ]
            if violations:
                allure.attach(
                    "\n".join(v["url"] for v in violations),
                    name="Google Ads violations",
                    attachment_type=allure.attachment_type.TEXT,
                )

        with allure.step("Assert no Google Ads beacons fired before consent"):
            assert not violations, (
                f"{len(violations)} Google Ads / DoubleClick beacon(s) fired on PDP "
                f"before consent was obtained — potential GDPR Article 5(1)(a) violation."
            )
