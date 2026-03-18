/**
 * rules/identity-sync.js — Google Identity Sync Rule Engine
 *
 * Detects the specific pattern where Google Pay (or other Google services)
 * embedded as iframes on checkout/PDP pages set NID/DSID/CONSENT cookies,
 * thereby linking a visitor's on-site identity to their Google account
 * WITHOUT prior consent.
 *
 * This is the "Adyen + Google Identity Sync" leak pattern documented in
 * docs/adyen-leak-audit.md.
 *
 * Severity: CRITICAL — Cross-domain identity leakage constitutes a
 *           potential violation of GDPR Art. 5(1)(f) (data integrity &
 *           confidentiality) and Art. 6 (lawfulness of processing).
 */

'use strict';

/** @typedef {import('./prior-consent').Violation} Violation */

const GOOGLE_IDENTITY_SYNC_COOKIES = ['NID', 'DSID', '1P_JAR', 'CONSENT', 'ANID', 'AID', 'TAID'];

const GOOGLE_IDENTITY_SYNC_DOMAINS = [
  'accounts.google.com',
  'pay.google.com',
  'google.com',
  'googleads.g.doubleclick.net',
  'adservice.google.com',
];

const GOOGLE_IDENTITY_SYNC_PATH_PATTERNS = [
  /\/gen_204/i,
  /\/pagead\//i,
  /\/pcs\/activeview/i,
  /\/sodar\//i,
  /\/recaptcha\//i,
];

/**
 * Detect Google Identity Sync requests in captured network traffic.
 *
 * @param {import('./prior-consent').NetworkRequest[]} requests
 * @param {string[]} consentCookiesPresent - Consent cookie names already set.
 * @returns {Violation[]}
 */
function detectIdentitySync(requests, consentCookiesPresent = []) {
  const consentGiven = consentCookiesPresent.length > 0;
  const violations = [];

  for (const req of requests) {
    if (consentGiven) continue;

    let hostname = '';
    let pathname = '';
    try {
      const parsed = new URL(req.url);
      hostname = parsed.hostname;
      pathname = parsed.pathname;
    } catch {
      continue;
    }

    const isDomain = GOOGLE_IDENTITY_SYNC_DOMAINS.some(
      (d) => hostname === d || hostname.endsWith('.' + d),
    );
    const isPath = GOOGLE_IDENTITY_SYNC_PATH_PATTERNS.some((p) => p.test(pathname));

    if (isDomain || isPath) {
      violations.push({
        rule: 'IDENTITY_SYNC',
        severity: 'CRITICAL',
        url: req.url,
        cookie: null,
        vendor: 'Google',
        description:
          `Google Identity Sync request detected at ${hostname}${pathname} before ` +
          `user consent. This request may link the visitor's browsing session to ` +
          `their Google account identity across domains.`,
        legalRef:
          'GDPR Art. 5(1)(f), Art. 6(1)(a); ePrivacy Directive Art. 5(3); ' +
          'ICO Guidance on Cookies (2023)',
      });
    }
  }

  return violations;
}

/**
 * Detect Google Identity Sync cookies set without consent.
 *
 * @param {Array<{name: string, value: string, domain: string}>} cookies
 * @param {string[]} consentCookiesPresent
 * @returns {Violation[]}
 */
function detectIdentitySyncCookies(cookies, consentCookiesPresent = []) {
  const consentGiven = consentCookiesPresent.length > 0;
  const violations = [];

  for (const cookie of cookies) {
    if (consentGiven) continue;

    if (GOOGLE_IDENTITY_SYNC_COOKIES.includes(cookie.name)) {
      violations.push({
        rule: 'IDENTITY_SYNC_COOKIE',
        severity: 'CRITICAL',
        url: null,
        cookie: cookie.name,
        vendor: 'Google',
        description:
          `Google Identity Sync cookie "${cookie.name}" was set on domain ` +
          `"${cookie.domain}" before user consent. This cookie is used to link ` +
          `the user's on-site identity to their Google account.`,
        legalRef:
          'GDPR Art. 5(1)(f), Art. 6(1)(a); ePrivacy Directive Art. 5(3)',
      });
    }
  }

  return violations;
}

module.exports = { detectIdentitySync, detectIdentitySyncCookies, GOOGLE_IDENTITY_SYNC_COOKIES };
