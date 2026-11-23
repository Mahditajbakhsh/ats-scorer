// Run with: npm test  (Node 18+)
const test = require("node:test");
const assert = require("node:assert");
require("../public/engine.js");
const ATS = globalThis.ATS;

const CV = `Mahdi Example
Oulu, Finland | mahdi@example.com | +358 40 123 4567 | linkedin.com/in/example | github.com/example

PROFILE
Molecular biologist and bioinformatician with experience in NGS data analysis and laboratory work.

EXPERIENCE
Research Intern, University of Oulu — Apr 2026 – Present
• Spatial transcriptomics analysis in R (Seurat) and Python
• Statistical analysis of RNA-seq data, collaboration with clinicians

Laboratory Researcher, Example Institute — Jan 2020 – Dec 2022
• HPLC analysis of nanoparticle drug release samples, method development
• Cell culture, qPCR, Western blot, ELISA
• Wrote SOPs and maintained lab safety records

EDUCATION
MSc in Nanobiotechnology, Example University, 2017 – 2019
BSc in Biology, Example University, 2013 – 2017

SKILLS
Python, R, Bash, Linux, Git, HPLC, qPCR, cell culture, data visualization

LANGUAGES
English (C1), Persian (native)`;
const JD_LAB = `Laboratory Engineer, Chemistry

Eurofins Ahma Oy is looking for a Laboratory Engineer to join our environmental laboratory in Oulu.

Your tasks:
• Performing chemical analyses of water and soil samples using HPLC, GC-MS and ICP-OES
• Method validation and development according to ISO 17025
• Reporting results in LIMS and maintaining SOPs
• Quality control of analytical results

We expect:
• MSc or BSc degree in chemistry, biochemistry or a related field
• At least 2 years of experience in an analytical laboratory
• Good command of Finnish and English
• Attention to detail and ability to work independently as well as in a team

Considered an advantage:
• Experience with mass spectrometry
• Knowledge of Python or R for data analysis

We offer a permanent position and occupational health care. Applicants must have a valid work permit.`;
const JD_PHD = `Doctoral Researcher in Single-Cell Genomics
University of Oulu, Faculty of Biochemistry and Molecular Medicine

We are seeking a motivated doctoral researcher to study tumor microenvironment using single-cell RNA-seq and spatial transcriptomics.

Requirements
- Master's degree in bioinformatics, molecular biology or a related field
- Experience with R or Python for analysis of NGS data
- Knowledge of Linux and HPC environments
- Excellent written and oral communication skills in English

Considered a plus
- Experience with Nextflow or Snakemake
- Publications in peer-reviewed journals
- Wet lab experience with cell culture

The position is for 4 years. We offer an international environment.`;
const NOW = new Date("2026-11-23");

test("lab job: experience years from Experience section only", () => {
  const r = ATS.score(CV, JD_LAB, { now: NOW });
  assert.strictEqual(r.components.experience.score, 100);
  assert.match(r.components.experience.detail, /3\.7/); // Apr 2026 to Nov 2026 (8 mo) + Jan 2020 to Dec 2022 (36 mo)
});

test("lab job: requirement levels and matches", () => {
  const r = ATS.score(CV, JD_LAB, { now: NOW });
  const k = Object.fromEntries(r.keywords.map((x) => [x.name, x]));
  assert.ok(k["HPLC"].hit);
  assert.ok(!k["LIMS"].hit);
  assert.strictEqual(k["Mass spectrometry"].level, "pref");
  assert.ok(k["R"].hit, "R detected from 'in R (Seurat)'");
  assert.ok(!r.keywords.some((x) => ["GC", "OES", "ISO"].includes(x.name)), "no duplicate acronyms");
  assert.ok(r.knockouts.some((x) => x.includes("Finnish")));
});

test("lab job: education requirement is the lowest level mentioned", () => {
  const e = ATS.jdEducation(JD_LAB);
  assert.strictEqual(e.name, "Bachelor's");
});

test("PhD call: contract length is not read as years of experience", () => {
  assert.strictEqual(ATS.jdYears(JD_PHD), null);
  const r = ATS.score(CV, JD_PHD, { now: NOW });
  assert.strictEqual(r.components.experience.score, null);
  assert.strictEqual(r.components.education.score, 100);
});

test("title guess keeps hyphenated words", () => {
  assert.strictEqual(ATS.guessTitle(JD_PHD), "Doctoral Researcher in Single-Cell Genomics");
});

test("R needs programming context", () => {
  assert.ok(!ATS.hasR("John R. Smith, R&D department"));
  assert.ok(ATS.hasR("Languages: Python, R, SQL"));
});

test("scanned PDF caps the overall score", () => {
  const r = ATS.score(CV, JD_LAB, { now: NOW, parse: { emptyText: true } });
  assert.ok(r.overall <= 10);
});

// ---------- Knockout gate ----------
test("gate: Finnish fails, work permit unknown, degree and years pass", () => {
  const r = ATS.score(CV, JD_LAB, { now: NOW });
  const g = Object.fromEntries(r.gate.map((x) => [x.label, x.status]));
  assert.strictEqual(g["زبان Finnish"], "fail");
  assert.strictEqual(g["زبان English"], "pass");
  assert.strictEqual(g["مجوز کار"], "unknown", "missing info is not a failure");
  assert.strictEqual(g["مدرک تحصیلی"], "pass");
  assert.strictEqual(g["سال‌های سابقه"], "pass");
});

