/**
 * evaluator-engine.js — Main Compliance Evaluator Engine
 *
 * Reads raw Allure result JSON files produced by the Playwright scraper,
 * extracts captured network requests and cookies, runs them through the
 * rule engines, and outputs a structured violation report.
 *
 * Usage:
 *   node evaluator/evaluator-engine.js [--results-dir <path>] [--output <path>]
 *
 * Environment variables:
 *   ALLURE_RESULTS_DIR  — Path to the Allure results directory (default: dashboard/allure-results)
 *   LOG_LEVEL           — debug | info | warn | error (default: info)
 */

'use strict';

require('dotenv').config();

const fs = require('fs');
const path = require('path');

const { evaluatePriorConsent, evaluateCookieViolations } = require('./rules/prior-consent');
const { detectIdentitySync, detectIdentitySyncCookies } = require('./rules/identity-sync');
const { lookupCookie } = require('./canonical-table');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const RESULTS_DIR = process.env.ALLURE_RESULTS_DIR || 'dashboard/allure-results';
const OUTPUT_FILE = process.argv.includes('--output')
  ? process.argv[process.argv.indexOf('--output') + 1]
  : 'violation-report.json';
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

const SEVERITY_ORDER = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

const log = {
  debug: (...a) => LOG_LEVEL === 'debug' && console.debug('[DEBUG]', ...a),
  info: (...a) => ['debug', 'info'].includes(LOG_LEVEL) && console.info('[INFO]', ...a),
  warn: (...a) => ['debug', 'info', 'warn'].includes(LOG_LEVEL) && console.warn('[WARN]', ...a),
  error: (...a) => console.error('[ERROR]', ...a),
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  log.info('Compliance Evaluator Engine starting…');
  log.info(`Reading Allure results from: ${RESULTS_DIR}`);

  const resultsPath = path.resolve(RESULTS_DIR);
  if (!fs.existsSync(resultsPath)) {
    log.warn(`Results directory not found: ${resultsPath}. Generating empty report.`);
    writeReport({ violations: [], summary: buildSummary([]) });
    return;
  }

  const allureFiles = fs
    .readdirSync(resultsPath)
    .filter((f) => f.endsWith('-result.json'));

  log.info(`Found ${allureFiles.length} Allure result file(s).`);

  const allViolations = [];

  for (const file of allureFiles) {
    const filePath = path.join(resultsPath, file);
    let result;
    try {
      result = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (err) {
      log.warn(`Skipping malformed JSON: ${file} — ${err.message}`);
      continue;
    }

    const { requests, cookies, consentCookies } = extractEvidenceFromAllureResult(result);

    log.debug(`${file}: ${requests.length} requests, ${cookies.length} cookies`);

    // Run all rule engines
    const violations = [
      ...evaluatePriorConsent(requests, consentCookies),
      ...evaluateCookieViolations(cookies, consentCookies),
      ...detectIdentitySync(requests, consentCookies),
      ...detectIdentitySyncCookies(cookies, consentCookies),
    ];

    // Attach source file metadata
    violations.forEach((v) => {
      v.sourceFile = file;
      v.testName = result.name || 'Unknown test';
    });

    allViolations.push(...violations);
  }

  // Deduplicate and sort by severity
  const deduped = deduplicateViolations(allViolations);
  deduped.sort(
    (a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9),
  );

  const report = {
    generatedAt: new Date().toISOString(),
    violations: deduped,
    summary: buildSummary(deduped),
  };

  writeReport(report);

  // Exit with non-zero code if CRITICAL violations found (useful for CI gates)
  const hasCritical = deduped.some((v) => v.severity === 'CRITICAL');
  if (hasCritical) {
    log.error(`CRITICAL violations detected. Exiting with code 1.`);
    process.exit(1);
  }

  log.info('Evaluation complete. No critical violations.');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract network requests, cookies, and consent state from an Allure result.
 *
 * Allure stores test attachments as references; we look for text attachments
 * with known names produced by the Python scraper.
 *
 * @param {Object} result - Parsed Allure result JSON object.
 * @returns {{ requests: Object[], cookies: Object[], consentCookies: string[] }}
 */
function extractEvidenceFromAllureResult(result) {
  const requests = [];
  const cookies = [];
  const consentCookies = [];

  const attachments = collectAttachments(result);

  for (const att of attachments) {
    if (!att.source) continue;
    const attPath = path.join(path.resolve(RESULTS_DIR), att.source);
    if (!fs.existsSync(attPath)) continue;

    let content;
    try {
      content = fs.readFileSync(attPath, 'utf8');
    } catch {
      continue;
    }

    const nameLower = (att.name || '').toLowerCase();

    if (nameLower.includes('network request') || nameLower.includes('captured request')) {
      try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) requests.push(...parsed);
      } catch {
        // Text-format — each line is a URL
        content.split('\n').filter(Boolean).forEach((url) => requests.push({ url, method: 'GET' }));
      }
    }

    if (nameLower.includes('cookie')) {
      try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) cookies.push(...parsed);
      } catch {
        // Ignore
      }
    }

    if (nameLower.includes('consent')) {
      try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) consentCookies.push(...parsed);
      } catch {
        content.split('\n').filter(Boolean).forEach((c) => consentCookies.push(c.trim()));
      }
    }
  }

  return { requests, cookies, consentCookies };
}

/**
 * Recursively collect all attachments from an Allure result (including steps).
 */
function collectAttachments(node) {
  const atts = [...(node.attachments || [])];
  for (const step of node.steps || []) {
    atts.push(...collectAttachments(step));
  }
  return atts;
}

/**
 * Remove duplicate violations (same rule + url or cookie).
 */
function deduplicateViolations(violations) {
  const seen = new Set();
  return violations.filter((v) => {
    const key = `${v.rule}:${v.url || ''}:${v.cookie || ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Build a high-level summary object for the report.
 */
function buildSummary(violations) {
  const counts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  for (const v of violations) {
    counts[v.severity] = (counts[v.severity] || 0) + 1;
  }
  return {
    total: violations.length,
    bySeverity: counts,
    ruleBreakdown: violations.reduce((acc, v) => {
      acc[v.rule] = (acc[v.rule] || 0) + 1;
      return acc;
    }, {}),
  };
}

/**
 * Write the violation report to disk and log a summary.
 */
function writeReport(report) {
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(report, null, 2), 'utf8');
  log.info(`Report written to ${OUTPUT_FILE}`);
  log.info(
    `Summary: ${report.summary.total} violation(s) — ` +
      `CRITICAL: ${report.summary.bySeverity.CRITICAL}, ` +
      `HIGH: ${report.summary.bySeverity.HIGH}, ` +
      `MEDIUM: ${report.summary.bySeverity.MEDIUM}, ` +
      `LOW: ${report.summary.bySeverity.LOW}`,
  );
}

main().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(2);
});
