/**
 * canonical-table.js — The "Master Override" Cookie Dictionary
 *
 * This module exports the canonical list of known cookies grouped by:
 *   - category: the purpose/legal basis required before setting the cookie
 *   - vendor: the third-party vendor that sets it
 *   - lawfulBasis: GDPR lawful basis under which the cookie MAY be set
 *
 * The evaluator engine uses this table to classify cookies found in
 * captured network traffic and decide whether they were set lawfully.
 *
 * Sources:
 *   - IAB Europe TCF v2.2 vendor list
 *   - OneTrust / Cookiebot canonical cookie databases
 *   - ICO guidance on cookies and similar technologies (2023)
 */

'use strict';

/**
 * @typedef {Object} CookieDefinition
 * @property {string}   name         - Cookie name or regex pattern (string)
 * @property {string}   vendor       - Vendor / owner name
 * @property {string}   category     - 'strictly_necessary' | 'functional' | 'analytics' | 'advertising' | 'identity_sync'
 * @property {string}   lawfulBasis  - 'legitimate_interest' | 'consent' | 'contract' | 'legal_obligation'
 * @property {string}   description  - Human-readable purpose description
 * @property {boolean}  requiresConsent - Whether prior consent is required under ePrivacy
 */

/** @type {CookieDefinition[]} */
const CANONICAL_COOKIE_TABLE = [
  // -------------------------------------------------------------------------
  // Strictly Necessary — no consent required
  // -------------------------------------------------------------------------
  {
    name: 'JSESSIONID',
    vendor: 'Site owner',
    category: 'strictly_necessary',
    lawfulBasis: 'contract',
    description: 'Java EE session identifier — required for the site to function.',
    requiresConsent: false,
  },
  {
    name: 'PHPSESSID',
    vendor: 'Site owner',
    category: 'strictly_necessary',
    lawfulBasis: 'contract',
    description: 'PHP session identifier — required for the site to function.',
    requiresConsent: false,
  },
  {
    name: '__Host-csrf',
    vendor: 'Site owner',
    category: 'strictly_necessary',
    lawfulBasis: 'legal_obligation',
    description: 'CSRF protection token.',
    requiresConsent: false,
  },

  // -------------------------------------------------------------------------
  // Analytics — consent required
  // -------------------------------------------------------------------------
  {
    name: '_ga',
    vendor: 'Google Analytics',
    category: 'analytics',
    lawfulBasis: 'consent',
    description: 'Google Analytics — distinguishes users. Persists for 2 years.',
    requiresConsent: true,
  },
  {
    name: '_gid',
    vendor: 'Google Analytics',
    category: 'analytics',
    lawfulBasis: 'consent',
    description: 'Google Analytics — distinguishes users. Persists for 24 hours.',
    requiresConsent: true,
  },
  {
    name: '_gat',
    vendor: 'Google Analytics',
    category: 'analytics',
    lawfulBasis: 'consent',
    description: 'Google Analytics — throttles request rate. Persists for 1 minute.',
    requiresConsent: true,
  },
  {
    name: '_gat_UA-*',
    vendor: 'Google Analytics (Universal)',
    category: 'analytics',
    lawfulBasis: 'consent',
    description: 'Google Universal Analytics — property-specific throttle cookie.',
    requiresConsent: true,
  },
  {
    name: '_hjid',
    vendor: 'Hotjar',
    category: 'analytics',
    lawfulBasis: 'consent',
    description: 'Hotjar — unique visitor identifier. Persists for 365 days.',
    requiresConsent: true,
  },
  {
    name: '_hjFirstSeen',
    vendor: 'Hotjar',
    category: 'analytics',
    lawfulBasis: 'consent',
    description: 'Hotjar — identifies new visitors.',
    requiresConsent: true,
  },

  // -------------------------------------------------------------------------
  // Advertising — consent required
  // -------------------------------------------------------------------------
  {
    name: 'IDE',
    vendor: 'Google DoubleClick',
    category: 'advertising',
    lawfulBasis: 'consent',
    description: 'DoubleClick — used for targeted advertising. Persists for 1 year.',
    requiresConsent: true,
  },
  {
    name: 'test_cookie',
    vendor: 'Google DoubleClick',
    category: 'advertising',
    lawfulBasis: 'consent',
    description: 'DoubleClick — checks if cookies are enabled.',
    requiresConsent: true,
  },
  {
    name: '_fbp',
    vendor: 'Meta (Facebook)',
    category: 'advertising',
    lawfulBasis: 'consent',
    description: 'Meta Pixel — tracks visits across sites for ad targeting.',
    requiresConsent: true,
  },
  {
    name: 'fr',
    vendor: 'Meta (Facebook)',
    category: 'advertising',
    lawfulBasis: 'consent',
    description: 'Meta — used for targeted advertising. Persists for 3 months.',
    requiresConsent: true,
  },
  {
    name: 'MUID',
    vendor: 'Microsoft Bing Ads',
    category: 'advertising',
    lawfulBasis: 'consent',
    description: 'Bing — unique user identifier for ad tracking. Persists for 1 year.',
    requiresConsent: true,
  },

  // -------------------------------------------------------------------------
  // Identity Sync — consent required (highest severity)
  // -------------------------------------------------------------------------
  {
    name: 'NID',
    vendor: 'Google',
    category: 'identity_sync',
    lawfulBasis: 'consent',
    description:
      'Google — stores preferences and uniquely identifies user for Google services. ' +
      'Set by Google Pay iframe on checkout pages; used for cross-domain identity sync.',
    requiresConsent: true,
  },
  {
    name: 'DSID',
    vendor: 'Google DoubleClick',
    category: 'identity_sync',
    lawfulBasis: 'consent',
    description:
      'DoubleClick — links a user\'s Google account identity to ad activity across sites. ' +
      'A key indicator of Google Identity Sync leaks.',
    requiresConsent: true,
  },
  {
    name: '1P_JAR',
    vendor: 'Google',
    category: 'identity_sync',
    lawfulBasis: 'consent',
    description: 'Google — collects site statistics and tracks conversion rates.',
    requiresConsent: true,
  },
  {
    name: 'CONSENT',
    vendor: 'Google',
    category: 'identity_sync',
    lawfulBasis: 'consent',
    description:
      'Google — records the user\'s consent state for Google services. ' +
      'When observed on non-Google sites this is a sign of cross-domain identity leakage.',
    requiresConsent: true,
  },

  // -------------------------------------------------------------------------
  // Consent Management Platforms — strictly necessary
  // -------------------------------------------------------------------------
  {
    name: 'OptanonConsent',
    vendor: 'OneTrust',
    category: 'strictly_necessary',
    lawfulBasis: 'legal_obligation',
    description: 'OneTrust — records the user\'s cookie consent choices.',
    requiresConsent: false,
  },
  {
    name: 'OptanonAlertBoxClosed',
    vendor: 'OneTrust',
    category: 'strictly_necessary',
    lawfulBasis: 'legal_obligation',
    description: 'OneTrust — records that the consent banner has been dismissed.',
    requiresConsent: false,
  },
  {
    name: 'CookieConsent',
    vendor: 'Cookiebot',
    category: 'strictly_necessary',
    lawfulBasis: 'legal_obligation',
    description: 'Cookiebot — records the user\'s cookie consent state.',
    requiresConsent: false,
  },
  {
    name: 'euconsent-v2',
    vendor: 'IAB TCF',
    category: 'strictly_necessary',
    lawfulBasis: 'legal_obligation',
    description: 'IAB TCF v2 — stores the encoded consent string.',
    requiresConsent: false,
  },
];

/**
 * Look up a cookie by its name and return its canonical definition.
 *
 * Supports both exact name matches and simple wildcard patterns (suffix `*`).
 *
 * @param {string} cookieName - The name of the cookie to look up.
 * @returns {CookieDefinition|null} The matching definition, or null if unknown.
 */
function lookupCookie(cookieName) {
  for (const def of CANONICAL_COOKIE_TABLE) {
    if (def.name === cookieName) return def;
    // Support simple wildcard suffix patterns like '_gat_UA-*'
    if (def.name.endsWith('*')) {
      const prefix = def.name.slice(0, -1);
      if (cookieName.startsWith(prefix)) return def;
    }
  }
  return null;
}

/**
 * Return all cookies that require prior consent.
 *
 * @returns {CookieDefinition[]}
 */
function getConsentRequiredCookies() {
  return CANONICAL_COOKIE_TABLE.filter((c) => c.requiresConsent);
}

module.exports = { CANONICAL_COOKIE_TABLE, lookupCookie, getConsentRequiredCookies };
