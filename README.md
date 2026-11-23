# ATS Scorer

Scores how well a CV matches a job ad, simulating what applicant tracking systems (ATS) look at. Runs on Cloudflare Workers.

Live: https://ats-scorer.mahditajbakhsh71.workers.dev

## Features

* **Rule-based score**, computed entirely in the browser (`public/engine.js`). Seven parts: keywords, job title, degree, years of experience, languages, date consistency and file readability.
* **Knockout criteria** (required language, degree, years of experience, work permit, driving licence) are shown separately from the score as pass, fail or unknown. Missing information counts as unknown, not as a fail. (Idea from [sliday/resume-job-matcher](https://github.com/sliday/resume-job-matcher).)
* **Date consistency:** end before start, future dates, mixed date formats and gaps of more than 6 months. Study periods are not counted as gaps. (A similar criterion exists in [srbhr/Resume-Matcher](https://github.com/srbhr/Resume-Matcher).)
* **File checks:** PDF and DOCX are parsed in the browser (pdf.js, mammoth). Image-only PDFs, likely multi-column layouts, tables and icon glyphs are flagged, and the extracted text is shown as an ATS parser would see it.
* **Semantic analysis** through `/api/analyze`: an LLM checks every requirement of the ad against the CV and must quote the CV as evidence. The Anthropic API key stays on the server.
* **CV improvement** through `/api/improve`: missing keywords are turned into questions, and only items the user confirms are used. Every suggested line must cite its source, either a numbered CV line (`L#`) or a confirmed answer (`U#`). The browser re-checks each suggestion and rejects it if it contains a number, known skill or acronym that is not in its sources; unsupported seniority words such as "led" or "managed" get a warning. Scores before and after are compared. (Idea from [ebarti/JobCtrl](https://github.com/ebarti/JobCtrl); idea only, no code.)
* **PDF export:** the improved CV can be downloaded as a single-column PDF with real, selectable text (jsPDF, built in the browser, no API call). The PDF is read back with the same parser and re-scored to confirm nothing was lost. Only Latin characters are supported by the standard PDF font; any others are reported.
* **Persian and English:** the whole interface, the report and the model output switch with one button. The choice is kept in the browser.
* CVs and job ads are not stored anywhere.

## Project structure

```
public/            static files (Workers Static Assets)
  index.html
  i18n.js          interface strings in Persian and English
  styles.css
  engine.js        rule-based scoring engine (no dependencies, also runs in Node)
  app.js           interface, PDF/DOCX reading, API calls
  pdf.js           PDF export of the improved CV
src/worker.js      /api/status, /api/analyze and /api/improve
test/              engine tests (node --test)
wrangler.toml
```

## Requirements

* A Cloudflare account
* Node.js 18 or later
* An API key from the Claude Console (only for semantic analysis and CV improvement; API usage is billed separately from a Claude subscription)

## Setup

```bash
npm install
npx wrangler login

# Anthropic API key (required for semantic analysis and CV improvement)
npx wrangler secret put ANTHROPIC_API_KEY

# Access password (strongly recommended; without it anyone with the URL can spend your API credit)
npx wrangler secret put ACCESS_TOKEN

npm run deploy
```

After deploying you get a URL like `https://ats-scorer.<your-subdomain>.workers.dev`. Enter the access password on the page the first time you run the semantic analysis; it is remembered in that browser.

Without an Anthropic key the page still works and shows the rule-based score only.

## Automatic deployment

This repository is connected to the `ats-scorer` Worker through Cloudflare Workers Builds. Every push to `main` is deployed with `npx wrangler deploy`. Secrets (`ANTHROPIC_API_KEY`, `ACCESS_TOKEN`) are set in the Cloudflare dashboard and are kept across deploys.

## Local development

```bash
cp .dev.vars.example .dev.vars   # put your key and password in it
npm run dev                      # http://localhost:8787
npm test                         # scoring engine tests
```

## Configuration (`wrangler.toml`, `[vars]`)

| Variable | Default | Description |
|---|---|---|
| `MODEL` | `claude-sonnet-5-5` | Model id; `claude-opus-5-5` for more thorough analysis, `claude-haiku-5-5` for lower cost |
| `ANTHROPIC_VERSION` | `2026-10-21` | API version header (per platform.claude.com/docs/en/api/versioning, November 2026) |
| `ANTHROPIC_BASE_URL` | `https://api.anthropic.com` | Optional, e.g. to route through Cloudflare AI Gateway |
| `MAX_CV_CHARS` / `MAX_JD_CHARS` | `18000` / `12000` | Maximum text length sent to the model |

## Security

* `ACCESS_TOKEN` stops other people from using your API key. It is compared in constant time in the Worker.
* To lock the whole app, not only the API, enable Cloudflare Access (Zero Trust) on the domain. This is the best option for a personal app.
* Model output is reduced to known fields before it reaches the page, and the page escapes all text.
* Job ad and CV text are passed to the model as data with an instruction to ignore any instructions inside them.

## Embedding in another app

1. **Separate Worker on a subdomain**, e.g. `ats.yourdomain.com` (Cloudflare dashboard: Workers › Settings › Domains & Routes). The simplest option.
2. **Inside an existing Worker:** copy `public/` into a folder such as `public/ats/` and add the `/api/status`, `/api/analyze` and `/api/improve` routes from `src/worker.js` to your router. URLs in `app.js` are relative (`api/status`), so if the page lives under `/ats/`, serve the API under `/ats/api/...` or change the paths in `app.js`.

## Notes

* pdf.js (3.11.174), mammoth (1.6.0) and jsPDF (2.5.2) are loaded from jsDelivr; jsPDF only when a PDF is downloaded.
* The weights and thresholds are design choices of this tool, not official numbers of any ATS. The real algorithms of Workday, Taleo and others are not public. Details are in the "How the score is calculated" section of the page. Use the score to compare versions of your own CV for one ad, not to predict an outcome.
