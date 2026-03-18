# Case Study: Adyen / Google Identity Sync Audit

**Audit type:** Automated prior-consent network interception  
**Pages audited:** Checkout  
**Severity:** CRITICAL  
**Legal framework:** ePrivacy Directive Art. 5(3), GDPR Art. 6(1)(a), PECR Reg. 6(1)

---

## Background

During a routine automated compliance audit of a major UK e-commerce platform's
checkout journey, the Compliance Sentinel engine detected a pattern of **Google
Identity Sync requests firing before any cookie consent was obtained**.

The trigger was the site's use of **Adyen** as its payment service provider (PSP).
Adyen's hosted payment fields are embedded on the checkout page as an iframe.
This iframe — loaded from `adyen.com` — itself loads a **Google Pay button**,
which in turn makes requests to `pay.google.com` and `accounts.google.com`.

These nested third-party requests occurred **without any user interaction**,
at the moment the checkout page loaded, before the cookie consent banner was even
rendered.

---

## What Was Detected

The automated Playwright scraper captured the following network activity on a
fresh browser session (zero cookies, no consent):

| # | URL (sanitised) | Cookie Set | Severity |
|---|-----------------|-----------|---------|
| 1 | `https://pay.google.com/gp/p/js/pay.js` | — | HIGH |
| 2 | `https://accounts.google.com/gen_204?...` | `NID` | CRITICAL |
| 3 | `https://googleads.g.doubleclick.net/pagead/...` | `IDE`, `DSID` | CRITICAL |
| 4 | `https://adyen.com/hpp/...` (SDK beacon) | — | HIGH |

The `NID` and `DSID` cookies are Google's **cross-domain identity synchronisation**
cookies. Their presence in a browser session allows Google to link the user's
on-site browsing behaviour to their Google account — even if the user never
explicitly signed in to Google on this site.

---

## How Google Identity Sync Works

```
User loads checkout page
        │
        ▼
Adyen PSP iframe loads
        │
        ▼
Google Pay button initialises (pay.google.com)
        │
        ▼
Google Pay makes a background request to accounts.google.com/gen_204
        │
        ▼
Google sets NID cookie on .google.com
        │
        ▼
Google's ad infrastructure reads NID → links browsing session to Google account
        │
        ▼
User added to remarketing audience WITHOUT consent
```

The user has not:
- Clicked "Accept" on the cookie banner
- Interacted with the Google Pay button
- Been shown a disclosure about identity synchronisation

---

## Legal Analysis

### ePrivacy Directive Art. 5(3) (EU) / PECR Reg. 6(1) (UK)

> "Member States shall ensure that the storing of information, or the gaining of
> access to information already stored, in the terminal equipment of a subscriber
> or user is only allowed on condition that the subscriber or user concerned has
> given his or her consent..."

The `NID` and `DSID` cookies are stored on the user's terminal equipment (their
browser). Neither is **strictly necessary** for the service explicitly requested
by the user (completing a purchase). Therefore, prior consent is required.

No consent was obtained before these cookies were set. **This is a direct
violation of Art. 5(3).**

### GDPR Art. 6(1)(a)

Where the cookies enable identification of a natural person (which `NID`/`DSID`
do, by design), any processing of that data requires a valid legal basis under
GDPR Art. 6(1). Consent (Art. 6(1)(a)) was not obtained. Legitimate interests
(Art. 6(1)(f)) cannot override the explicit consent requirement in Art. 5(3)
ePrivacy for non-essential cookies (EDPB Guidelines 05/2020, para. 55).

### Enforcement Precedent

| Authority | Case | Fine | Year |
|-----------|------|------|------|
| CNIL (France) | Google LLC — cookie consent failures | €150M | 2022 |
| CNIL (France) | Facebook — cookie consent failures | €60M | 2022 |
| Belgian DPA | IAB Europe TCF consent framework | €250,000 | 2022 |
| ICO (UK) | TikTok — children's data / cookie violations | £12.7M | 2023 |

The pattern detected here is substantively identical to the conduct cited in the
CNIL Google decision (SAN-2022-001).

---

## Remediation Recommendations

### Immediate (within 2 weeks)

1. **Block Adyen iframe initialisation** until the user has accepted the
   relevant cookie categories (at minimum: "Functional" or "Payment").
   Use your CMP's script-blocking / tag-blocking feature.

2. **Audit your Adyen integration** to determine whether the Google Pay
   button can be configured to defer initialisation until post-consent,
   or replaced with a server-side Google Pay flow.

### Short-term (within 4 weeks)

3. **Implement Google Consent Mode v2** across all Google tags.
   Set `ad_storage`, `analytics_storage`, and `ad_personalization` to
   `'denied'` by default until consent is granted.

4. **Add checkout to your automated audit schedule** with specific assertions
   for Google Identity Sync patterns (see `automation/scenarios/test_checkout.py`).

### Ongoing

5. **Run Compliance Sentinel on every deployment** using the GitHub Actions
   workflow (`.github/workflows/compliance-audit.yml`). Configure the CI
   gate to block deploys if CRITICAL violations are detected.

6. **Review your consent string** — ensure your IAB TCF consent string
   correctly reflects the vendor list and that Google's vendor ID (755) is
   not set to "consented" until the user explicitly accepts.

---

## Evidence Artefacts

All raw evidence (network request logs, cookie dumps, Allure test results)
is available as GitHub Actions artefacts attached to the audit workflow run.
The Allure HTML report provides an interactive timeline of requests captured
during the checkout page load.

See `dashboard/allure-report/` for a sample static report.

---

## References

- ePrivacy Directive 2002/58/EC, Article 5(3) as amended by 2009/136/EC
- UK Privacy and Electronic Communications Regulations 2003 (PECR), Regulation 6
- GDPR (EU) 2016/679, Articles 5, 6, 7
- EDPB Guidelines 05/2020 on consent (v1.1, May 2020)
- CNIL Decision SAN-2022-001 — Google LLC (January 2022)
- ICO Guidance on Cookies and Similar Technologies (updated May 2023)
- Adyen Google Pay Integration Documentation
