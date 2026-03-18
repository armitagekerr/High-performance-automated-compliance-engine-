"""
utils/network_baseline.py — Network baseline and request analysis helpers.

Provides utilities to distinguish between expected first-party requests
and unexpected third-party tracking calls that indicate a prior-consent
violation under GDPR/ePrivacy Directive.
"""

from __future__ import annotations

import re
from urllib.parse import urlparse


# ---------------------------------------------------------------------------
# Known third-party tracking / advertising domains
# ---------------------------------------------------------------------------
TRACKING_DOMAINS: list[str] = [
    "google-analytics.com",
    "analytics.google.com",
    "doubleclick.net",
    "googletagmanager.com",
    "googlesyndication.com",
    "facebook.com",
    "connect.facebook.net",
    "tr.snapchat.com",
    "sc-static.net",
    "tiktok.com",
    "analytics.tiktok.com",
    "bat.bing.com",
    "clarity.ms",
    "hotjar.com",
    "mouseflow.com",
    "fullstory.com",
    "segment.io",
    "segment.com",
    "cdn.segment.com",
    # Payment / identity beacons known to fire before consent
    "adyen.com",
    "pay.google.com",
    "googleadservices.com",
]

# Regex patterns for request URLs that indicate identity sync
IDENTITY_SYNC_PATTERNS: list[re.Pattern] = [
    re.compile(r"google.*gid=", re.IGNORECASE),
    re.compile(r"_ga=GA\d+\.\d+\.\d+", re.IGNORECASE),
    re.compile(r"fbclid=", re.IGNORECASE),
    re.compile(r"__utma=", re.IGNORECASE),
    re.compile(r"NID=", re.IGNORECASE),
    re.compile(r"DSID=", re.IGNORECASE),
    re.compile(r"/pagead/", re.IGNORECASE),
    re.compile(r"/collect\?", re.IGNORECASE),
    re.compile(r"/j/collect", re.IGNORECASE),
    re.compile(r"adservice\.google\.", re.IGNORECASE),
]


def is_tracking_request(request: dict) -> bool:
    """
    Return ``True`` if *request* appears to be a third-party tracking call.

    Checks:
    1. The request hostname matches a known tracking domain.
    2. The URL matches a known identity-sync pattern.

    Args:
        request: Dict with at least a ``"url"`` key.
    """
    url: str = request.get("url", "")
    try:
        hostname = urlparse(url).hostname or ""
    except ValueError:
        hostname = ""

    for domain in TRACKING_DOMAINS:
        if hostname == domain or hostname.endswith("." + domain):
            return True

    for pattern in IDENTITY_SYNC_PATTERNS:
        if pattern.search(url):
            return True

    return False


def classify_requests(
    requests: list[dict],
) -> dict[str, list[dict]]:
    """
    Separate a list of captured requests into two groups:

    - ``"tracking"``: Requests that match known tracking domains/patterns.
    - ``"first_party"``: Everything else.

    Args:
        requests: List of request dicts (each with at least a ``"url"`` key).

    Returns:
        Dict with keys ``"tracking"`` and ``"first_party"``.
    """
    tracking: list[dict] = []
    first_party: list[dict] = []

    for req in requests:
        if is_tracking_request(req):
            tracking.append(req)
        else:
            first_party.append(req)

    return {"tracking": tracking, "first_party": first_party}


def summarise_violations(tracking_requests: list[dict]) -> str:
    """
    Build a human-readable summary of tracking requests for test reports.

    Args:
        tracking_requests: List of request dicts classified as tracking.

    Returns:
        A formatted string listing each violating URL.
    """
    if not tracking_requests:
        return "No prior-consent violations detected."

    lines = [f"Prior-consent violations detected ({len(tracking_requests)} request(s)):"]
    for req in tracking_requests:
        lines.append(f"  [{req.get('method', 'GET')}] {req['url']}")
    return "\n".join(lines)
