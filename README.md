# 🛡️ Compliance Sentinel Platform

### Autonomous Privacy Observability & Governance Suite

An end-to-end **Compliance-as-Code** platform designed to detect, evaluate, and govern data privacy risks at an enterprise scale. Built with Python/Playwright, Node.js, and Google Gemini AI, the platform identifies critical "Prior Consent" failures and unauthorized Google Identity Sync leaks before they reach the consumer.

---

## 🏗️ System Architecture

The platform operates as a **closed-loop feedback system** across four layers:

| Layer | Role | Detail |
|-------|------|--------|
| **The Eyes** (Automation) | Playwright scrapers | Simulate "Clean Room" user journeys (No-Interaction/Reject All) to capture network telemetry at T=0.5s |
| **The Brain** (Evaluator) | Node.js engine | Maps raw cookies against a Stable-Order Hierarchy (Human Review > Canonical Table > AI Inference) |
| **The Intelligence** (AI/ML) | Google Gemini 2.5 Flash | Classifies unknown vendors; GPT-4o translates technical violations into DPO-ready legal narratives |
| **The Interface** (Governance) | Firestore-backed dashboard | Expert-in-the-Loop (EITL) review and lifecycle management |

```
🎭 Playwright scraper  →  🧠 Node.js evaluator  →  🤖 AI narrative  →  📊 Allure dashboard
```

See [`docs/architecture-diag.md`](docs/architecture-diag.md) for the full Mermaid flow diagram.

---

## 🚀 Key Technical Innovations

### 1. 0.5s Baseline "Prior Consent" Detection

Unlike standard scanners, Sentinel intercepts network requests at the **commit phase**. This allows the detection of "Passive Leaks" — trackers like Adyen Telemetry or Meta Pixels that fire **before** the Consent Management Platform (CMP) can even initialise.

### 2. Google Identity Sync Mapping

The engine specifically targets the "Identity Sync" pattern. It detects when 3rd-party iFrames (e.g., Google Pay via Adyen) trigger requests to `accounts.google.com`, dropping 24+ synchronization cookies (`NID`, `SID`, `HSID`) without user interaction.

### 3. Stable-Order Classification Hierarchy

To prevent "Classification Drift," the Evaluator applies a strict authority model:

- **Level 1 — Audited Truth:** Human-reviewed entries in Firestore.
- **Level 2 — Canonical Dictionary:** Authoritative definitions for GA4, TikTok, etc.
- **Level 3 — AI Inference:** Gemini 2.5 Flash mapping unknown cookies to OneTrust C001–C004 codes.

---

## 📂 Repository Structure

```
├── automation/          # Playwright (Python) - Pristine context & T=0 capture
├── evaluator/           # Node.js - Rule engine & Severity Escalator
├── ai-narrative/        # LLM Logic - Legal-risk translation (GPT-4o)
├── governance-dash/     # Firebase/Web - Human-Review UI & AI Classification
└── docs/                # Case Studies (The Adyen/Google Identity Sync finding)
```

---

## 🤖 AI-Powered Reporting

The platform features an **Autonomous Legal-Technical Translator**. It aggregates raw technical findings (e.g., `_fbp` set at `0.4s`) and generates executive summaries:

> *"Finding: Unauthorized Meta Advertising sync detected. The `_fbp` tracker initialized during the 'No Interaction' phase. Risk: Direct violation of ePrivacy Art. 5(3). Remediation: Wrap the Meta Pixel loader in a `consent_granted` event listener."*

---

## 🛠️ Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Automation** | Python, Playwright, Pytest, Pytest-Asyncio |
| **Backend** | Node.js, Express, Google Cloud Functions |
| **Database** | Firebase Firestore (Real-time sync) |
| **AI/ML** | Google Gemini (Classification), OpenAI GPT-4o (Narratives) |
| **Reporting** | Allure Reports, Static HTML Dashboards |

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

## ⚖️ License & Intellectual Property

**Proprietary Architecture Showcase.**

© 2026 Adam Armitage-Kerr. All rights reserved.

This repository is provided for professional evaluation and portfolio demonstration. Unauthorized commercial redistribution or use of the core evaluator logic is prohibited.
