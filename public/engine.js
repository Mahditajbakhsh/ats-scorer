// ATS Match Scorer engine. Pure functions, no DOM.
(function (root) {
  "use strict";

  // ---------- Skill dictionary ----------
  // k: display name, a: aliases (matched after normalization), c: category, soft: soft skill
  const SKILLS = [
    // Bioinformatics and genomics
    { k: "Bioinformatics", a: ["bioinformatics", "bioinformatic", "bioinformatician", "computational biology", "computational biologist"], c: "bio" },
    { k: "NGS", a: ["ngs", "next generation sequencing", "high throughput sequencing", "massively parallel sequencing"], c: "bio" },
    { k: "RNA-seq", a: ["rna seq", "rnaseq", "rna sequencing", "transcriptome sequencing"], c: "bio" },
    { k: "Single-cell RNA-seq", a: ["scrna seq", "scrnaseq", "single cell rna seq", "single cell rna sequencing", "single cell transcriptomics", "single cell sequencing", "single cell"], c: "bio" },
    { k: "Spatial transcriptomics", a: ["spatial transcriptomics", "visium", "spatial omics", "xenium", "merfish", "cosmx"], c: "bio" },
    { k: "ChIP-seq", a: ["chip seq", "chipseq"], c: "bio" },
    { k: "ATAC-seq", a: ["atac seq", "atacseq", "scatac seq"], c: "bio" },
    { k: "Whole genome sequencing", a: ["whole genome sequencing", "wgs"], c: "bio" },
    { k: "Whole exome sequencing", a: ["whole exome sequencing", "exome sequencing"], c: "bio" },
    { k: "Variant calling", a: ["variant calling", "gatk", "variant analysis", "snv calling"], c: "bio" },
    { k: "Genomics", a: ["genomics", "genomic"], c: "bio" },
    { k: "Transcriptomics", a: ["transcriptomics", "transcriptomic"], c: "bio" },
    { k: "Proteomics", a: ["proteomics", "proteomic"], c: "bio" },
    { k: "Metabolomics", a: ["metabolomics", "metabolomic"], c: "bio" },
    { k: "Multi-omics", a: ["multi omics", "multiomics", "multi omic", "omics integration"], c: "bio" },
    { k: "Metagenomics", a: ["metagenomics", "metagenomic", "microbiome", "16s rrna"], c: "bio" },
    { k: "Differential expression", a: ["differential expression", "differential gene expression", "deseq2", "edger", "limma"], c: "bio" },
    { k: "Seurat", a: ["seurat"], c: "bio" },
    { k: "Scanpy", a: ["scanpy", "anndata"], c: "bio" },
    { k: "Bioconductor", a: ["bioconductor"], c: "bio" },
    { k: "Sequence alignment", a: ["sequence alignment", "read alignment", "star aligner", "bwa", "bowtie", "bowtie2", "hisat2", "salmon", "kallisto"], c: "bio" },
    { k: "Phylogenetics", a: ["phylogenetics", "phylogenetic"], c: "bio" },
    { k: "Population genetics", a: ["population genetics", "gwas", "genome wide association"], c: "bio" },
    { k: "Workflow managers", a: ["nextflow", "snakemake", "nf core", "workflow manager", "cromwell", "wdl"], c: "bio" },
    { k: "Pathway analysis", a: ["pathway analysis", "gene set enrichment", "gsea", "enrichment analysis", "gene ontology"], c: "bio" },
    { k: "Structural bioinformatics", a: ["structural bioinformatics", "molecular docking", "alphafold", "pymol", "molecular dynamics"], c: "bio" },
    { k: "Biostatistics", a: ["biostatistics", "biostatistical"], c: "bio" },
    { k: "Public databases (TCGA, GEO)", a: ["tcga", "geo database", "gene expression omnibus", "ensembl", "ncbi", "uniprot", "gtex", "cellxgene"], c: "bio" },
    { k: "Machine learning", a: ["machine learning", "ml models", "scikit learn", "sklearn", "random forest", "xgboost"], c: "prog" },
    { k: "Deep learning", a: ["deep learning", "neural network", "neural networks", "pytorch", "tensorflow", "keras"], c: "prog" },
    { k: "Statistics", a: ["statistics", "statistical analysis", "statistical methods", "statistical modelling", "statistical modeling"], c: "prog" },
    { k: "Data analysis", a: ["data analysis", "data analytics", "data analyses"], c: "prog" },
    { k: "Data visualization", a: ["data visualization", "data visualisation", "ggplot2", "matplotlib", "seaborn", "plotly"], c: "prog" },

    // Programming and computing
    { k: "Python", a: ["python", "pandas", "numpy", "biopython"], c: "prog" },
    { k: "R", a: ["r programming", "rstudio", "tidyverse", "r markdown", "rmarkdown", "r shiny", "r packages"], c: "prog", special: "R" },
    { k: "Bash / shell", a: ["bash", "shell scripting", "shell scripts", "unix shell", "zsh"], c: "prog" },
    { k: "Linux", a: ["linux", "unix", "ubuntu", "command line"], c: "prog" },
    { k: "SQL", a: ["sql", "postgresql", "mysql", "sqlite", "relational database"], c: "prog" },
    { k: "Git / GitHub", a: ["git", "github", "gitlab", "version control"], c: "prog" },
    { k: "HPC / cluster", a: ["hpc", "high performance computing", "computing cluster", "slurm", "csc puhti", "puhti", "mahti", "lumi"], c: "prog" },
    { k: "Cloud computing", a: ["cloud computing", "aws", "google cloud", "gcp", "azure"], c: "prog" },
    { k: "Containers", a: ["docker", "singularity", "apptainer", "containers", "containerization", "conda", "bioconda"], c: "prog" },
    { k: "MATLAB", a: ["matlab"], c: "prog" },
    { k: "Java", a: ["java"], c: "prog" },
    { k: "C / C++", a: ["c++", "cpp"], c: "prog" },
    { k: "JavaScript", a: ["javascript", "typescript", "node js", "node.js", "nodejs"], c: "prog" },
    { k: "Excel", a: ["excel", "microsoft excel", "spreadsheets"], c: "prog" },
    { k: "Microsoft Office", a: ["microsoft office", "ms office", "office 365", "microsoft 365"], c: "prog" },
    { k: "GraphPad Prism", a: ["graphpad", "prism"], c: "prog" },
    { k: "ImageJ / Fiji", a: ["imagej", "fiji"], c: "prog" },
    { k: "SPSS", a: ["spss"], c: "prog" },
    { k: "Jupyter", a: ["jupyter", "jupyter notebook", "jupyterlab"], c: "prog" },

    // Molecular and cell biology lab
    { k: "PCR", a: ["pcr", "polymerase chain reaction"], c: "lab" },
    { k: "qPCR", a: ["qpcr", "rt qpcr", "real time pcr", "quantitative pcr", "rt pcr"], c: "lab" },
    { k: "Western blot", a: ["western blot", "western blotting", "immunoblot", "immunoblotting"], c: "lab" },
    { k: "ELISA", a: ["elisa"], c: "lab" },
    { k: "Cell culture", a: ["cell culture", "tissue culture", "mammalian cell culture", "cell lines", "primary cells"], c: "lab" },
    { k: "Flow cytometry", a: ["flow cytometry", "facs", "cytometry"], c: "lab" },
    { k: "Microscopy", a: ["microscopy", "confocal", "fluorescence microscopy", "electron microscopy", "sem", "tem"], c: "lab" },
    { k: "Immunohistochemistry", a: ["immunohistochemistry", "ihc", "immunofluorescence", "histology"], c: "lab" },
    { k: "Cloning", a: ["cloning", "molecular cloning", "plasmid", "plasmids", "gibson assembly"], c: "lab" },
    { k: "CRISPR", a: ["crispr", "cas9", "gene editing", "genome editing"], c: "lab" },
    { k: "siRNA / knockdown", a: ["sirna", "shrna", "knockdown", "gene silencing"], c: "lab" },
    { k: "Transfection", a: ["transfection", "transduction", "lentiviral", "lentivirus"], c: "lab" },
    { k: "Protein purification", a: ["protein purification", "protein expression", "recombinant protein", "fplc", "affinity chromatography"], c: "lab" },
    { k: "Gel electrophoresis", a: ["gel electrophoresis", "agarose gel", "sds page"], c: "lab" },
    { k: "DNA/RNA extraction", a: ["dna extraction", "rna extraction", "nucleic acid extraction", "rna isolation", "dna isolation"], c: "lab" },
    { k: "Library preparation", a: ["library preparation", "library prep", "illumina", "nanopore", "oxford nanopore", "pacbio"], c: "lab" },
    { k: "Sanger sequencing", a: ["sanger sequencing", "sanger"], c: "lab" },
    { k: "Microbiology", a: ["microbiology", "microbiological", "bacterial culture", "bacteriology", "aseptic technique"], c: "lab" },
    { k: "Animal work", a: ["animal experiments", "animal handling", "mouse models", "in vivo", "felasa"], c: "lab" },
    { k: "Biochemistry", a: ["biochemistry", "biochemical", "biochemist"], c: "lab" },
    { k: "Molecular biology", a: ["molecular biology", "molecular biologist"], c: "lab" },
    { k: "Cell biology", a: ["cell biology", "cell biologist"], c: "lab" },
    { k: "Enzyme assays", a: ["enzyme assay", "enzyme assays", "enzymatic assay", "enzyme kinetics"], c: "lab" },
    { k: "Nanotechnology", a: ["nanotechnology", "nanobiotechnology", "nanoparticles", "nanoparticle", "nanomaterials"], c: "lab" },
    { k: "Drug delivery", a: ["drug delivery", "drug release", "formulation development"], c: "lab" },
    { k: "Extracellular matrix", a: ["extracellular matrix", "ecm"], c: "lab" },
    { k: "Hypoxia", a: ["hypoxia", "hif 1", "hif1a", "hypoxia inducible"], c: "lab" },
    { k: "Cancer biology", a: ["cancer biology", "oncology", "tumor biology", "tumour biology", "tumor microenvironment", "tumour microenvironment"], c: "lab" },
    { k: "Lab notebook / ELN", a: ["eln", "electronic lab notebook", "laboratory notebook"], c: "lab" },

    // Analytical chemistry and quality
    { k: "HPLC", a: ["hplc", "uplc", "uhplc", "liquid chromatography"], c: "chem" },
    { k: "LC-MS", a: ["lc ms", "lcms", "lc ms ms", "lc msms"], c: "chem" },
    { k: "GC / GC-MS", a: ["gc ms", "gcms", "gas chromatography", "gc fid"], c: "chem" },
    { k: "Mass spectrometry", a: ["mass spectrometry", "mass spec", "icp ms", "maldi"], c: "chem" },
    { k: "ICP-OES", a: ["icp oes", "icp aes", "icp"], c: "chem" },
    { k: "Spectroscopy", a: ["spectroscopy", "spectrophotometry", "uv vis", "ftir", "ir spectroscopy", "nmr", "raman"], c: "chem" },
    { k: "Titration", a: ["titration", "karl fischer"], c: "chem" },
    { k: "Sample preparation", a: ["sample preparation", "sample prep", "solid phase extraction", "spe"], c: "chem" },
    { k: "Analytical chemistry", a: ["analytical chemistry", "chemical analysis", "chemical analyses", "analytical methods"], c: "chem" },
    { k: "Method validation", a: ["method validation", "validation of methods", "analytical method validation", "validated methods", "validating methods"], c: "chem" },
    { k: "Method development", a: ["method development", "developing methods", "developed methods", "assay development"], c: "chem" },
    { k: "Quality control", a: ["quality control", "qc"], c: "chem" },
    { k: "Quality assurance", a: ["quality assurance", "qa"], c: "chem" },
    { k: "ISO 17025", a: ["iso 17025", "iso iec 17025", "17025", "accredited laboratory", "accreditation"], c: "chem" },
    { k: "ISO 9001", a: ["iso 9001"], c: "chem" },
    { k: "GMP", a: ["gmp", "good manufacturing practice", "cgmp"], c: "chem" },
    { k: "GLP", a: ["glp", "good laboratory practice"], c: "chem" },
    { k: "LIMS", a: ["lims", "laboratory information management"], c: "chem" },
    { k: "SOPs", a: ["sop", "sops", "standard operating procedure", "standard operating procedures"], c: "chem" },
    { k: "Lab safety", a: ["laboratory safety", "lab safety", "chemical safety", "biosafety", "occupational safety", "hse"], c: "chem" },
    { k: "Environmental analysis", a: ["environmental analysis", "environmental samples", "water analysis", "soil analysis", "environmental testing"], c: "chem" },
    { k: "Food analysis", a: ["food analysis", "food testing", "food safety", "food microbiology"], c: "chem" },
    { k: "Regulatory knowledge", a: ["regulatory affairs", "ich guidelines", "fda", "ema"], c: "chem" },

    // Research and academic
    { k: "Scientific writing", a: ["scientific writing", "manuscript writing", "manuscript preparation", "peer reviewed publications", "publications", "publication record"], c: "res" },
    { k: "Grant writing", a: ["grant writing", "grant applications", "funding applications", "grant proposals"], c: "res" },
    { k: "Experimental design", a: ["experimental design", "study design", "design of experiments"], c: "res" },
    { k: "Literature review", a: ["literature review", "systematic review", "review article"], c: "res" },
    { k: "Teaching / supervision", a: ["teaching", "supervision", "supervising students", "mentoring", "teaching assistant"], c: "res" },
    { k: "Conference presentations", a: ["conference presentation", "conference presentations", "poster presentation", "oral presentation", "presented at"], c: "res" },
    { k: "Project management", a: ["project management", "managing projects", "project coordination"], c: "res" },
    { k: "Data management", a: ["data management", "fair data", "research data management", "fair principles"], c: "res" },
    { k: "Reproducible research", a: ["reproducible research", "reproducibility", "reproducible"], c: "res" },

    // Soft skills
    { k: "Teamwork", a: ["teamwork", "team player", "collaborative", "collaboration", "work in a team", "working in a team", "team work"], c: "soft", soft: true },
    { k: "Communication", a: ["communication skills", "communication", "communicate", "interpersonal skills"], c: "soft", soft: true },
    { k: "Independent work", a: ["independently", "independent work", "self motivated", "self driven", "autonomous", "proactive"], c: "soft", soft: true },
    { k: "Problem solving", a: ["problem solving", "problem solver", "analytical thinking", "analytical skills", "troubleshooting"], c: "soft", soft: true },
    { k: "Attention to detail", a: ["attention to detail", "detail oriented", "accuracy", "accurate", "meticulous", "precise"], c: "soft", soft: true },
    { k: "Time management", a: ["time management", "organizational skills", "organisational skills", "organized", "organised", "prioritize", "prioritise"], c: "soft", soft: true },
    { k: "Customer focus", a: ["customer service", "customer oriented", "customer focus", "client"], c: "soft", soft: true },
    { k: "Leadership", a: ["leadership", "led a team", "team lead"], c: "soft", soft: true },
    { k: "Adaptability", a: ["adaptability", "flexible", "flexibility", "fast learner", "eager to learn", "willingness to learn"], c: "soft", soft: true },
    { k: "International environment", a: ["international environment", "multicultural", "international team", "intercultural"], c: "soft", soft: true },
  ];

  const LANGS = [
    { k: "English", a: ["english", "englanti", "englannin"] },
    { k: "Finnish", a: ["finnish", "suomi", "suomen kieli", "suomen kielen", "suomea"] },
    { k: "Swedish", a: ["swedish", "ruotsi", "ruotsin"] },
    { k: "German", a: ["german", "saksa"] },
    { k: "French", a: ["french", "ranska"] },
    { k: "Spanish", a: ["spanish"] },
    { k: "Persian", a: ["persian", "farsi"] },
    { k: "Arabic", a: ["arabic"] },
    { k: "Russian", a: ["russian", "venäjä"] },
    { k: "Chinese", a: ["chinese", "mandarin"] },
  ];

  const STOP = new Set(("a about above after again against all also am an and any are as at be because been before being below between both but by can could did do does doing down during each few for from further had has have having he her here hers herself him himself his how i if in into is it its itself just me more most my myself no nor not now of off on once only or other our ours ourselves out over own same she should so some such than that the their theirs them themselves then there these they this those through to too under until up very was we were what when where which while who whom why will with would you your yours yourself yourselves etc e g ie i e via per within across around based including include includes well new one two three may must shall need needs needed strong good excellent great high highly relevant related required requirement requirements preferred plus advantage ability able experience experienced work working worked job role position candidate candidates applicant applicants apply application applications company team teams our we you university faculty department unit group research researcher researchers project projects year years month months day days time full part contract permanent temporary start date salary offer offers benefit benefits opportunity opportunities please send submit deadline contact information further details more like look looking seek seeking hire hiring join responsibilities responsibility tasks task duties include main key area areas field fields degree knowledge skills skill understanding familiarity background other different various wide range level levels person people help support develop development provide ensure use using used make making take part daily also based within new oulu finland finnish helsinki espoo tampere turku").split(/\s+/));

  const ACRO_STOP = new Set(["OR", "AND", "NOT", "TO", "IN", "OF", "ON", "AT", "BY", "AS", "IS", "BE", "WE", "NO", "SO", "IF", "AN", "OUR", "YOU", "THE", "FOR", "LI", "NEW", "ALL", "EU", "CV", "PDF", "FI", "HR", "CEO", "CTO", "OY", "AB", "LTD", "INC", "PHD", "MSC", "BSC", "MS", "BA", "MA", "PH", "D", "I", "II", "III", "IV", "US", "USA", "UK", "AI", "IT", "TBD", "FAQ", "URL", "WWW", "HTTP", "HTTPS", "COM", "GMBH", "EUR", "ID", "OK", "NB", "PS", "VAT", "CET", "EET", "AM", "PM", "UTC", "DOI", "ORCID", "LINKEDIN", "THE", "AND", "FOR", "YOU", "WE", "OUR", "CEST", "EEST", "Q"]);

  // ---------- Language ----------
  let LANG = "fa";
  const tr = (fa, en) => (LANG === "en" ? en : fa);
  const J = () => tr("، ", ", ");
  const SEP = () => tr("؛ ", "; ");
  const q = (x) => tr("«" + x + "»", "\u201c" + x + "\u201d");

  // ---------- Text helpers ----------
  function norm(s) {
    return (" " + String(s || "") + " ")
      .replace(/[‐-―−]/g, "-")
      .replace(/[‘’]/g, "'")
      .toLowerCase()
      .replace(/ph\.d\.?/g, "phd")
      .replace(/m\.sc\.?/g, "msc")
      .replace(/b\.sc\.?/g, "bsc")
      .replace(/[-_\/\\|:;,()\[\]{}"'!?*•·●▪■◆►✓→]/g, " ")
      .replace(/\.(?=\s)/g, " ")
      .replace(/\s+/g, " ");
  }
  function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
  const reCache = new Map();
  function termRe(alias) {
    let r = reCache.get(alias);
    if (!r) {
      const a = norm(alias).trim();
      r = new RegExp("(?<![a-z0-9+#])" + escRe(a) + "(?:s|es)?(?![a-z0-9+#])", "g");
      reCache.set(alias, r);
    }
    r.lastIndex = 0;
    return r;
  }
  function countAlias(normText, alias) {
    const r = termRe(alias);
    const m = normText.match(r);
    return m ? m.length : 0;
  }
  // Special: programming language R (single uppercase letter, needs context).
  function hasR(raw) {
    const t = String(raw || "");
    const pats = [
      /(?:Python|python|SQL|Bash|bash|MATLAB|Matlab|Perl|Julia|Java|C\+\+|SAS|Stata)\s*(?:,|\/|and|&|or)\s*R(?![A-Za-z0-9&])/,
      /(?<![A-Za-z0-9.&])R\s*(?:,|\/|and|or|&)\s*(?:Python|python|SQL|Bash|bash|MATLAB|Matlab|Perl|Bioconductor|RStudio)/,
      /(?<![A-Za-z0-9.&])R\s+(?:programming|language|scripting|scripts?|packages?|statistical|Shiny|environment|code)/i,
      /(?:languages?|programming|software|tools)\s*:\s*[^\n]*?(?<![A-Za-z0-9.&])R(?![A-Za-z0-9&'’.])/i,
      /\bin R\b(?!&)/,
    ];
    return pats.some((p) => p.test(t));
  }
  function countR(raw) {
    const t = String(raw || "");
    return hasR(t) ? 1 : 0;
  }

  function skillCount(skill, raw, nt) {
    let n = 0;
    for (const a of skill.a) n += countAlias(nt, a);
    if (skill.special === "R") n += countR(raw);
    return n;
  }
  function skillEvidence(skill, raw, nt) {
    for (const a of skill.a) if (countAlias(nt, a)) return a;
    if (skill.special === "R" && hasR(raw)) return "R";
    return null;
  }

  // ---------- Job description parsing ----------
  const REQ_HEAD = /(requirement|qualification|we expect|you have|you bring|must have|what we.?re looking for|what you need|your profile|profile|eligibility|who you are|we hope|we are looking|essential|edellytämme|vaatimukset|odotamme)/i;
  const PREF_HEAD = /(nice to have|advantage|advantageous|preferred|bonus|beneficial|desirable|desired|an asset|considered a plus|is a plus|are a plus|would be a plus|merit|meritorious|eduksi|katsotaan eduksi)/i;
  const OFFER_HEAD = /(we offer|what we offer|benefits|about us|about the company|who we are|our offer|tarjoamme|how to apply|application process|contact|further information|lisätietoja)/i;
  const REQ_LINE = /(required|requirement|must|essential|mandatory|necessary|minimum|at least|proven|solid|strong|demonstrated|edellytä|vaaditaan)/i;
  const TASK_HEAD = /(responsibilit|your tasks|your role|duties|you will|key tasks|job description|the role|main tasks|tehtäv)/i;

  function splitLines(text) {
    return String(text || "")
      .replace(/\r/g, "")
      .split(/\n|(?<=[.!?])\s+(?=[A-Z•\-•])/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  function isHeadingLine(line) {
    const l = line.trim();
    if (l.length > 70) return false;
    if (/[:：]\s*$/.test(l)) return true;
    if (!/[.!?]$/.test(l) && l.split(/\s+/).length <= 7) return true;
    return false;
  }

  function classifyJD(jd) {
    // returns array of {line, level} where level in req|pref|task|offer|neutral
    const out = [];
    let ctx = "neutral";
    for (const line of splitLines(jd)) {
      let level = ctx;
      if (isHeadingLine(line)) {
        if (PREF_HEAD.test(line)) ctx = "pref";
        else if (OFFER_HEAD.test(line)) ctx = "offer";
        else if (REQ_HEAD.test(line)) ctx = "req";
        else if (TASK_HEAD.test(line)) ctx = "task";
        level = ctx;
      }
      if (PREF_HEAD.test(line)) level = "pref";
      else if (REQ_LINE.test(line) && level !== "offer") level = "req";
      out.push({ line, level });
    }
    return out;
  }

  const LEVEL_W = { req: 3, task: 2, neutral: 2, pref: 1, offer: 0.5 };
  const LEVEL_RANK = { offer: 0, pref: 1, neutral: 2, task: 2, req: 3 };

  function extractJDKeywords(jd) {
    const lines = classifyJD(jd);
    const terms = new Map(); // key -> {name, skill, count, level, soft, extra}
    const add = (key, name, level, cnt, info) => {
      let t = terms.get(key);
      if (!t) { t = Object.assign({ key, name, count: 0, level }, info); terms.set(key, t); }
      t.count += cnt;
      if (LEVEL_RANK[level] > LEVEL_RANK[t.level]) t.level = level;
    };
    for (const { line, level } of lines) {
      if (line.length < 140 && /\b(faculty|department|school|institute|unit|centre|center|laboratory) of\b/i.test(line) && !/experience|knowledge|skills|degree/i.test(line)) continue;
      const nt = norm(line);
      for (const s of SKILLS) {
        const c = skillCount(s, line, nt);
        if (c) add("s:" + s.k, s.k, level, c, { skill: s, soft: !!s.soft, cat: s.c });
      }
    }
    // Extra terms: acronyms and repeated bigrams not covered by dictionary
    const covered = new Set();
    const aliasTokens = new Set();
    for (const s of SKILLS) for (const a of s.a) { const na = norm(a).trim(); covered.add(na); na.split(" ").forEach((w) => aliasTokens.add(w)); }
    const titleNorm = norm(guessTitle(jd)).trim();
    const rawAll = String(jd || "").replace(/#[\w-]+/g, " ");
    // Words that are always written with a capital letter in the ad (the company and other proper names) do not form keywords.
    const proper = new Set();
    { const cap = new Map(); (rawAll.match(/[A-Za-z][a-z]+/g) || []).forEach((w) => { const k = w.toLowerCase(); const c = cap.get(k) || [0, 0]; c[0]++; if (/^[A-Z]/.test(w)) c[1]++; cap.set(k, c); });
      for (const [k, [n, up]] of cap) if (n >= 3 && up === n && !aliasTokens.has(k)) proper.add(k); }
    const BOILER = new Set(["cutting", "edge", "ideas", "idea", "opportunity", "opportunities", "organization", "organisation", "team", "teams", "company", "environment", "culture", "career", "careers", "values", "employer", "patients", "customers", "people", "world", "future", "lives", "impact", "quality", "life", "difference", "growth", "excellence", "society", "well", "being", "home", "proud", "dynamic", "supportive", "unique", "innovative", "therapies"]);
    const levelOfText = (needleRe) => {
      let best = null;
      for (const { line, level } of lines) {
        needleRe.lastIndex = 0;
        if (needleRe.test(line)) { if (!best || LEVEL_RANK[level] > LEVEL_RANK[best]) best = level; }
      }
      return best || "neutral";
    };
    const acro = new Map();
    (rawAll.match(/(?<![A-Za-z0-9])[A-Z][A-Z0-9]{1,6}(?![A-Za-z0-9])/g) || []).forEach((a) => {
      if (ACRO_STOP.has(a) || /^\d+$/.test(a) || proper.has(a.toLowerCase())) return;
      if (covered.has(a.toLowerCase()) || aliasTokens.has(a.toLowerCase())) return;
      acro.set(a, (acro.get(a) || 0) + 1);
    });
    for (const [a, c] of acro) {
      const lvl = levelOfText(new RegExp("(?<![A-Za-z0-9])" + escRe(a) + "(?![A-Za-z0-9])"));
      add("x:" + a.toLowerCase(), a, lvl, c, { extra: true, alias: a.toLowerCase(), soft: false });
    }
    // bigrams
    const words = norm(rawAll).trim().split(" ");
    const bg = new Map();
    for (let i = 0; i < words.length - 1; i++) {
      const w1 = words[i], w2 = words[i + 1];
      if (STOP.has(w1) || STOP.has(w2) || w1.length < 3 || w2.length < 3 || /\d/.test(w1 + w2) || proper.has(w1) || proper.has(w2) || BOILER.has(w1) || BOILER.has(w2) || /&/.test(w1 + w2)) continue;
      const k = w1 + " " + w2;
      bg.set(k, (bg.get(k) || 0) + 1);
    }
    const already = (phrase) => {
      for (const t of terms.values()) {
        if (t.skill) { for (const a of t.skill.a) { const na = norm(a).trim(); if (na.includes(phrase) || phrase.includes(na)) return true; } }
      }
      return covered.has(phrase);
    };
    const bgs = [...bg.entries()].filter(([k, c]) => c >= 2 && !already(k) && !(titleNorm && titleNorm.includes(k))).sort((a, b) => b[1] - a[1]).slice(0, 10);
    for (const [k, c] of bgs) {
      const lvl = levelOfText(new RegExp(k.split(" ").map(escRe).join("[\\s\\-/]+"), "i"));
      add("x:" + k, k, lvl, c, { extra: true, alias: k, soft: false });
    }
    // weights
    for (const t of terms.values()) {
      let w = LEVEL_W[t.level] * (1 + 0.25 * Math.min(t.count - 1, 3));
      if (t.soft) w *= 0.5;
      if (t.extra) w *= 0.6;
      t.weight = Math.round(w * 100) / 100;
    }
    return { terms: [...terms.values()], lines };
  }

  // ---------- CV sections ----------
  const SECTION_DEFS = {
    summary: ["summary", "profile", "professional summary", "about me", "objective", "career objective", "personal profile", "personal statement"],
    experience: ["experience", "work experience", "professional experience", "employment", "employment history", "work history", "research experience", "career history", "positions", "professional background", "relevant experience", "laboratory experience", "industry experience", "academic experience", "internships", "internship"],
    education: ["education", "academic background", "educational background", "education and training", "academic qualifications", "degrees", "qualifications"],
    skills: ["skills", "technical skills", "core competencies", "competencies", "key skills", "expertise", "skills and tools", "tools", "technologies", "laboratory skills", "computational skills", "skill set", "areas of expertise", "methods", "techniques"],
    publications: ["publications", "selected publications", "peer reviewed publications", "papers", "articles"],
    projects: ["projects", "selected projects", "research projects", "personal projects"],
    certifications: ["certifications", "certificates", "courses", "training", "licenses"],
    languages: ["languages", "language skills"],
    awards: ["awards", "honors", "honours", "grants", "awards and honors", "scholarships", "funding"],
    references: ["references", "referees"],
  };
  // Any line that looks like a section heading (known or not). Used to bound sections safely.
  const HEAD_WORDS = new Set(("summary profile objective about me research interests interest education experience work professional employment history " +
    "academic research projects project publications publication presentations presentation conference conferences talks posters teaching supervision " +
    "mentoring courses course training certifications certificates licenses skills skill technical computational laboratory languages language awards " +
    "honors honours grants funding scholarships fellowships references referees volunteering volunteer activities memberships membership patents " +
    "selected key other additional relevant core competencies expertise tools technologies service leadership and of & internships internship " +
    "personal statement qualifications achievements interests hobbies outreach peer reviewed methods techniques background").split(/\s+/));
  const FILLER_HEAD = new Set(["and", "of", "&", "selected", "key", "other", "additional", "relevant", "core", "personal"]);
  function isHeadingLike(line) {
    const s = String(line || "").trim();
    if (!s || s.length > 45 || /\d/.test(s) || /[.:;,!?@]$/.test(s) || /@|https?:|www\./i.test(s) || /^[•\-*▪●◦·]/.test(s)) return false;
    if (/[A-Z]/.test(s) && s === s.toUpperCase() && s.replace(/[^A-Za-z]/g, "").length > 2) return true;
    const l = norm(s).trim().replace(/\s*&\s*/g, " and ");
    if (Object.values(SECTION_DEFS).some((heads) => heads.includes(l))) return true;
    const words = s.toLowerCase().replace(/&/g, " & ").split(/\s+/).filter(Boolean);
    return words.length > 0 && words.length <= 5 && words.every((w) => HEAD_WORDS.has(w)) && words.some((w) => !FILLER_HEAD.has(w));
  }
  // The body of the Summary/Profile section: from the line after the heading to the next heading-like line.
  // If that body is suspiciously long (headings not recognised), only its first paragraph counts.
  function summaryBody(cv) {
    const ls = String(cv || "").replace(/\r/g, "").split("\n");
    const sec = detectSections(cv);
    if (!sec.summary) return null;
    const start = sec.summary.start + 1;
    let end = start;
    while (end < sec.summary.end && !(end > start && isHeadingLike(ls[end]))) end++;
    const nonEmpty = ls.slice(start, end).filter((x) => x.trim()).length;
    if (nonEmpty > 6) {
      let e = start;
      while (e < end && !ls[e].trim()) e++;
      while (e < end && ls[e].trim()) e++;
      end = e;
    }
    return { start, end, text: ls.slice(start, end).join("\n").trim() };
  }

  function detectSections(cv) {
    const lines = String(cv || "").replace(/\r/g, "").split("\n");
    const found = {}; // name -> {start, end}
    const order = [];
    lines.forEach((line, i) => {
      const l = norm(line).trim().replace(/\s*&\s*/g, " and ");
      if (!l || l.length > 45) return;
      // A sentence or a bullet is not a heading, even if it ends with a heading word.
      if (/[.,;!?]\s*$/.test(line) || /^\s*[•\-*▪●◦·]\s/.test(line)) return;
      for (const [name, heads] of Object.entries(SECTION_DEFS)) {
        if (found[name]) continue;
        if (heads.some((h) => l === h || (l.startsWith(h + " ") && l.split(" ").length <= 5) || (l.endsWith(" " + h) && l.split(" ").length <= 4))) {
          found[name] = { start: i };
          order.push(name);
          break;
        }
      }
    });
    const sorted = order.map((n) => [n, found[n].start]).sort((a, b) => a[1] - b[1]);
    sorted.forEach(([n, s], idx) => {
      found[n].end = idx + 1 < sorted.length ? sorted[idx + 1][1] : lines.length;
      found[n].text = lines.slice(s + 1, found[n].end).join("\n");
    });
    return found;
  }

  // ---------- Dates / experience ----------
  const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
  function parseDatePart(s, isEnd, now) {
    s = s.trim().toLowerCase();
    if (/^(present|current|now|ongoing|today|to date|nykyään)$/.test(s)) return now;
    let m = s.match(/^([a-z]{3,9})\.?\s+(\d{4})$/);
    if (m && MONTHS[m[1].slice(0, 4) === "sept" ? "sept" : m[1].slice(0, 3)]) return Number(m[2]) * 12 + (MONTHS[m[1].slice(0, 3)] - 1);
    m = s.match(/^(\d{1,2})[\/.](\d{4})$/);
    if (m && +m[1] >= 1 && +m[1] <= 12) return Number(m[2]) * 12 + (+m[1] - 1);
    m = s.match(/^(\d{4})[\/.\-](\d{1,2})$/);
    if (m && +m[2] >= 1 && +m[2] <= 12) return Number(m[1]) * 12 + (+m[2] - 1);
    m = s.match(/^(\d{4})$/);
    if (m) return Number(m[1]) * 12 + (isEnd ? 11 : 0);
    return null;
  }
  const MON = "(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)";
  const DP = "(?:(?:" + MON + "\\.?\\s+\\d{4})|(?:\\d{1,2}[\\/.]\\d{4})|(?:\\d{4}[\\/.]\\d{1,2})|(?:\\d{4}))";
  const PRESENT = "[Pp]resent|[Cc]urrent|[Nn]ow|[Oo]ngoing|[Tt]oday|PRESENT";
  const RANGE_RE = new RegExp("(?<![A-Za-z0-9])(" + DP + ")\\s*(?:-|–|—|to|until|till)\\s*(" + DP + "|" + PRESENT + ")(?![0-9])", "gi");
  function dateFmt(s) {
    s = s.trim();
    if (/^(present|current|now|ongoing|today)$/i.test(s)) return "present";
    if (/^[A-Za-z]/.test(s)) return "mon";
    if (/^\d{4}$/.test(s)) return "year";
    return "num";
  }
  function nowMonth(nowDate) { const n = nowDate || new Date(); return n.getFullYear() * 12 + n.getMonth(); }
  // All date ranges in a text, with their formats. Invalid ones are kept and flagged.
  function parseRanges(text, nowDate) {
    const nowM = nowMonth(nowDate);
    const t = String(text || "").replace(/[‐-―−]/g, "-").replace(/[0-9X]+(?:-[0-9X]+){2,}/g, " ");
    const out = [];
    let m;
    RANGE_RE.lastIndex = 0;
    while ((m = RANGE_RE.exec(t))) {
      const a = parseDatePart(m[1], false, nowM), b = parseDatePart(m[2], true, nowM);
      if (a == null || b == null || a / 12 < 1950) continue;
      out.push({ raw: m[0].trim(), start: a, end: b, fmtA: dateFmt(m[1]), fmtB: dateFmt(m[2]), inverted: b < a && dateFmt(m[2]) !== "present", future: a > nowM + 1 || (dateFmt(m[2]) !== "present" && b > nowM + 1 && b - nowM > 11) });
    }
    return out;
  }
  function mergeIntervals(ivs) {
    const s2 = ivs.map((x) => [x[0], x[1]]).sort((x, y) => x[0] - y[0]);
    const out = [];
    for (const iv of s2) {
      const last = out[out.length - 1];
      if (last && iv[0] <= last[1] + 1) last[1] = Math.max(last[1], iv[1]);
      else out.push(iv);
    }
    return out;
  }
  function experienceMonths(text, nowDate) {
    const nowM = nowMonth(nowDate);
    const ivs = parseRanges(text, nowDate).filter((r) => !r.inverted && !r.future).map((r) => [r.start, Math.min(r.end, nowM)]);
    const merged = mergeIntervals(ivs);
    return { months: merged.reduce((a, iv) => a + iv[1] - iv[0] + 1, 0), ranges: ivs.length };
  }
  const MN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const fmtM = (m) => MN[m % 12] + " " + Math.floor(m / 12);
  // Date consistency: inverted or future ranges, mixed formats, unexplained gaps.
  function dateConsistency(cv, sections, nowDate, lang) {
    if (lang) LANG = lang === "en" ? "en" : "fa";
    const nowM = nowMonth(nowDate);
    const expText = sections.experience ? sections.experience.text : "";
    const eduText = sections.education ? sections.education.text : "";
    const exp = parseRanges(expText, nowDate);
    const all = parseRanges(cv, nowDate);
    if (!all.length) return { score: null, issues: [], detail: tr("هیچ بازه تاریخی در رزومه پیدا نشد", "No date ranges found in the CV") };
    const issues = [];
    let pen = 0;
    if (sections.experience && !exp.length) { pen += 40; issues.push(tr("بخش Experience بازه تاریخ قابل‌خواندن ندارد", "The Experience section has no readable date ranges")); }
    const inv = all.filter((r) => r.inverted);
    if (inv.length) { pen += Math.min(50, 25 * inv.length); issues.push(tr("تاریخ پایان قبل از شروع: ", "End date before start date: ") + inv.map((r) => q(r.raw)).join(J())); }
    const fut = all.filter((r) => r.future);
    if (fut.length) { pen += 25; issues.push(tr("تاریخ در آینده: ", "Date in the future: ") + fut.map((r) => q(r.raw)).join(J())); }
    const fmts = new Set();
    exp.forEach((r) => [r.fmtA, r.fmtB].forEach((f) => { if (f !== "present") fmts.add(f); }));
    if (fmts.has("mon") && fmts.has("num")) { pen += 15; issues.push(tr("در بخش Experience دو قالب تاریخ مختلف آمده (مثلاً «Jan 2020» و «01/2020»)؛ یکی را انتخاب کنید", "The Experience section mixes two date formats (e.g. \u201cJan 2020\u201d and \u201c01/2020\u201d); pick one")); }
    else if (fmts.has("year") && (fmts.has("mon") || fmts.has("num"))) { pen += 10; issues.push(tr("در بخش Experience بعضی تاریخ‌ها با ماه و بعضی فقط با سال آمده‌اند؛ یکدست کنید", "In the Experience section some dates have months and some only years; make them consistent")); }
    // Gaps: education periods count as covered time.
    const cover = mergeIntervals(parseRanges(expText + "\n" + eduText, nowDate).filter((r) => !r.inverted && !r.future).map((r) => [r.start, Math.min(r.end, nowM)]));
    const gaps = [];
    for (let i = 1; i < cover.length; i++) {
      const g = cover[i][0] - cover[i - 1][1] - 1;
      if (g > 6 && cover[i][0] >= nowM - 120) gaps.push([cover[i - 1][1] + 1, cover[i][0] - 1, g]);
    }
    if (cover.length && exp.length) {
      const tail = nowM - cover[cover.length - 1][1];
      if (tail > 6) gaps.push([cover[cover.length - 1][1] + 1, nowM, tail]);
    }
    if (gaps.length) { pen += Math.min(30, 10 * gaps.length); issues.push(tr("فاصله بیش از ۶ ماه بدون توضیح: ", "Unexplained gap of more than 6 months: ") + gaps.map((g) => fmtM(g[0]) + tr(" تا ", " to ") + fmtM(g[1]) + " (" + g[2] + tr(" ماه)", " months)")).join(J()) + tr(". اگر دلیلی دارد (دوره، مهاجرت، پروژه شخصی)، یک خط برایش بنویسید.", ". If there is a reason (course, relocation, personal project), add a line for it.")); }
    const score = Math.max(0, 100 - pen);
    return { score, issues, detail: issues.length ? issues.join(SEP()) : tr(`${all.length} بازه تاریخ بررسی شد؛ مشکلی پیدا نشد`, `${all.length} date ranges checked; no problems found`) };
  }
  function jdYears(jd) {
    const t = String(jd || "").replace(/[‐-―−]/g, "-");
    const re = /(?:(?:at least|minimum(?: of)?|min\.?|over|more than)\s+)?(\d{1,2}|one|two|three|four|five|six|seven|eight|ten)\s*(?:\+|or more)?\s*(?:(?:-|to)\s*(\d{1,2})\s*)?\+?\s*years?(?:'|’)?\s*(?:of\s+)?([^.\n]{0,60})/gi;
    const words = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, ten: 10 };
    let m, best = null;
    while ((m = re.exec(t))) {
      const ctx = (m[3] || "") + " " + t.slice(Math.max(0, m.index - 40), m.index);
      if (!/experience|work|industry|laboratory|lab|professional|postdoc|kokemus/i.test(ctx)) continue;
      if (/contract|position is|duration|fixed.term|appointment|funded for|period/i.test(ctx)) continue;
      const n = isNaN(+m[1]) ? words[m[1].toLowerCase()] : +m[1];
      if (n && n <= 20 && (best == null || n < best.years)) best = { years: n, text: m[0].trim() };
    }
    return best;
  }

  // ---------- Education ----------
  const EDU = [
    { lvl: 3, name: "PhD", re: /(?<![a-z])(phd|doctoral degree|doctorate|doctor of philosophy|d\.?phil|dr\.?\s?rer|tohtorin tutkinto)(?![a-z])/i },
    { lvl: 2, name: "Master's", re: /(?<![a-z])(master'?s?|msc|m\.sc|m\.s\.|mba|meng|maisterin|diplomi.?insinööri|dipl\.?\s?ing)(?![a-z])/i },
    { lvl: 1, name: "Bachelor's", re: /(?<![a-z])(bachelor'?s?|bsc|b\.sc|b\.s\.|beng|kandidaatin|amk|university of applied sciences degree)(?![a-z])/i },
  ];
  function eduLevels(text) {
    const t = String(text || "").replace(/ph\.d\.?/gi, "phd");
    return EDU.filter((e) => e.re.test(t));
  }
  function jdEducation(jd) {
    const lv = eduLevels(jd);
    if (!lv.length) return null;
    // Requirement = lowest level mentioned (e.g. "MSc or PhD")
    const min = lv.reduce((a, b) => (a.lvl < b.lvl ? a : b));
    // field words after "degree in"
    const m = String(jd).match(/(?:degree|msc|master'?s?|phd|bachelor'?s?|background)\s+(?:degree\s+)?in\s+([^.\n;]{3,120})/i);
    let fields = [];
    if (m) fields = norm(m[1]).trim().split(" ").filter((w) => w.length > 3 && !STOP.has(w) && !["related", "similar", "equivalent", "suitable", "field", "fields", "discipline", "sciences", "science", "relevant", "appropriate"].includes(w)).slice(0, 8);
    return { level: min.lvl, name: min.name, fields, phrase: m ? m[0].trim() : "" };
  }

  // ---------- Contact and format ----------
  function contactInfo(cv) {
    const t = String(cv || "");
    return {
      email: /[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/.test(t),
      phone: /(?:\+\d{1,3}[\s\-]?)?(?:\(?\d{2,4}\)?[\s\-]?){2,4}\d{2,4}/.test(t.replace(/\b(19|20)\d{2}\s*[-–]\s*(19|20)\d{2}\b/g, "")) && /(\+\d{6,}|\+\d{1,3}[\s\-]?\d|phone|tel|mobile|puh)/i.test(t),
      linkedin: /linkedin\.com\//i.test(t),
      github: /github\.com\//i.test(t),
    };
  }

  // ---------- Main scoring ----------
  function score(cvText, jdText, opts) {
    opts = opts || {};
    LANG = opts.lang === "en" ? "en" : "fa";
    const cv = String(cvText || "");
    const jd = String(jdText || "");
    const ncv = norm(cv);
    const sections = detectSections(cv);
    const words = cv.split(/\s+/).filter(Boolean).length;
    const result = { components: {}, warnings: [], knockouts: [], tips: [] };

    // 1. Keywords
    const { terms } = extractJDKeywords(jd);
    let wTot = 0, wHit = 0;
    const kw = terms.map((t) => {
      let cvCount = 0, ev = null;
      if (t.skill) { cvCount = skillCount(t.skill, cv, ncv); ev = skillEvidence(t.skill, cv, ncv); }
      else { cvCount = countAlias(ncv, t.alias); ev = cvCount ? t.alias : null; }
      const inSkills = sections.skills ? (t.skill ? skillCount(t.skill, sections.skills.text, norm(sections.skills.text)) > 0 : countAlias(norm(sections.skills.text), t.alias) > 0) : false;
      const hit = cvCount > 0;
      wTot += t.weight; if (hit) wHit += t.weight;
      return Object.assign({}, t, { cvCount, hit, evidence: ev, inSkills });
    }).sort((a, b) => b.weight - a.weight || b.count - a.count);
    const hard = kw.filter((k) => !k.soft), soft = kw.filter((k) => k.soft);
    result.keywords = kw;
    result.components.keywords = {
      label: tr("تطابق کلمات کلیدی", "Keyword match"),
      weight: 50,
      score: wTot ? Math.round((wHit / wTot) * 100) : null,
      detail: kw.length ? tr(`${kw.filter((k) => k.hit).length} از ${kw.length} کلمه کلیدی آگهی در رزومه پیدا شد (سخت: ${hard.filter((k) => k.hit).length}/${hard.length}، نرم: ${soft.filter((k) => k.hit).length}/${soft.length})`, `${kw.filter((k) => k.hit).length} of ${kw.length} job ad keywords found in the CV (hard: ${hard.filter((k) => k.hit).length}/${hard.length}, soft: ${soft.filter((k) => k.hit).length}/${soft.length})`) : tr("کلمه کلیدی قابل تشخیصی در آگهی پیدا نشد", "No recognisable keywords found in the job ad"),
    };
    const reqMissing = kw.filter((k) => !k.hit && k.level === "req" && !k.soft);
    if (reqMissing.length) result.tips.push(tr("مهارت‌های «الزامی» که در رزومه نیست: ", "\u201cRequired\u201d skills missing from the CV: ") + reqMissing.slice(0, 8).map((k) => k.name).join(J()) + tr(". اگر واقعاً این تجربه را دارید، با همان عبارتی که آگهی استفاده کرده در رزومه بیاورید.", ". If you really have this experience, use the same wording as the job ad."));
    const hitNotInSkills = kw.filter((k) => k.hit && !k.soft && !k.inSkills && sections.skills).slice(0, 6);
    if (hitNotInSkills.length) result.tips.push(tr("این مهارت‌ها در رزومه هست ولی در بخش Skills نیامده: ", "These skills are in the CV but not in the Skills section: ") + hitNotInSkills.map((k) => k.name).join(J()) + tr(". بعضی ATSها بخش Skills را جدا می‌خوانند.", ". Some ATSs read the Skills section separately."));

    // 2. Job title
    const title = (opts.title || "").trim() || guessTitle(jd);
    if (title) {
      const nt = norm(title).trim();
      const sig = nt.split(" ").filter((w) => w.length > 2 && !STOP.has(w) && !["senior", "junior", "lead", "trainee", "intern", "assistant", "associate", "and", "for", "the"].includes(w));
      let s;
      if (countAlias(ncv, nt)) s = 100;
      else if (sig.length) { const h = sig.filter((w) => countAlias(ncv, w)).length; s = Math.round((h / sig.length) * 70); }
      else s = null;
      const th = sig.filter((w) => countAlias(ncv, w)).length;
      result.components.title = { label: tr("عنوان شغلی", "Job title"), weight: 10, score: s, detail: tr("عنوان: ", "Title: ") + q(title) + (s === 100 ? tr(" دقیقاً در رزومه آمده", " appears verbatim in the CV") : s != null ? tr(`؛ ${th} از ${sig.length} واژه اصلی عنوان در رزومه هست`, `; ${th} of ${sig.length} key title words are in the CV`) : "") };
      if (s != null && s < 100) result.tips.push(tr(`عنوان «${title}» عیناً در رزومه نیست. اگر با واقعیت جور است، آن را در خلاصه بالای رزومه بیاورید (مثلاً «… with experience as/aiming for ${title}»).`, `The title \u201c${title}\u201d is not in the CV verbatim. If it is accurate, put it in the summary at the top (e.g. \u201c\u2026 aiming for a ${title} role\u201d).`));
    } else result.components.title = { label: tr("عنوان شغلی", "Job title"), weight: 10, score: null, detail: tr("عنوان شغلی مشخص نشد؛ آن را در کادر عنوان وارد کنید", "Job title not detected; enter it in the title box") };

    // 3. Education
    const je = jdEducation(jd);
    if (je) {
      const eduText = sections.education ? sections.education.text : cv;
      const cl = eduLevels(eduText);
      const cvMax = cl.length ? Math.max(...cl.map((e) => e.lvl)) : 0;
      let s = cvMax >= je.level ? 100 : cvMax === je.level - 1 ? 50 : 0;
      let fieldNote = "";
      if (je.fields.length) {
        const fh = je.fields.filter((w) => countAlias(ncv, w));
        fieldNote = tr(`؛ رشته: ${fh.length} از ${je.fields.length} واژه («${je.fields.join(", ")}») در رزومه هست`, `; field: ${fh.length} of ${je.fields.length} words (\u201c${je.fields.join(", ")}\u201d) are in the CV`);
        s = Math.round(s * 0.8 + (fh.length ? 20 : 0));
      }
      const cvDeg = cvMax ? EDU.find((e) => e.lvl === cvMax).name : tr("پیدا نشد", "not found");
      result.components.education = { label: tr("مدرک تحصیلی", "Education"), weight: 10, score: s, detail: tr(`آگهی حداقل ${je.name} می‌خواهد؛ بالاترین مدرک تشخیص‌داده‌شده در رزومه: ${cvDeg}`, `The ad asks for at least a ${je.name}; highest degree detected in the CV: ${cvDeg}`) + fieldNote };
    } else result.components.education = { label: tr("مدرک تحصیلی", "Education"), weight: 10, score: null, detail: tr("آگهی شرط مدرک مشخصی ندارد", "The ad sets no specific degree requirement") };

    // 4. Experience years
    const jy = jdYears(jd);
    if (jy) {
      const src = sections.experience ? sections.experience.text : null;
      if (src) {
        const em = experienceMonths(src, opts.now);
        if (em.ranges) {
          const yrs = em.months / 12;
          const s = Math.min(100, Math.round((yrs / jy.years) * 100));
          result.components.experience = { label: tr("سابقه کار", "Experience"), weight: 10, score: s, detail: tr(`آگهی: «${jy.text}». سابقه محاسبه‌شده از بخش Experience: حدود ${yrs.toFixed(1)} سال (${em.ranges} بازه تاریخ)`, `Ad: \u201c${jy.text}\u201d. Experience computed from the Experience section: about ${yrs.toFixed(1)} years (${em.ranges} date ranges)`) };
        } else {
          result.components.experience = { label: tr("سابقه کار", "Experience"), weight: 10, score: null, detail: tr(`آگهی ${jy.years} سال سابقه می‌خواهد ولی در بخش Experience بازه تاریخی قابل خواندن پیدا نشد`, `The ad asks for ${jy.years} years but no readable date ranges were found in the Experience section`) };
          result.warnings.push(tr("تاریخ‌های بخش Experience خوانده نشد. از قالب «Jan 2022 – Present» یا «2021 – 2023» استفاده کنید.", "Dates in the Experience section could not be read. Use a format like \u201cJan 2022 \u2013 Present\u201d or \u201c2021 \u2013 2023\u201d."));
        }
      } else {
        result.components.experience = { label: tr("سابقه کار", "Experience"), weight: 10, score: null, detail: tr(`آگهی ${jy.years} سال سابقه می‌خواهد ولی بخش Experience در رزومه تشخیص داده نشد`, `The ad asks for ${jy.years} years but no Experience section was detected in the CV`) };
      }
    } else result.components.experience = { label: tr("سابقه کار", "Experience"), weight: 10, score: null, detail: tr("آگهی تعداد سال سابقه مشخصی نخواسته", "The ad does not ask for a specific number of years") };

    // 5. Languages
    const njd = norm(jd);
    const jl = LANGS.filter((l) => l.a.some((a) => countAlias(njd, a)));
    if (jl.length) {
      const hits = jl.filter((l) => l.a.some((a) => countAlias(ncv, a)));
      const s = Math.round((hits.length / jl.length) * 100);
      result.components.languages = { label: tr("زبان", "Languages"), weight: 10, score: s, detail: tr("زبان‌های آگهی: ", "Languages in the ad: ") + jl.map((l) => l.k).join(J()) + tr("؛ در رزومه: ", "; in the CV: ") + (hits.map((l) => l.k).join(J()) || tr("هیچ‌کدام", "none")) };
      jl.filter((l) => !hits.includes(l)).forEach((l) => {
        const lineHit = classifyJD(jd).find((x) => l.a.some((a) => countAlias(norm(x.line), a)));
        const lvl = lineHit ? lineHit.level : "neutral";
        if (lvl === "pref") result.tips.push(tr(`زبان ${l.k} در آگهی «امتیاز» حساب شده و در رزومه نیست.`, `${l.k} is listed as an advantage in the ad and is not in the CV.`));
      });
      if (!sections.languages) result.tips.push(tr("بخش جداگانه Languages با سطح هر زبان (مثلاً CEFR) خواندن را برای ATS و رکروتر راحت‌تر می‌کند.", "A separate Languages section with a level for each language (e.g. CEFR) is easier for ATSs and recruiters to read."));
    } else result.components.languages = { label: tr("زبان", "Languages"), weight: 10, score: null, detail: tr("آگهی شرط زبانی ندارد", "The ad has no language requirement") };

    // 6. Date consistency
    const dc = dateConsistency(cv, sections, opts.now);
    result.components.dates = { label: tr("سازگاری تاریخ‌ها", "Date consistency"), weight: 10, score: dc.score, detail: dc.detail };
    result.dateIssues = dc.issues;

    // 7. Format and parseability
    let f = 100;
    const fNotes = [];
    const ci = contactInfo(cv);
    if (!sections.experience) { f -= 20; fNotes.push(tr("سرفصل Experience پیدا نشد", "No Experience heading found")); }
    if (!sections.education) { f -= 15; fNotes.push(tr("سرفصل Education پیدا نشد", "No Education heading found")); }
    if (!sections.skills) { f -= 15; fNotes.push(tr("سرفصل Skills پیدا نشد", "No Skills heading found")); }
    if (!ci.email) { f -= 15; fNotes.push(tr("ایمیل پیدا نشد", "No email found")); }
    if (!ci.phone) { f -= 5; fNotes.push(tr("شماره تلفن پیدا نشد", "No phone number found")); }
    if (words < 200) { f -= 15; fNotes.push(tr(`متن رزومه خیلی کوتاه است (${words} کلمه)`, `CV text is very short (${words} words)`)); }
    const pf = opts.parse || {};
    if (pf.emptyText) { f = 0; fNotes.unshift(tr("از فایل تقریباً متنی استخراج نشد؛ احتمالاً PDF تصویری/اسکن است و ATS آن را نمی‌خواند", "Almost no text could be extracted; the PDF is probably an image/scan that an ATS cannot read")); }
    if (pf.iconGlyphs) { f -= 5; fNotes.push(tr(`${pf.iconGlyphs} نماد آیکونی/ناشناخته در متن استخراج‌شده`, `${pf.iconGlyphs} icon/unknown glyphs in the extracted text`)); }
    if (pf.multiColumn) { f -= 10; fNotes.push(tr("احتمال چیدمان چندستونی (ترتیب متن ممکن است در ATS به هم بریزد)", "Possible multi-column layout (text order may get scrambled in an ATS)")); }
    if (pf.tables) { f -= 10; fNotes.push(tr(`${pf.tables} جدول در فایل Word`, `${pf.tables} table(s) in the Word file`)); }
    if (pf.textBoxesSuspect) { f -= 5; fNotes.push(tr("احتمال تکست‌باکس یا سربرگ", "Possible text box or header")); }
    f = Math.max(0, f);
    result.components.format = { label: tr("ساختار و خوانایی برای ATS", "Structure and ATS readability"), weight: 10, score: f, detail: fNotes.length ? fNotes.join(SEP()) : tr("سرفصل‌های استاندارد، ایمیل و تلفن پیدا شد", "Standard headings, email and phone found") };
    fNotes.forEach((n) => result.warnings.push(n));
    result.sections = Object.keys(sections);
    result.contact = ci;
    result.words = words;

    // Overall
    let num = 0, den = 0;
    for (const c of Object.values(result.components)) if (c.score != null) { num += c.score * c.weight; den += c.weight; }
    result.overall = den ? Math.round(num / den) : 0;
    if (pf.emptyText) result.overall = Math.min(result.overall, 10);

    // Knockout gate: pass / fail / unknown, kept separate from the score
    result.gate = buildGate(cv, jd, sections, ncv, opts);
    result.knockouts = result.gate.filter((g) => g.status === "fail").map((g) => g.label + ": " + g.note);
    return result;
  }

  // ---------- Knockout gate ----------
  function buildGate(cv, jd, sections, ncv, opts) {
    const gate = [];
    const lines = classifyJD(jd);
    const ev = (re) => { const m = String(cv).match(re); return m ? m[0].trim().slice(0, 80) : ""; };
    // Languages required (not "advantage")
    const njd = norm(jd);
    const hasLangInfo = !!sections.languages || LANGS.some((l) => l.a.some((a) => countAlias(ncv, a)));
    LANGS.filter((l) => l.a.some((a) => countAlias(njd, a))).forEach((l) => {
      const lh = lines.find((x) => l.a.some((a) => countAlias(norm(x.line), a)));
      if (lh && (lh.level === "pref" || lh.level === "offer")) return;
      const req = lh ? lh.line.trim().slice(0, 120) : l.k;
      const has = l.a.some((a) => countAlias(ncv, a));
      if (has) gate.push({ key: "lang:" + l.k, label: tr("زبان ", "Language: ") + l.k, requirement: req, status: "pass", evidence: ev(new RegExp("[^\\n]*\\b(" + l.a.map(escRe).join("|") + ")\\b[^\\n]*", "i")), note: tr("در رزومه آمده", "Listed in the CV") });
      else gate.push({ key: "lang:" + l.k, label: tr("زبان ", "Language: ") + l.k, requirement: req, status: hasLangInfo ? "fail" : "unknown", evidence: "", note: hasLangInfo ? tr(`در فهرست زبان‌های رزومه نیست. اگر در هر سطحی بلدید، با سطحش بنویسید (مثلاً «${l.k}: A2»).`, `Not in the CV's language list. If you know it at any level, add it with the level (e.g. \u201c${l.k}: A2\u201d).`) : tr("رزومه اطلاعات زبانی ندارد؛ بخش Languages اضافه کنید.", "The CV has no language information; add a Languages section.") });
    });
    // Degree
    const je = jdEducation(jd);
    if (je) {
      const cl = eduLevels(sections.education ? sections.education.text : cv);
      const cvMax = cl.length ? Math.max(...cl.map((e) => e.lvl)) : 0;
      const req = je.phrase || (tr("حداقل ", "at least ") + je.name);
      if (!cvMax) gate.push({ key: "degree", label: tr("مدرک تحصیلی", "Degree"), requirement: req, status: "unknown", evidence: "", note: tr("مدرکی در رزومه تشخیص داده نشد؛ عنوان مدرک را واضح بنویسید (مثلاً «MSc in …»).", "No degree detected in the CV; state the degree clearly (e.g. \u201cMSc in \u2026\u201d).") });
      else gate.push({ key: "degree", label: tr("مدرک تحصیلی", "Degree"), requirement: req, status: cvMax >= je.level ? "pass" : "fail", evidence: ev(EDU.find((e) => e.lvl === cvMax).re), note: cvMax >= je.level ? tr("سطح مدرک کافی است", "Degree level is sufficient") : tr(`آگهی ${je.name} می‌خواهد و بالاترین مدرک رزومه پایین‌تر است.`, `The ad asks for a ${je.name} and the highest degree in the CV is lower.`) });
    }
    // Years of experience
    const jy = jdYears(jd);
    if (jy) {
      const em = sections.experience ? experienceMonths(sections.experience.text, opts.now) : { ranges: 0 };
      if (!em.ranges) gate.push({ key: "years", label: tr("سال‌های سابقه", "Years of experience"), requirement: jy.text, status: "unknown", evidence: "", note: tr("از بخش Experience تاریخ قابل‌خواندنی پیدا نشد.", "No readable dates found in the Experience section.") });
      else { const y = em.months / 12; gate.push({ key: "years", label: tr("سال‌های سابقه", "Years of experience"), requirement: jy.text, status: y >= jy.years ? "pass" : "fail", evidence: tr(`حدود ${y.toFixed(1)} سال از ${em.ranges} بازه تاریخ`, `about ${y.toFixed(1)} years from ${em.ranges} date ranges`), note: y >= jy.years ? tr("کافی است", "Sufficient") : tr(`حدود ${y.toFixed(1)} سال محاسبه شد؛ اگر سابقه مرتبط دیگری دارید (پروژه، کارآموزی، پایان‌نامه آزمایشگاهی) با تاریخ بیاورید.`, `About ${y.toFixed(1)} years computed; if you have other relevant experience (projects, internships, lab thesis), add it with dates.`) }); }
    }
    // Work permit
    if (/work permit|right to work|residence permit|eligible to work|työlupa|oleskelulupa/i.test(jd)) {
      const e = ev(/[^\n]*(work permit|residence permit|right to work|eu citizen|permanent residen|oleskelulupa|työlupa)[^\n]*/i);
      gate.push({ key: "permit", label: tr("مجوز کار", "Work permit"), requirement: (lines.find((x) => /permit|right to work|eligible to work|lupa/i.test(x.line)) || { line: "work permit" }).line.trim().slice(0, 120), status: e ? "pass" : "unknown", evidence: e, note: e ? tr("در رزومه ذکر شده", "Mentioned in the CV") : tr("در رزومه ذکر نشده؛ معمولاً یک سؤال حذفی در فرم اپلای است. پاسخ فرم را دقیق بدهید و در صورت تمایل یک خط در رزومه بیاورید.", "Not mentioned in the CV; this is usually a knockout question in the application form. Answer it accurately and optionally add a line to the CV.") });
    }
    // Driving licence
    if (/driv(?:er'?s|ing) licen[cs]e|ajokortti/i.test(jd)) {
      const e = ev(/[^\n]*(driv(?:er'?s|ing) licen[cs]e|ajokortti)[^\n]*/i);
      gate.push({ key: "licence", label: tr("گواهینامه رانندگی", "Driving licence"), requirement: "driving licence", status: e ? "pass" : "unknown", evidence: e, note: e ? tr("در رزومه ذکر شده", "Mentioned in the CV") : tr("در رزومه ذکر نشده؛ اگر دارید اضافه کنید.", "Not mentioned in the CV; add it if you have one.") });
    }
    return gate;
  }

  // ---------- Improve mode helpers ----------
  // Number the non-empty CV lines so suggestions can cite them (L1, L2, ...).
  function cvLines(cv) {
    const raw = String(cv || "").replace(/\r/g, "").split("\n");
    const out = [];
    raw.forEach((t, i) => { if (t.trim()) out.push({ id: "L" + (out.length + 1), text: t.trim(), index: i }); });
    return out;
  }
  const NUM_RE = /\d+(?:[.,]\d+)?\s?%?/g;
  const SENIOR_RE = /\b(led|lead|leading|managed|managing|supervised|supervising|headed|spearheaded|directed|oversaw|owned|coordinated|mentored|trained)\b/gi;
  // A suggestion is accepted only if its numbers, known skills and acronyms all appear in its cited sources.
  function validateSuggestion(text, sourceTexts, lang) {
    if (lang) LANG = lang === "en" ? "en" : "fa";
    const errors = [], warnings = [];
    const src = sourceTexts.join("\n");
    const nsrc = norm(src);
    const ntext = norm(text);
    if (!sourceTexts.length) errors.push(tr("بدون منبع", "no sources"));
    const nums = (String(text).match(NUM_RE) || []).map((x) => x.replace(/\s/g, ""));
    const srcNums = new Set((src.match(NUM_RE) || []).map((x) => x.replace(/\s/g, "").replace(",", ".")));
    nums.forEach((n) => { if (!srcNums.has(n.replace(",", "."))) errors.push(tr(`عدد «${n}» در منبع نیست`, `number \u201c${n}\u201d is not in the sources`)); });
    for (const sk of SKILLS) {
      if (skillCount(sk, text, ntext) > 0 && skillCount(sk, src, nsrc) === 0) errors.push(tr(`«${sk.k}» در منبع نیست`, `\u201c${sk.k}\u201d is not in the sources`));
    }
    const srcLower = src.toLowerCase();
    const acr = new Set(String(text).match(/(?<![A-Za-z0-9])[A-Z][A-Z0-9]{1,}(?:-[A-Z0-9]+)?(?![a-z0-9])/g) || []);
    acr.forEach((a) => { if (!srcLower.includes(a.toLowerCase())) errors.push(tr(`«${a}» در منبع نیست`, `\u201c${a}\u201d is not in the sources`)); });
    const SENIOR = SENIOR_RE;
    (String(text).match(SENIOR) || []).forEach((w) => { if (!new RegExp("\\b" + w + "\\b", "i").test(src)) warnings.push(tr(`«${w}» نقش یا مسئولیتی را نشان می‌دهد که در منبع نیامده؛ فقط اگر واقعاً درست است نگه دارید`, `\u201c${w}\u201d implies a role or responsibility the source does not state; keep it only if it is true`)); });
    const words = String(text).replace(/^[\s•\-*]+/, "").split(/\s+/);
    words.forEach((w, i) => {
      const c = w.replace(/[^A-Za-z\-]/g, "");
      if (i === 0 || c.length < 3 || !/^[A-Z][a-z]/.test(c)) return;
      if (/[.!?:]$/.test(words[i - 1] || "")) return;
      if (!srcLower.includes(c.toLowerCase())) warnings.push(tr(`«${c}» در منبع نیست؛ بررسی کنید`, `\u201c${c}\u201d is not in the sources; check it`));
    });
    return { ok: errors.length === 0, errors: [...new Set(errors)], warnings: [...new Set(warnings)] };
  }
  // Details in an original line that a rewrite drops: numbers, known skills, acronyms and names.
  function lostDetails(original, rewritten) {
    const o = String(original || ""), r = String(rewritten || "");
    const no = norm(o), nr = norm(r), rl = r.toLowerCase().replace(/[‐-―−]/g, "-");
    const lost = [];
    const rNums = new Set((r.match(NUM_RE) || []).map((x) => x.replace(/\s/g, "").replace(",", ".").replace("%", "")));
    (o.match(NUM_RE) || []).forEach((n) => { const k = n.replace(/\s/g, "").replace(",", ".").replace("%", ""); if (!rNums.has(k)) lost.push(n.trim()); });
    for (const sk of SKILLS) if (skillCount(sk, o, no) > 0 && skillCount(sk, r, nr) === 0) lost.push(sk.k);
    (o.match(/(?<![A-Za-z0-9])[A-Z][A-Za-z0-9]*[A-Z][A-Za-z0-9]*(?:-[A-Za-z0-9]+)?(?![a-z0-9])/g) || []).forEach((a) => { if (!rl.includes(a.toLowerCase())) lost.push(a); });
    const words = o.replace(/^[\s•\-*▪●◦·]+/, "").split(/\s+/);
    words.forEach((w, i) => {
      const c = w.replace(/[^A-Za-zÀ-ž\-]/g, "");
      if (i === 0 || c.length < 3 || !/^[A-ZÀ-Þ][a-zß-ÿ]/.test(c) || /[.!?:]$/.test(words[i - 1] || "")) return;
      if (!rl.includes(c.toLowerCase())) lost.push(c);
    });
    return [...new Set(lost)];
  }
  // Lines that must never be replaced by a rewritten bullet: headings, title/date lines and the header block.
  function isReplaceable(cv, lineIndex) {
    const ls = String(cv || "").replace(/\r/g, "").split("\n");
    const t = ls[lineIndex];
    if (t == null || !t.trim() || isHeadingLike(t) || parseRanges(t).length) return false;
    const firstHead = ls.findIndex((x, i) => i > 0 && isHeadingLike(x));
    return firstHead >= 0 && lineIndex > firstHead;
  }
  // Extra checks for an improvement suggestion so that nothing from the CV is lost.
  function checkPreserved(cv, item, lang) {
    if (lang) LANG = lang === "en" ? "en" : "fa";
    const errors = [];
    if (item.kind === "bullet" && item.replaces) {
      const l = cvLines(cv).find((x) => x.id === item.replaces);
      if (!l) errors.push(tr("خط مقصد پیدا نشد", "the line to replace was not found"));
      else {
        if (!isReplaceable(cv, l.index)) errors.push(tr("این خط سرفصل، عنوان، تاریخ یا مشخصات تماس است و نباید جایگزین شود", "it would replace a heading, title, date or contact line"));
        const lost = lostDetails(l.text, item.text);
        if (lost.length) errors.push(tr(`این جزئیات از خط اصلی حذف می‌شود: ${lost.join("، ")}`, `it drops details from the original line: ${lost.join(", ")}`));
      }
    }
    if (item.kind === "summary") {
      const b = summaryBody(cv);
      if (b && b.text) {
        const lost = lostDetails(b.text, item.text);
        if (lost.length) errors.push(tr(`این جزئیات از خلاصه فعلی حذف می‌شود: ${lost.join("، ")}`, `it drops details from the current summary: ${lost.join(", ")}`));
      }
    }
    return errors;
  }
  // Lines of src whose words are not found, in order, anywhere in back (used to verify the PDF and the improved text).
  const RANGE_RE_LEAD = /^\s*(?:(?:\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+)?\d{4}|\d{1,2}[\/.]\d{4}|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?)\s*[\-–—]\s*(?:(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+)?\d{4}|\d{1,2}[\/.]\d{4}|present|current|now|ongoing)\b/i;
  function missingLines(src, back) {
    const key = (x) => String(x || "").normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
    const hay = " " + key(back) + " ";
    const found = (x) => { const k = key(x); return !k || hay.includes(" " + k + " "); };
    // A line may be laid out in another order (a date column moved to the right), so its column parts are checked one by one.
    const parts = (x) => x.split(/\s{2,}|\t/).flatMap((p) => { const m = p.match(RANGE_RE_LEAD); return m ? [m[0], p.slice(m[0].length)] : [p]; });
    // Last resort: a right-aligned date or status may sit inside a wrapped line, so compare with those removed on both sides.
    const LBL = new RegExp(RANGE_RE_LEAD.source.replace("^\\s*", "") + "|\\b(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\.?\\s+)?(?:19|20)\\d{2}\\b|\\b(?:under review|in preparation|in press|submitted|accepted|forthcoming|preprint)\\b", "gi");
    const hay2 = " " + key(String(back || "").replace(LBL, " ")) + " ";
    const found2 = (x) => { const k = key(x.replace(LBL, " ")); return !k || hay2.includes(" " + k + " "); };
    return String(src || "").replace(/\r/g, "").split("\n").map((x) => x.trim()).filter((x) => key(x) && !found(x) && !parts(x).every(found) && !found2(x));
  }

  // ---------- In-place editing: the CV as blocks (header + sections) ----------
  const SEC_TITLE = { summary: "Profile", experience: "Experience", education: "Education", skills: "Skills", languages: "Languages", publications: "Publications", projects: "Projects", certifications: "Certifications", awards: "Awards", references: "References", additional: "Additional Information" };
  const SEC_ORDER = ["summary", "experience", "education", "projects", "publications", "skills", "certifications", "awards", "languages", "additional", "references"];
  const toLines = (cv) => String(cv || "").replace(/\r/g, "").split("\n");
  function cvBlocks(cv) {
    const ls = toLines(cv);
    const sec = detectSections(cv);
    const byStart = {};
    Object.entries(sec).forEach(([k, v]) => { byStart[v.start] = k; });
    const heads = [];
    ls.forEach((l, i) => { if (i > 0 && (byStart[i] || isHeadingLike(l))) heads.push(i); });
    const blocks = [{ name: "header", title: "", start: 0, bodyStart: 0, end: heads.length ? heads[0] : ls.length }];
    heads.forEach((h, k) => blocks.push({ name: byStart[h] || null, title: ls[h].trim(), start: h, bodyStart: h + 1, end: k + 1 < heads.length ? heads[k + 1] : ls.length }));
    blocks.forEach((b) => { b.body = ls.slice(b.bodyStart, b.end).join("\n").replace(/\s+$/, ""); });
    return blocks;
  }
  function findBlock(cv, name) {
    const bl = cvBlocks(cv);
    return bl.find((b) => b.name === name) || (name === "additional" ? bl.find((b) => /additional|other information|personal details/i.test(b.title)) : null) || null;
  }
  // Replace the body of a section, or create the section (with a standard heading) in a sensible place.
  function setSectionBody(cv, name, body) {
    const ls = toLines(cv);
    const bodyLines = String(body || "").replace(/\r/g, "").split("\n").map((x) => x.replace(/\s+$/, ""));
    while (bodyLines.length && !bodyLines[bodyLines.length - 1].trim()) bodyLines.pop();
    const b = findBlock(cv, name);
    if (b) {
      const tail = b.end < ls.length ? [""] : [];
      ls.splice(b.bodyStart, b.end - b.bodyStart, ...bodyLines, ...tail);
      return ls.join("\n").replace(/\n{3,}/g, "\n\n");
    }
    const bl = cvBlocks(cv);
    const rank = (n) => { const r = SEC_ORDER.indexOf(n); return r < 0 ? 50 : r; };
    const next = bl.slice(1).find((x) => x.name && rank(x.name) > rank(name));
    const at = next ? next.start : ls.length;
    const titles = bl.slice(1).map((x) => x.title).filter(Boolean);
    const upper = titles.length && titles.every((x) => x === x.toUpperCase());
    const head = SEC_TITLE[name] || name;
    const block = [upper ? head.toUpperCase() : head, ...bodyLines, ""];
    if (at > 0 && ls[at - 1] && ls[at - 1].trim()) block.unshift("");
    ls.splice(at, 0, ...block);
    return ls.join("\n").replace(/\n{3,}/g, "\n\n").replace(/\s+$/, "") + "\n";
  }
  // Add one item to a section: to the comma list in its last line (Skills) or as a new line.
  function addToSection(cv, name, text) {
    const t = String(text || "").trim();
    if (!t) return cv;
    const b = findBlock(cv, name);
    if (!b) return setSectionBody(cv, name, t);
    const ls = toLines(cv);
    let last = b.end - 1;
    while (last >= b.bodyStart && !ls[last].trim()) last--;
    if (last < b.bodyStart) { ls.splice(b.bodyStart, 0, t); return ls.join("\n"); }
    const L = ls[last];
    const KV = /^\s*[^:]{2,38}:\s/;
    if (name === "skills" && KV.test(L) && !KV.test(t)) {
      let o = -1;
      for (let k = b.bodyStart; k <= last; k++) if (/^\s*(?:other|others|additional|further)\b[^:]{0,20}:\s/i.test(ls[k])) o = k;
      if (o >= 0) ls[o] = ls[o].replace(/[\s,;.]+$/, "") + ", " + t;
      else ls.splice(last + 1, 0, "Other: " + t);
      return ls.join("\n");
    }
    if ((name === "skills" || name === "languages") && /,/.test(L) && !/:/.test(L) && !/^\s*[•\-*▪●◦·]\s/.test(L) && !/,/.test(t)) ls[last] = L.replace(/[\s,;.]+$/, "") + ", " + t;
    else ls.splice(last + 1, 0, (/^\s*[•\-*▪●◦·]\s/.test(L) && !/^\s*[•\-*▪●◦·]\s/.test(t) ? (L.match(/^\s*[•\-*▪●◦·]\s*/) || ["• "])[0] : "") + t);
    return ls.join("\n");
  }
  // Job, degree or project entries: lines with a date range that are not bullets.
  function cvEntries(cv) {
    const ls = toLines(cv);
    const out = [];
    cvBlocks(cv).slice(1).forEach((b) => {
      for (let i = b.bodyStart; i < b.end; i++) {
        const t = ls[i];
        if (t.trim() && !/^\s*[•\-*▪●◦·]\s/.test(t) && parseRanges(t).length) out.push({ index: i, text: t.trim(), section: b.title, name: b.name });
      }
    });
    return out;
  }
  // Insert a bullet at the end of the entry that starts at line `index`.
  function addBulletUnder(cv, index, text) {
    const t = String(text || "").trim().replace(/^[\s•\-*▪●◦·]+/, "");
    if (!t) return cv;
    const ls = toLines(cv);
    let i = index + 1, pre = null;
    while (i < ls.length && ls[i].trim() && !isHeadingLike(ls[i]) && !(parseRanges(ls[i]).length && !/^\s*[•\-*▪●◦·]\s/.test(ls[i]))) {
      const m = ls[i].match(/^\s*[•\-*▪●◦·]\s*/);
      if (m) pre = m[0];
      i++;
    }
    ls.splice(i, 0, (pre || "• ") + t);
    return ls.join("\n");
  }
  function replaceLine(cv, index, text) {
    const ls = toLines(cv);
    if (index < 0 || index >= ls.length) return cv;
    const t = String(text || "").replace(/\r/g, "");
    ls.splice(index, 1, ...(t.trim() ? t.split("\n") : []));
    return ls.join("\n");
  }
  // Header: name, optional headline (subtitle) line and contact lines.
  const isContactLike = (l) => /@|https?:|www\.|linkedin|github|orcid|\+?\d[\d\s()\-.]{6,}|\|/i.test(l);
  function getHeadline(cv) {
    const ls = toLines(cv), h = cvBlocks(cv)[0];
    const i = ls.findIndex((l, k) => k > 0 && k < h.end && l.trim());
    return i > 0 && !isContactLike(ls[i]) && ls[i].trim().length <= 90 ? { index: i, text: ls[i].trim() } : null;
  }
  function setHeadline(cv, text) {
    const t = String(text || "").trim();
    const hl = getHeadline(cv);
    if (hl) return replaceLine(cv, hl.index, t);
    if (!t) return cv;
    const ls = toLines(cv);
    const nameAt = ls.findIndex((l) => l.trim());
    ls.splice(nameAt + 1, 0, t);
    return ls.join("\n");
  }
  function addHeaderLine(cv, text) {
    const t = String(text || "").trim();
    if (!t) return cv;
    const ls = toLines(cv), h = cvBlocks(cv)[0];
    let last = h.end - 1;
    while (last > 0 && !ls[last].trim()) last--;
    if (isContactLike(ls[last]) && isContactLike(t) && (ls[last] + t).length < 110) ls[last] = ls[last].replace(/\s+$/, "") + " | " + t;
    else ls.splice(last + 1, 0, t);
    return ls.join("\n");
  }

  // Build the improved CV text from accepted suggestions.
  function applyImprovements(cv, picks) {
    const raw = String(cv || "").replace(/\r/g, "").split("\n");
    const lines = cvLines(cv);
    const byId = Object.fromEntries(lines.map((l) => [l.id, l]));
    const replace = new Map(), after = new Map();
    const prefixOf = (t) => (t.match(/^\s*(?:[•\-*▪●◦·]\s*)?/) || [""])[0];
    (picks.bullets || []).forEach((b) => {
      if (b.replaces && byId[b.replaces] && isReplaceable(cv, byId[b.replaces].index)) replace.set(byId[b.replaces].index, prefixOf(raw[byId[b.replaces].index]) + b.text.replace(/^[\s•\-*]+/, ""));
      else if (b.after && byId[b.after]) {
        const idx = byId[b.after].index;
        const pre = prefixOf(raw[idx]) || "• ";
        if (!after.has(idx)) after.set(idx, []);
        after.get(idx).push(pre + b.text.replace(/^[\s•\-*]+/, ""));
      }
    });
    let out = [];
    raw.forEach((t, i) => { out.push(replace.has(i) ? replace.get(i) : t); if (after.has(i)) out.push(...after.get(i)); });
    let text = out.join("\n");
    // Skills: append confirmed items to the first content line of the Skills section
    const add = (picks.skills || []).map((x) => x.text).filter(Boolean);
    if (add.length) {
      const sec = detectSections(text);
      const ls = text.split("\n");
      if (sec.skills) {
        let i = sec.skills.start + 1;
        while (i < sec.skills.end && !ls[i].trim()) i++;
        if (i < sec.skills.end) ls[i] = ls[i].replace(/[\s,;.]+$/, "") + ", " + add.join(", ");
        else ls.splice(sec.skills.start + 1, 0, add.join(", "));
      } else ls.push("", "SKILLS", add.join(", "));
      text = ls.join("\n");
    }
    // Summary: replace the Summary section body, or insert one before the first section
    if (picks.summary && picks.summary.text) {
      const sec = detectSections(text);
      const ls = text.split("\n");
      const body = summaryBody(text);
      if (sec.summary && body) {
        ls.splice(body.start, body.end - body.start, picks.summary.text, "");
      } else {
        const first = Object.values(sec).reduce((m, x) => Math.min(m, x.start), ls.length);
        ls.splice(first, 0, "PROFILE", picks.summary.text, "");
      }
      text = ls.join("\n").replace(/\n{3,}/g, "\n\n");
    }
    return text;
  }

  // ---------- Application email helpers ----------
  // Verified facts for the email, taken verbatim from CV lines (F1, F2, ...). The model may use only these.
  function buildEmailFacts(cv, result) {
    const lines = String(cv || "").replace(/\r/g, "").split("\n").map((l) => l.trim());
    const sections = detectSections(cv);
    const facts = [];
    const add = (label, text) => { const t = String(text || "").trim(); if (t && !facts.some((f) => f.text === t)) facts.push({ id: "F" + (facts.length + 1), label, text: t.slice(0, 300) }); };
    const name = lines.find(Boolean);
    add("name", name);
    const em = String(cv).match(/[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/);
    if (em) add("email", em[0]);
    const ph = String(cv).match(/\+\d[\d\s\-()]{6,18}\d/);
    if (ph) add("phone", ph[0]);
    if (sections.summary) add("profile", sections.summary.text.split("\n").map((x) => x.trim()).find(Boolean));
    if (sections.experience) {
      sections.experience.text.split("\n").map((x) => x.trim()).filter((x) => x && parseRanges(x).length).slice(0, 3).forEach((x) => add("role", x));
    }
    if (sections.education) {
      const ed = sections.education.text.split("\n").map((x) => x.trim()).filter((x) => x && EDU.some((e) => e.re.test(x)));
      ed.sort((a, b) => Math.max(...EDU.filter((e) => e.re.test(b)).map((e) => e.lvl)) - Math.max(...EDU.filter((e) => e.re.test(a)).map((e) => e.lvl)));
      if (ed[0]) add("degree", ed[0]);
    }
    if (result && Array.isArray(result.keywords)) {
      const ncv = norm(cv);
      result.keywords.filter((k) => k.hit && !k.soft && k.skill).sort((a, b) => b.weight - a.weight).slice(0, 6).forEach((k) => {
        const line = lines.find((l) => l && skillCount(k.skill, l, norm(l)) > 0 && !/^(skills|technical skills)$/i.test(l));
        if (line) add("evidence for " + k.name, line);
      });
      void ncv;
    }
    if (sections.languages) add("languages", sections.languages.text.split("\n").map((x) => x.trim()).filter(Boolean).join("; "));
    return facts;
  }

  const EMAIL_ACRO_OK = new Set(["CV", "PDF", "DOCX", "PS", "EU", "ID", "RE"]);
  const FILLER = /\b(passionate|passion|excited|thrilled|dynamic|hard[- ]?working|perfect fit|ideal candidate|highly motivated|results[- ]driven|go[- ]getter|dream job|team player|eager)\b/gi;
  const EMAIL_WORDS_OK = new Set(["dear", "hiring", "manager", "team", "sincerely", "regards", "best", "kind", "thank", "thanks", "please", "attached", "position", "application", "cv", "resume", "the", "i", "my", "yours", "hello", "hi", "subject", "monday", "tuesday", "wednesday", "thursday", "friday", "january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december", "english", "finnish", "swedish"]);
  // Email check: max words; numbers and acronyms must come from the facts or the ad; skills only from the facts (the CV).
  function validateEmail(body, factTexts, jd, opts) {
    opts = opts || {};
    if (opts.lang) LANG = opts.lang === "en" ? "en" : "fa";
    const maxWords = opts.maxWords || 150;
    const errors = [], warnings = [];
    const facts = factTexts.join("\n");
    const both = facts + "\n" + String(jd || "");
    const bothLower = both.toLowerCase();
    const words = String(body).trim().split(/\s+/).filter(Boolean).length;
    if (words > maxWords) errors.push(tr(`${words} کلمه؛ بیشتر از سقف ${maxWords}`, `${words} words; over the ${maxWords} limit`));
    const bothNums = new Set((both.match(NUM_RE) || []).map((x) => x.replace(/\s/g, "").replace(",", ".")));
    (String(body).match(NUM_RE) || []).map((x) => x.replace(/\s/g, "")).forEach((n) => { if (!bothNums.has(n.replace(",", "."))) errors.push(tr(`عدد «${n}» نه در رزومه است نه در آگهی`, `number “${n}” is in neither the CV facts nor the ad`)); });
    const nb = norm(body), nf = norm(facts);
    for (const sk of SKILLS) {
      if (sk.soft) continue;
      if (skillCount(sk, body, nb) > 0 && skillCount(sk, facts, nf) === 0) errors.push(tr(`«${sk.k}» در اطلاعات رزومه نیست`, `“${sk.k}” is not in the CV facts`));
    }
    new Set(String(body).match(/(?<![A-Za-z0-9])[A-Z][A-Z0-9]{1,}(?:-[A-Z0-9]+)?(?![a-z0-9])/g) || []).forEach((a) => {
      if (!EMAIL_ACRO_OK.has(a) && !bothLower.includes(a.toLowerCase())) errors.push(tr(`«${a}» نه در رزومه است نه در آگهی`, `“${a}” is in neither the CV facts nor the ad`));
    });
    (String(body).match(SENIOR_RE) || []).forEach((w) => { if (!new RegExp("\\b" + w + "\\b", "i").test(facts)) warnings.push(tr(`«${w}» در رزومه نیامده`, `“${w}” is not stated in the CV`)); });
    const fill = [...new Set((String(body).match(FILLER) || []).map((x) => x.toLowerCase()))];
    if (fill.length) warnings.push(tr("واژه‌های تعریفی بی‌اطلاعات: ", "Subjective filler words: ") + fill.join(", "));
    const toks = String(body).split(/\s+/);
    toks.forEach((w, i) => {
      const c = w.replace(/[^A-Za-z\-]/g, "");
      if (i === 0 || c.length < 3 || !/^[A-Z][a-z]/.test(c) || EMAIL_WORDS_OK.has(c.toLowerCase())) return;
      if (/[.!?:,]$/.test(toks[i - 1] || "") || /^\n/.test(w)) return;
      if (!bothLower.includes(c.toLowerCase())) warnings.push(tr(`«${c}» در رزومه یا آگهی نیست؛ بررسی کنید`, `“${c}” is not in the CV or the ad; check it`));
    });
    return { ok: errors.length === 0, errors: [...new Set(errors)], warnings: [...new Set(warnings)], words };
  }

  function guessTitle(jd) {
    const lines = String(jd || "").split("\n").map((s) => s.trim()).filter(Boolean);
    for (const l of lines.slice(0, 4)) {
      if (l.length >= 4 && l.length <= 80 && !/[.!?]$/.test(l) && /[A-Za-z]/.test(l) && !/^(about|we |our |job description|apply)/i.test(l)) {
        return l.replace(/\s*[\(\[].*?[\)\]]\s*/g, " ").replace(/\s*\|\s*.*$/, "").replace(/\s+[–—-]\s+.*$/, "").trim();
      }
    }
    return "";
  }

  root.ATS = { score, extractJDKeywords, detectSections, experienceMonths, parseRanges, dateConsistency, jdYears, jdEducation, norm, SKILLS, guessTitle, hasR, cvLines, validateSuggestion, applyImprovements, buildEmailFacts, isHeadingLike, summaryBody, lostDetails, isReplaceable, checkPreserved, missingLines, cvBlocks, findBlock, setSectionBody, addToSection, cvEntries, addBulletUnder, replaceLine, getHeadline, setHeadline, addHeaderLine, validateEmail, skillCount: (k, t) => { const s = SKILLS.find((x) => x.k === k); return s ? skillCount(s, t, norm(t)) : 0; } };
})(typeof window !== "undefined" ? window : globalThis);
