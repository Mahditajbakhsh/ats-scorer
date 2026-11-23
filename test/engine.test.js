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