test("gate: preferred language is not a knockout", () => {
  const jd = JD_LAB.replace("• Good command of Finnish and English", "• Good command of English").replace("Considered an advantage:", "Considered an advantage:\n• Swedish skills");
  const r = ATS.score(CV, jd, { now: NOW });
  assert.ok(!r.gate.some((x) => x.label.includes("Swedish")));
});

// ---------- Date consistency ----------
test("dates: inverted, future, mixed formats and gaps are flagged", () => {
  const cv = "EXPERIENCE\nLab tech, A, 01/2015 – Mar 2016\nEngineer, B, Jan 2019 – Dec 2018\nFuture job Jan 2029 – Present\nEDUCATION\nMSc 2016 – 2017\n";
  const d = ATS.dateConsistency(cv, ATS.detectSections(cv), NOW);
  const all = d.issues.join(" ");
  assert.match(all, /Jan 2019 - Dec 2018/);
  assert.match(all, /آینده/);
  assert.match(all, /دو قالب/);
  const inv = d.issues.find((x) => x.includes("پایان قبل از شروع")) || "";
  assert.ok(!inv.includes("2029"), "a future start with Present is not inverted");
  assert.ok(d.score < 50);
});

test("dates: study periods cover gaps between jobs", () => {
  const cv = "EXPERIENCE\nJob A, Jan 2015 – Dec 2016\nJob B, Jan 2019 – Present\nEDUCATION\nMSc, Jan 2017 – Dec 2018\n";
  const d = ATS.dateConsistency(cv, ATS.detectSections(cv), NOW);
  assert.ok(!d.issues.some((x) => x.includes("فاصله")));
  assert.strictEqual(d.score, 100);
});

test("dates: month names only (no 'Intern 2020' false month)", () => {
  const r = ATS.parseRanges("Intern 2020 – 2021", NOW);
  assert.strictEqual(r.length, 1);
  assert.strictEqual(r[0].fmtA, "year");
});

// ---------- Improve mode validation ----------
test("validation rejects invented numbers, skills and acronyms", () => {
  const src = ["• HPLC analysis of nanoparticle drug release samples, method development"];
  const ok = ATS.validateSuggestion("Performed HPLC analysis of drug release samples and developed methods", src);
  assert.ok(ok.ok, JSON.stringify(ok));
  const bad = ATS.validateSuggestion("Performed HPLC and GC-MS analysis of 200 samples in LIMS", src);
  assert.ok(!bad.ok);
  assert.ok(bad.errors.some((e) => e.includes("200")));
  assert.ok(bad.errors.some((e) => e.includes("LIMS")));
  assert.ok(!ATS.validateSuggestion("Anything", []).ok, "no sources means rejected");
});

test("method validation is not accepted as a synonym of method development", () => {
  const v = ATS.validateSuggestion("Led method validation for HPLC assays", ["HPLC analysis, method development"]);
  assert.ok(!v.ok);
});

test("apply: replaces bullets keeping the bullet sign, inserts new ones, extends skills and summary", () => {
  const out = ATS.applyImprovements(CV, {
    summary: { text: "Lab researcher with HPLC experience." },
    bullets: [{ replaces: "L10", text: "Performed HPLC analysis and method development" }, { after: "L12", text: "Recorded results in LIMS" }],
    skills: [{ text: "LIMS" }],
  });
  assert.match(out, /\n• Performed HPLC analysis and method development\n/);
  assert.match(out, /• Wrote SOPs and maintained lab safety records\n• Recorded results in LIMS/);
  assert.match(out, /data visualization, LIMS/);
  assert.match(out, /PROFILE\nLab researcher with HPLC experience\./);
  assert.ok(!out.includes("Molecular biologist and bioinformatician with experience"), "old summary replaced");
});

test("validation warns about seniority words that the source does not support", () => {
  const v = ATS.validateSuggestion("Performed HPLC analysis and led method development", ["HPLC analysis, method development"]);
  assert.ok(v.ok, "a warning, not a rejection");
  assert.ok(v.warnings.some((w) => w.includes("led")));
  assert.strictEqual(ATS.validateSuggestion("Led a team of 3", ["Led a team of 3 students"]).warnings.length, 0);
});

test("English report: labels, gate and validation messages contain no Persian", () => {
  const r = ATS.score(CV, JD_LAB, { now: NOW, lang: "en" });
  const text = JSON.stringify({ c: r.components, g: r.gate, t: r.tips, w: r.warnings, k: r.knockouts });
  assert.ok(!/[؀-ۿ]/.test(text), "no Persian characters in English output");
  assert.strictEqual(r.components.keywords.label, "Keyword match");
  const v = ATS.validateSuggestion("Used LIMS on 200 samples", ["HPLC"], "en");
  assert.ok(v.errors.every((e) => !/[؀-ۿ]/.test(e)));
  // the default stays Persian
  assert.match(ATS.score(CV, JD_LAB, { now: NOW }).components.keywords.label, /[؀-ۿ]/);
});
