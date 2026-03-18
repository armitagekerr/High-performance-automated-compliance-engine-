/**
 * rules/prior-consent.js — Prior Consent Rule Engine
 *
 * Implements the ePrivacy Directive / PECR prior-consent rules:
 * a cookie or tracking request that requires consent must NOT fire
 * before the user has explicitly accepted the cookie banner.
 *
 * Severity levels:
 *   CRITICAL — Identity sync / cross-domain tracking without consent
 *   HIGH     — Advertising / remarketing pixels without consent
 *   MEDIUM   — Analytics cookies without consent
 *   LOW      — Functional cookies without consent
 */

'use strict';

const { lookupCookie } = require('../canonical-table');

/**
 * @typedef {Object} NetworkRequest
 * @property {string} url
 * @property {string} method
 * @property {string} resource_type
 * @property {Object.<string, string>} headers
 */

/**
 * @typedef {Object} Violation
 * @property {string} rule        - Rule identifier
 * @property {string} severity    - CRITICAL | HIGH | MEDIUM | LOW
 * @property {string} url         - The offending request URL
 * @property {string} cookie      - Cookie name (if applicable)
 * @property {string} vendor      - Vendor name
 * @property {string} description - Human-readable description of the violation
 * @property {string} legalRef    - Legal reference (e.g. GDPR Article)
 */

const SEVERITY = {
  identity_sync: 'CRITICAL',
  advertising: 'HIGH',
  analytics: 'MEDIUM',
  functional: 'LOW',
};

const TRACKING_DOMAIN_MAP = {
  'google-analytics.com': { vendor: 'Google Analytics', category: 'analytics' },
  'analytics.google.com': { vendor: 'Google Analytics', category: 'analytics' },
  'doubleclick.net': { vendor: 'Google DoubleClick', category: 'advertising' },
  'googleadservices.com': { vendor: 'Google Ads', category: 'advertising' },
  'googlesyndication.com': { vendor: 'Google AdSense', category: 'advertising' },
  'connect.facebook.net': { vendor: 'Meta (Facebook)', category: 'advertising' },
  'facebook.com': { vendor: 'Meta (Facebook)', category: 'advertising' },
  'adyen.com': { vendor: 'Adyen', category: 'identity_sync' },
  'pay.google.com': { vendor: 'Google Pay', category: 'identity_sync' },
  'accounts.google.com': { vendor: 'Google Identity', category: 'identity_sync' },
};

/**
 * Evaluate a list of captured network requests for prior-consent violations.
 *
 * @param {NetworkRequest[]} requests - Captured requests from the browser.
 * @param {string[]}         consentCookiesPresent - Names of consent cookies
 *                           already set in the browser at the time of capture.
 *                           An empty array means no consent was given.
 * @returns {Violation[]} Array of detected violations.
 */
function evaluatePriorConsent(requests, consentCookiesPresent = []) {
  const consentGiven = consentCookiesPresent.length > 0;
  const violations = [];

  for (const req of requests) {
    if (consentGiven) continue; // Only flag if no consent was recorded

    const domain = _extractDomain(req.url);
    const domainInfo = _matchTrackingDomain(domain);

    if (!domainInfo) continue;

    violations.push({
      rule: 'PRIOR_CONSENT',
      severity: SEVERITY[domainInfo.category] || 'MEDIUM',
      url: req.url,
      cookie: null,
      vendor: domainInfo.vendor,
      description:
        `Request to ${domainInfo.vendor} (${domain}) fired before user consent was ` +
        `obtained. Category: ${domainInfo.category}.`,
      legalRef: 'ePrivacy Directive Art. 5(3) / PECR Reg. 6(1)',
    });
  }

  return violations;
}

/**
 * Evaluate cookies found in the browser against the consent state.
 *
 * @param {Array<{name: string, value: string, domain: string}>} cookies
 * @param {string[]} consentCookiesPresent
 * @returns {Violation[]}
 */
function evaluateCookieViolations(cookies, consentCookiesPresent = []) {
  const consentGiven = consentCookiesPresent.length > 0;
  const violations = [];

  for (const cookie of cookies) {
    if (consentGiven) continue;

    const def = lookupCookie(cookie.name);
    if (!def || !def.requiresConsent) continue;

    violations.push({
      rule: 'COOKIE_WITHOUT_CONSENT',
      severity: SEVERITY[def.category] || 'MEDIUM',
      url: null,
      cookie: cookie.name,
      vendor: def.vendor,
      description:
        `Cookie "${cookie.name}" (${def.vendor}) was set before consent. ` +
        `Purpose: ${def.description}`,
      legalRef: 'GDPR Art. 6(1)(a) / ePrivacy Directive Art. 5(3)',
    });
  }

  return violations;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function _extractDomain(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

function _matchTrackingDomain(hostname) {
  for (const [domain, info] of Object.entries(TRACKING_DOMAIN_MAP)) {
    if (hostname === domain || hostname.endsWith('.' + domain)) {
      return info;
    }
  }
  return null;
}

module.exports = { evaluatePriorConsent, evaluateCookieViolations };
