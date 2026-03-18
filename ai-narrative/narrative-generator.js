/**
 * narrative-generator.js — AI Narrative Generator
 *
 * Reads the structured violation report produced by the evaluator engine
 * and sends it to an LLM (OpenAI GPT) to generate a human-readable
 * legal-risk narrative suitable for a compliance officer or legal team.
 *
 * Usage:
 *   node ai-narrative/narrative-generator.js [--input <path>] [--output <path>]
 *
 * Environment variables:
 *   OPENAI_API_KEY  — Required: your OpenAI API key
 *   LOG_LEVEL       — debug | info | warn | error
 */

'use strict';

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { OpenAI } = require('openai');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const INPUT_FILE = process.argv.includes('--input')
  ? process.argv[process.argv.indexOf('--input') + 1]
  : 'violation-report.json';

const OUTPUT_FILE = process.argv.includes('--output')
  ? process.argv[process.argv.indexOf('--output') + 1]
  : 'narrative-report.md';

const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

const log = {
  info: (...a) => ['debug', 'info'].includes(LOG_LEVEL) && console.info('[INFO]', ...a),
  warn: (...a) => console.warn('[WARN]', ...a),
  error: (...a) => console.error('[ERROR]', ...a),
};

// ---------------------------------------------------------------------------
// Prompt template
// ---------------------------------------------------------------------------

/**
 * Build the system prompt for the LLM.
 * The prompt instructs the model to act as a GDPR compliance expert
 * and translate the structured violation data into a legal-risk narrative.
 */
function buildSystemPrompt() {
  return `You are a senior GDPR and ePrivacy compliance expert with deep knowledge of:
- The General Data Protection Regulation (GDPR) 2016/679
- The ePrivacy Directive 2002/58/EC (as amended by 2009/136/EC)
- The UK Privacy and Electronic Communications Regulations (PECR)
- ICO enforcement guidance and decisions
- DPA enforcement actions across the EU

Your task is to analyse automated compliance audit findings and produce a clear,
actionable legal-risk narrative for a Data Protection Officer (DPO) or legal team.

Your report should:
1. Summarise the overall compliance posture in plain English
2. Identify the most serious violations and their specific legal basis
3. Explain the real-world risk and potential regulatory consequences
4. Provide prioritised remediation recommendations
5. Reference specific legal articles (e.g. GDPR Art. 6(1)(a), ePrivacy Art. 5(3))

Use markdown formatting. Be concise but precise. Do not include disclaimers.`;
}

/**
 * Build the user prompt containing the structured violation data.
 *
 * @param {Object} report - The parsed violation report JSON.
 * @returns {string}
 */
function buildUserPrompt(report) {
  const { summary, violations, generatedAt } = report;

  const violationLines = violations
    .slice(0, 30) // Limit to 30 violations to stay within token budget
    .map(
      (v, i) =>
        `${i + 1}. [${v.severity}] ${v.rule}\n` +
        `   Vendor: ${v.vendor}\n` +
        `   ${v.url ? `URL: ${v.url}` : `Cookie: ${v.cookie}`}\n` +
        `   Description: ${v.description}\n` +
        `   Legal ref: ${v.legalRef}\n` +
        `   Test: ${v.testName || 'N/A'}`,
    )
    .join('\n\n');

  return `Audit generated: ${generatedAt}

SUMMARY
=======
Total violations: ${summary.total}
By severity:
  - CRITICAL: ${summary.bySeverity.CRITICAL}
  - HIGH:     ${summary.bySeverity.HIGH}
  - MEDIUM:   ${summary.bySeverity.MEDIUM}
  - LOW:      ${summary.bySeverity.LOW}

Rule breakdown:
${Object.entries(summary.ruleBreakdown)
  .map(([rule, count]) => `  - ${rule}: ${count}`)
  .join('\n')}

DETAILED VIOLATIONS
===================
${violationLines || 'No violations detected.'}

Please produce a professional compliance narrative report based on these findings.`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  log.info('AI Narrative Generator starting…');

  if (!process.env.OPENAI_API_KEY) {
    log.warn('OPENAI_API_KEY not set. Generating placeholder narrative.');
    writePlaceholderNarrative();
    return;
  }

  const inputPath = path.resolve(INPUT_FILE);
  if (!fs.existsSync(inputPath)) {
    log.warn(`Violation report not found: ${inputPath}. Generating placeholder narrative.`);
    writePlaceholderNarrative();
    return;
  }

  let report;
  try {
    report = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  } catch (err) {
    log.error(`Failed to parse violation report: ${err.message}`);
    process.exit(1);
  }

  log.info(`Loaded violation report: ${report.summary.total} violation(s).`);

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  log.info('Sending to OpenAI for narrative generation…');

  let narrative;
  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: buildSystemPrompt() },
        { role: 'user', content: buildUserPrompt(report) },
      ],
      max_tokens: 2000,
      temperature: 0.3, // Low temperature for factual, consistent output
    });

    narrative = response.choices[0]?.message?.content || '';
  } catch (err) {
    log.error(`OpenAI API error: ${err.message}`);
    writePlaceholderNarrative();
    return;
  }

  const output = `# Compliance Sentinel — AI Narrative Report\n\n` +
    `> Generated: ${new Date().toISOString()}\n\n` +
    narrative;

  fs.writeFileSync(path.resolve(OUTPUT_FILE), output, 'utf8');
  log.info(`Narrative report written to ${OUTPUT_FILE}`);
}

function writePlaceholderNarrative() {
  const placeholder = `# Compliance Sentinel — AI Narrative Report

> Generated: ${new Date().toISOString()}
> **Note:** This is a placeholder report. Set \`OPENAI_API_KEY\` to generate a full AI narrative.

## Summary

The automated compliance audit has completed. To generate a detailed legal-risk narrative,
configure the \`OPENAI_API_KEY\` environment variable and re-run:

\`\`\`bash
node ai-narrative/narrative-generator.js
\`\`\`

Review \`violation-report.json\` for the full structured findings.
`;
  fs.writeFileSync(path.resolve(OUTPUT_FILE), placeholder, 'utf8');
  log.info(`Placeholder narrative written to ${OUTPUT_FILE}`);
}

main().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(2);
});
