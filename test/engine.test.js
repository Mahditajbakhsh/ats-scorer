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

// ---------- Application email ----------
test("email facts are verbatim CV lines; validation rejects invented content", () => {
  const r = ATS.score(CV, JD_LAB, { now: NOW, lang: "en" });
  const F = ATS.buildEmailFacts(CV, r);
  const texts = F.map((f) => f.text);
  texts.forEach((t) => assert.ok(CV.includes(t.replace(/; /g, ", ")) || CV.split("\n").some((l) => l.trim() === t) || /English/.test(t), "fact comes from the CV: " + t));
  assert.ok(F.some((f) => f.label === "name" && f.text === "Mahdi Example"));
  const good = "Dear Hiring Manager,\n\nI am applying for the Laboratory Engineer, Chemistry position at Eurofins Ahma Oy. I worked as a Laboratory Researcher at Example Institute (Jan 2020 – Dec 2022) on HPLC analysis and method development, and wrote SOPs. My CV is attached.\n\nKind regards,\nMahdi Example";
  const v = ATS.validateEmail(good, texts, JD_LAB, { lang: "en" });
  assert.ok(v.ok, JSON.stringify(v));
  const bad = ATS.validateEmail("I am a passionate chemist with 5 years of LIMS experience and led a team.", texts, JD_LAB, { lang: "en" });
  assert.ok(!bad.ok);
  assert.ok(bad.errors.some((e) => e.includes("5")) && bad.errors.some((e) => e.includes("LIMS")));
  assert.ok(bad.warnings.some((w) => w.includes("passionate")) && bad.warnings.some((w) => w.includes("led")));
  const long = ATS.validateEmail(Array.from({ length: 160 }, () => "word").join(" "), texts, JD_LAB, { lang: "en" });
  assert.ok(!long.ok && long.words === 160);
});

test("accepted summary does not delete sections the engine does not know", () => {
  const cv = ["Jane Doe", "jane@example.org", "", "Profile", "Biologist with NGS experience.", "", "Research Interests", "Single-cell genomics, hypoxia", "",
    "Conference Presentations", "• EACR 2025, Lisbon – Oral talk", "", "Education", "MSc Biology, 2019 – 2021"].join("\n");
  const out = ATS.applyImprovements(cv, { summary: { text: "Biologist with NGS experience in single-cell work." }, bullets: [], skills: [] });
  for (const keep of ["Research Interests", "Single-cell genomics, hypoxia", "Conference Presentations", "EACR 2025, Lisbon", "Education"]) assert.ok(out.includes(keep), keep);
  assert.ok(!out.includes("Biologist with NGS experience.\n"));
  assert.deepEqual(ATS.missingLines(cv.split("\n").filter((l) => l !== "Biologist with NGS experience.").join("\n"), out), []);
});

test("summary body stops at the first paragraph when headings are not recognised", () => {
  const cv = ["Jane Doe", "", "Summary", "Line one of summary.", "", "Odd Heading Words Zzz", "a", "b", "c", "d", "e", "f", "g", "Education", "MSc"].join("\n");
  const b = ATS.summaryBody(cv);
  assert.equal(b.text, "Line one of summary.");
});

test("rewrites that drop details or replace title lines are rejected", () => {
  const cv = ["Jane Doe", "", "Experience", "Research Assistant, University of Oulu, 2022 – 2024", "• Ran qPCR on 120 samples with Western blot validation", "", "Skills", "R, Python"].join("\n");
  assert.ok(ATS.lostDetails("Ran qPCR on 120 samples with Western blot validation", "Ran qPCR assays").includes("120"));
  assert.deepEqual(ATS.lostDetails("Ran qPCR on 120 samples with Western blot validation", "Performed qPCR on 120 samples and validated results by Western blot"), []);
  const errTitle = ATS.checkPreserved(cv, { kind: "bullet", replaces: "L3", text: "Research Assistant" }, "en");
  assert.ok(errTitle.some((e) => /heading, title, date/.test(e)));
  const errLost = ATS.checkPreserved(cv, { kind: "bullet", replaces: "L4", text: "Ran qPCR assays" }, "en");
  assert.ok(errLost.some((e) => /drops details/.test(e)));
  assert.deepEqual(ATS.checkPreserved(cv, { kind: "bullet", replaces: "L4", text: "Performed qPCR on 120 samples and validated results by Western blot" }, "en"), []);
  const out = ATS.applyImprovements(cv, { bullets: [{ replaces: "L3", text: "x" }], skills: [] });
  assert.ok(out.includes("Research Assistant, University of Oulu, 2022 – 2024"));
});

