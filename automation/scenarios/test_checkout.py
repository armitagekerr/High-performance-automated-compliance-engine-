"""
scenarios/test_checkout.py — Checkout prior-consent audit.

Verifies that no third-party tracking requests are fired on the checkout
page before a user has given explicit consent. Checkout pages are high-risk
because payment providers (e.g. Adyen) and identity-sync pixels (e.g.
Google Pay) commonly fire pre-consent beacons containing PII.
"""

import allure
import pytest
import os

from automation.conftest import BASE_URL, assert_no_pre_consent_tracking
from automation.utils.network_baseline import classify_requests, summarise_violations

CHECKOUT_PATH: str = os.environ.get("CHECKOUT_PATH", "/checkout")


@allure.epic("GDPR / ePrivacy Compliance")
@allure.feature("Prior Consent Audit")
@allure.story("Checkout — Pre-consent network baseline")
class TestCheckoutPriorConsent:
    """Audit the checkout page for tracking requests fired before consent."""

    @allure.title("No tracking pixels fired on checkout load (pre-consent)")
    @allure.severity(allure.severity_level.CRITICAL)
    def test_no_tracking_on_checkout_load(self, audited_page):
        """
        GIVEN  a brand-new browser session (no cookies, no consent)
        WHEN   the checkout page is loaded
        THEN   no third-party tracking requests should be fired.
        """
        page, captured_requests = audited_page
        url = BASE_URL.rstrip("/") + CHECKOUT_PATH

        with allure.step(f"Navigate to checkout: {url}"):
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

    @allure.title("No Adyen / payment provider identity beacons on checkout (pre-consent)")
    @allure.severity(allure.severity_level.CRITICAL)
    def test_no_payment_identity_beacon_on_checkout(self, audited_page):
        """
        GIVEN  a brand-new browser session
        WHEN   the checkout page is loaded
        THEN   no pre-consent identity beacons from payment processors should fire.

        Adyen and Google Pay have been observed to set tracking cookies via
        iframed checkout components before the user accepts the cookie banner,
        constituting a violation of the ePrivacy Directive Reg. 6(1).
        """
        page, captured_requests = audited_page
        url = BASE_URL.rstrip("/") + CHECKOUT_PATH

        with allure.step(f"Navigate to checkout: {url}"):
            page.goto(url, wait_until="networkidle", timeout=30_000)

        with allure.step("Filter for payment provider identity beacons"):
            payment_domains = ["adyen.com", "pay.google.com", "paypal.com", "stripe.com"]
            violations = [
                req for req in captured_requests
                if any(d in req["url"] for d in payment_domains)
                and req.get("resource_type") not in ("stylesheet", "font", "image")
            ]
            if violations:
                allure.attach(
                    "\n".join(v["url"] for v in violations),
                    name="Payment provider beacon violations",
                    attachment_type=allure.attachment_type.TEXT,
                )

        with allure.step("Assert no payment identity beacons fired before consent"):
            assert not violations, (
                f"{len(violations)} payment provider identity beacon(s) fired on checkout "
                f"before consent — potential ePrivacy Directive violation."
            )

    @allure.title("No Google Identity Sync on checkout load (pre-consent)")
    @allure.severity(allure.severity_level.CRITICAL)
    def test_no_google_identity_sync_on_checkout(self, audited_page):
        """
        GIVEN  a brand-new browser session
        WHEN   the checkout page is loaded
        THEN   no Google Identity Sync calls (NID / DSID cookies set by Google)
               should be triggered.

        This specifically targets the Google Identity Sync mechanism where
        Google Pay's iframe sets NID/DSID cookies to cross-reference user
        identities across domains without prior consent.
        """
        page, captured_requests = audited_page
        url = BASE_URL.rstrip("/") + CHECKOUT_PATH

        with allure.step(f"Navigate to checkout: {url}"):
            page.goto(url, wait_until="networkidle", timeout=30_000)

        with allure.step("Check for Google Identity Sync indicators"):
            import re
            identity_sync_patterns = [
                re.compile(r"accounts\.google\.com", re.IGNORECASE),
                re.compile(r"google\.com/gen_204", re.IGNORECASE),
                re.compile(r"NID=", re.IGNORECASE),
                re.compile(r"DSID=", re.IGNORECASE),
                re.compile(r"googleads\.g\.doubleclick\.net", re.IGNORECASE),
            ]
            violations = [
                req for req in captured_requests
                if any(p.search(req["url"]) for p in identity_sync_patterns)
            ]
            if violations:
                allure.attach(
                    "\n".join(v["url"] for v in violations),
                    name="Google Identity Sync violations",
                    attachment_type=allure.attachment_type.TEXT,
                )

        with allure.step("Assert no Google Identity Sync occurred before consent"):
            assert not violations, (
                f"{len(violations)} Google Identity Sync call(s) detected on checkout "
                f"before consent — cross-domain identity leak without legal basis."
            )
