# Compliance Sentinel Platform

> **High-performance automated compliance engine** using Playwright and Node.js to detect GDPR/ePrivacy *Prior Consent* failures, unauthorised tracking pixels, and Google Identity Sync leaks — with AI-powered legal-risk narratives.

---

## What It Does

Modern e-commerce sites routinely fire advertising pixels, analytics scripts, and identity-sync beacons *before* a visitor has interacted with the cookie consent banner. This is a direct violation of the ePrivacy Directive Art. 5(3) and GDPR Art. 6(1)(a).

**Compliance Sentinel** automates the detection, classification, and reporting of these violations at scale.

```
🎭 Playwright scraper  →  🧠 Node.js evaluator  →  🤖 AI narrative  →  📊 Allure dashboard
```

---

## Architecture

```
graph TD
    A[Playwright Scraper] -->|Network Trace| B(Allure Results)
    B --> C{Node.js Evaluator}
    C -->|Match| D[Canonical Table]
    C -->|No Match| E[Human Review Queue]
    D -->|Violation| F[Severity Escalator]
    F -->|Critical/High| G[AI Narrative Engine]
    G -->|GPT-4o| H[DPO-Ready Report]
    H --> I[GitHub Action Failure/Gate]

```

See [`docs/architecture-diag.md`](docs/architecture-diag.md) for the full Mermaid flow diagram.

---

## Key Capabilities

| Capability | Detail |
|-----------|--------|
| **Prior consent detection** | Intercepts all network requests on page load before consent; flags any that match known tracking domains |
| **Dynamic severity escalation** | `CRITICAL` → identity sync, `HIGH` → advertising, `MEDIUM` → analytics, `LOW` → functional |
| **Google Identity Sync detection** | Specifically targets NID/DSID cookie setting via Google Pay iframes (the Adyen pattern) |
| **Canonical cookie dictionary** | 20+ pre-classified cookies with vendor, purpose, and consent requirement |
| **AI legal narrative** | GPT-4o translates structured violations into a DPO-ready legal-risk report |
| **Allure dashboard** | Interactive HTML evidence timeline with attached network logs |
| **CI/CD integration** | GitHub Actions workflow runs daily audits; exits non-zero on CRITICAL violations |

---

## Quick Start

### Prerequisites

- **Node.js** ≥ 18
- **Python** ≥ 3.11
- **Playwright** (installed via pip)

### Install

```bash
# Node.js dependencies
npm install

# Python dependencies
pip install pytest playwright pytest-playwright allure-pytest
playwright install --with-deps chromium
```

### Configure

```bash
cp .env.example .env
# Edit .env — set AUDIT_BASE_URL and optionally OPENAI_API_KEY
```

### Run a manual audit

```bash
# Run all scenario tests (captures network evidence)
pytest automation/ --alluredir=dashboard/allure-results -v

# Evaluate violations (reads Allure results, writes violation-report.json)
node evaluator/evaluator-engine.js

# Generate AI narrative (requires OPENAI_API_KEY)
node ai-narrative/narrative-generator.js

# Generate Allure HTML report
allure generate dashboard/allure-results -o dashboard/allure-report --clean
```

---

## CI/CD

The GitHub Actions workflow (`.github/workflows/compliance-audit.yml`) runs automatically:

- **Daily at 06:00 UTC** (scheduled)
- **On every push to `main`**
- **On every pull request to `main`**

**Secrets required** in your GitHub repository settings:

| Secret | Purpose |
|--------|---------|
| `AUDIT_BASE_URL` | The target site to audit (e.g. `https://yoursite.com`) |
| `OPENAI_API_KEY` | OpenAI key for AI narrative generation |

The CI pipeline exits with **code 1** if any `CRITICAL` violations are detected, enabling branch protection gates.

---

## Findings: Adyen / Google Identity Sync Leak

The platform was built in response to a real-world finding: **major UK e-commerce sites using Adyen as their PSP were inadvertently triggering Google Identity Sync on every checkout page load** — without any user consent.

The Adyen payment iframe loads a Google Pay button, which fires requests to `accounts.google.com`, setting `NID` and `DSID` cookies. These cookies link the visitor's on-site session to their Google account identity.

**This is a direct violation of ePrivacy Directive Art. 5(3).**

See [`docs/adyen-leak-audit.md`](docs/adyen-leak-audit.md) for the full case study, legal analysis, and remediation roadmap.

---

## Legal Framework

| Regulation | Key Article | Requirement |
|-----------|-------------|-------------|
| ePrivacy Directive 2002/58/EC | Art. 5(3) | Prior consent before storing/accessing terminal equipment |
| UK PECR 2003 | Reg. 6(1) | Same as above (UK post-Brexit equivalent) |
| GDPR 2016/679 | Art. 6(1)(a) | Consent as lawful basis for non-essential processing |
| GDPR 2016/679 | Art. 83 | Fines up to €20M / 4% global annual turnover |

---

## License

MIT