test("missingLines ignores punctuation and wrapping", () => {
  const src = "PhD Researcher, Oct 2023 – Present\n• Built Nextflow pipelines on the CSC Puhti cluster.\nTools: Git, Docker";
  const back = "PhD Researcher   Oct 2023 – Present\nBuilt Nextflow pipelines on the CSC\nPuhti cluster.\nTools:   Git, Docker";
  assert.deepEqual(ATS.missingLines(src, back), []);
  assert.deepEqual(ATS.missingLines(src + "\nLost line here", back), ["Lost line here"]);
});

test("in-place edits go into the right part of the CV and keep everything else", () => {
  const before = CV;
  const e = ATS.cvEntries(CV);
  assert.ok(e.length >= 2 && /Research Intern/.test(e[0].text));
  let x = ATS.addToSection(CV, "skills", "LIMS");
  assert.match(x, /data visualization, LIMS/);
  x = ATS.addBulletUnder(x, e[0].index, "Used ELISA to quantify cytokines");
  const ls = x.split("\n");
  const at = ls.findIndex((l) => l === "• Used ELISA to quantify cytokines");
  assert.ok(at > e[0].index && /^•/.test(ls[at - 1]) && (ls[at + 1] === "" || /^\S/.test(ls[at + 1])));
  x = ATS.addToSection(x, "languages", "Finnish (A2)");
  assert.match(x, /Persian \(native\), Finnish \(A2\)/);
  x = ATS.setHeadline(x, "Laboratory Scientist");
  assert.equal(x.split("\n")[1], "Laboratory Scientist");
  x = ATS.setHeadline(x, "Bioinformatician");
  assert.equal(x.split("\n")[1], "Bioinformatician");
  x = ATS.addHeaderLine(x, "Work permit: Finland");
  assert.ok(x.split("\n").slice(0, 5).includes("Work permit: Finland"));
  x = ATS.setSectionBody(x, "certifications", "GLP training, 2021");
  assert.match(x, /\nCERTIFICATIONS\nGLP training, 2021\n/);
  assert.ok(x.indexOf("CERTIFICATIONS") > x.indexOf("SKILLS") && x.indexOf("CERTIFICATIONS") < x.indexOf("LANGUAGES"));
  x = ATS.setSectionBody(x, "summary", "New profile.");
  assert.match(x, /PROFILE\nNew profile\.\n\nEXPERIENCE/);
  // nothing else was lost
  const removed = ["Molecular biologist and bioinformatician with experience in NGS data analysis and laboratory work."];
  assert.deepEqual(ATS.missingLines(before.split("\n").filter((l) => !removed.includes(l)).join("\n"), x), []);
  assert.equal(CV, before);
});

test("a missing section is created with a heading and the score sees it", () => {
  const cv = CV.replace(/\nSKILLS\n[^\n]*\n/, "\n");
  assert.ok(!ATS.findBlock(cv, "skills"));
  const x = ATS.setSectionBody(cv, "skills", "Python, R, qPCR");
  assert.ok(ATS.findBlock(x, "skills"));
  assert.ok(ATS.detectSections(x).skills);
});

test("missingLines accepts a date column moved to the right and wrapped titles", () => {
  const src = "2024–2025   Research Intern, Vainio Group, University of Oulu\nNov 2023   Whole Genome Sequencing, Technical University of Denmark\nUnder review   Doe J. A title. Journal of Things (under review).";
  const back = "Research Intern   2024 – 2025\nVainio Group, University of Oulu\nWhole Genome Sequencing   Nov 2023\nTechnical University of Denmark\nDoe J. A title. Journal of Things (under review).";
  assert.deepEqual(ATS.missingLines(src, back), []);
  assert.deepEqual(ATS.missingLines(src + "\n2019–2020   Something else entirely", back), ["2019–2020   Something else entirely"]);
});
