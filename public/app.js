(function(){
"use strict";
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const T = I18N.T, N = I18N.num;
let cvParse = {};
let lastResult = null;
let lastInputs = null;
let cvInfoState = null; // { name, pages, words, emptyText, multiColumn, tables } or { msg }

I18N.applyStatic();

// ---------- pdf.js setup ----------
function setupPdf(){
  if (!window.pdfjsLib) return false;
  if (setupPdf.done) return true;
  const src = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
  try {
    const blob = new Blob(["importScripts('" + src + "');"], { type: "application/javascript" });
    pdfjsLib.GlobalWorkerOptions.workerPort = new Worker(URL.createObjectURL(blob));
  } catch (e) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = src;
  }
  setupPdf.done = true;
  return true;
}

const SAME_ROW_RX = /^(?:(?:[A-Za-z]{3,9}\.?\s+)?\d{4}|\d{1,2}[\/.]\d{4})(?:\s*(?:-|\u2013|\u2014|to)\s*(?:(?:[A-Za-z]{3,9}\.?\s+)?\d{4}|\d{1,2}[\/.]\d{4}|present|current|now|ongoing))?$/i;

async function readPdf(buf){
  if (!setupPdf()) throw new Error(T("pdfLibErr"));
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  let out = [], splitLines = 0, multiItemLines = 0;
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const vp = page.getViewport({ scale: 1 });
    const tc = await page.getTextContent();
    const rows = new Map();
    for (const it of tc.items) {
      if (!it.str || !it.str.trim()) { continue; }
      const y = Math.round(it.transform[5] / 3) * 3;
      if (!rows.has(y)) rows.set(y, []);
      rows.get(y).push({ x: it.transform[4], w: it.width || 0, s: it.str });
    }
    const ys = [...rows.keys()].sort((a, b) => b - a);
    for (const y of ys) {
      const items = rows.get(y).sort((a, b) => a.x - b.x);
      let line = "", prevEnd = null, split = false;
      for (const it of items) {
        if (prevEnd != null) {
          const gap = it.x - prevEnd;
          // A wide gap suggests two columns, unless it is a right-aligned date or a "Label:  value" row.
          if (gap > vp.width * 0.12 && line.trim().length > 2 && it.s.trim().length > 2 && !SAME_ROW_RX.test(it.s.trim()) && !/:\s*$/.test(line)) split = true;
          if (gap > 1.5 && !line.endsWith(" ") && !it.s.startsWith(" ")) line += gap > vp.width * 0.05 ? "   " : " ";
        }
        line += it.s;
        prevEnd = it.x + it.w;
      }
      if (items.length > 1) { multiItemLines++; if (split) splitLines++; }
      out.push(line.replace(/\s+$/, ""));
    }
    out.push("");
  }
  const text = out.join("\n");
  const chars = text.replace(/\s/g, "").length;
  return {
    text,
    parse: {
      emptyText: chars < 150,
      multiColumn: multiItemLines >= 8 && splitLines / multiItemLines > 0.3,
      iconGlyphs: (text.match(/[-￼-￾]/g) || []).length,
      pages: pdf.numPages,
    },
  };
}
async function readDocx(buf){
  if (!window.mammoth) throw new Error(T("wordLibErr"));
  const raw = await mammoth.extractRawText({ arrayBuffer: buf });
  let tables = 0;
  try { const html = await mammoth.convertToHtml({ arrayBuffer: buf }); tables = (html.value.match(/<table/g) || []).length; } catch (e) {}
  const text = raw.value.replace(/\n{3,}/g, "\n\n");
  return { text, parse: { tables, iconGlyphs: (text.match(/[-￼-￾]/g) || []).length, emptyText: text.replace(/\s/g, "").length < 150 } };
}
async function readFile(file){
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return readPdf(await file.arrayBuffer());
  if (name.endsWith(".docx")) return readDocx(await file.arrayBuffer());
  if (name.endsWith(".doc")) throw new Error(T("docOld"));
  return { text: await file.text(), parse: {} };
}

function renderCvInfo(){
  const s = cvInfoState, el = $("cvInfo");
  if (!s) { el.textContent = ""; return; }
  if (s.msg) { el.innerHTML = s.err ? `<span class="err">${esc(T(s.msg))}${esc(s.detail || "")}</span>` : esc(T(s.msg)); return; }
  const bits = [esc(s.name)];
  if (s.pages) bits.push(N(s.pages) + " " + T("pages"));
  bits.push(N(s.words) + " " + T("wordsExtracted"));
  if (s.emptyText) bits.push(`<span class="err">${esc(T("noText"))}</span>`);
  if (s.multiColumn) bits.push(`<span class="err">${esc(T("multiCol"))}</span>`);
  if (s.tables) bits.push(`<span class="err">${N(s.tables)} ${esc(T("tables"))}</span>`);
  el.innerHTML = bits.join(" · ");
}

function wireFile(inputId, dropId, targetId, isCv){
  const input = $(inputId), drop = $(dropId);
  const handle = async (file) => {
    if (!file) return;
    if (isCv) $("cvInfo").innerHTML = '<span class="spinner"></span> ' + esc(T("reading")) + " " + esc(file.name);
    try {
      const r = await readFile(file);
      $(targetId).value = r.text.trim();
      if (isCv) {
        cvParse = r.parse || {};
        cvInfoState = { name: file.name, pages: r.parse.pages, words: r.text.split(/\s+/).filter(Boolean).length, emptyText: r.parse.emptyText, multiColumn: r.parse.multiColumn, tables: r.parse.tables };
        renderCvInfo();
      }
    } catch (e) {
      if (isCv) { cvInfoState = { msg: "fileErr", err: true, detail: (e && e.message) || String(e) }; renderCvInfo(); }
    }
  };
  input.addEventListener("change", () => handle(input.files[0]));
  ["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("over"); }));
  ["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("over"); }));
  drop.addEventListener("drop", (e) => handle(e.dataTransfer.files[0]));
}
wireFile("cvFile", "cvDrop", "cv", true);
wireFile("jdFile", "jdDrop", "jd", false);
$("cv").addEventListener("input", () => { if (!$("cv").value.trim()) { cvParse = {}; cvInfoState = null; renderCvInfo(); } });

function colorFor(s){ return s >= 80 ? "var(--good)" : s >= 65 ? "var(--accent)" : s >= 50 ? "var(--mid)" : "var(--bad)"; }
function bandFor(s){ return T(s >= 80 ? "bandStrong" : s >= 65 ? "bandGood" : s >= 50 ? "bandMid" : "bandWeak"); }
const LVK = { req: ["lvReq", "t-req"], task: ["lvTask", "t-task"], neutral: ["lvNeutral", "t-neutral"], pref: ["lvPref", "t-pref"], offer: ["lvOffer", "t-offer"] };
const lvTag = (level) => { const x = LVK[level] || LVK.neutral; return `<span class="tag ${x[1]}">${esc(T(x[0]))}</span>`; };

function render(r, cvText, opts){
  opts = opts || {};
  $("results").style.display = "block";
  $("overall").textContent = r.overall;
  const arc = $("arc");
  arc.style.stroke = colorFor(r.overall);
  arc.style.transition = "stroke-dashoffset .8s ease";
  requestAnimationFrame(() => { arc.style.strokeDashoffset = String(389.6 * (1 - r.overall / 100)); });
  renderOverview();
  renderFix(r, cvText);
  renderSidebar(r);

  $("comps").innerHTML = Object.values(r.components).map((c) => {
    const na = c.score == null;
    return `<div class="comp"><div class="name">${esc(c.label)}<small>${esc(T("weight"))} ${N(c.weight)}${na ? " · " + esc(T("notComputed")) : ""}</small></div>
      <div class="bar"><i style="width:${na ? 0 : c.score}%;background:${na ? "transparent" : colorFor(c.score)}"></i></div>
      <div class="val">${na ? "?" : c.score}</div><div class="det">${esc(c.detail)}</div></div>`;
  }).join("");

  renderGate(r.gate || []);

  let adv = "";
  if (r.tips.length) adv += `<div class="box tip"><h3>${esc(T("tipsH"))}</h3><ul class="list">${r.tips.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>`;
  const fw = r.warnings.filter((w) => !r.knockouts.includes(w));
  if (fw.length) adv += `<div class="box warn"><h3>${esc(T("structH"))}</h3><ul class="list">${fw.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>`;
  adv += `<p class="note" style="margin-bottom:0">${esc(T("honesty"))}</p>`;
  $("advice").innerHTML = adv;

  renderKw(currentKwFilter);
  if (!opts.keepImprove) renderQuestions(r);
  $("parsed").textContent = cvText;
  $("secs").innerHTML = r.sections.length ? r.sections.map((s) => `<bdi>${esc(s)}</bdi>`).join(T("list")) : esc(T("noneSecs"));
  if (!opts.keepImprove) { $("aiOut").innerHTML = ""; if (aiReady) $("aiStatus").textContent = ""; $("emailOut").innerHTML = ""; $("emailStatus").textContent = ""; }
  if (!opts.noScroll) $("overviewCard").scrollIntoView({ behavior: "smooth", block: "start" });
}

// ---------- Overview panel (latest / previous score) ----------
let prevSnap = null, lastRunAt = null, overviewTab = "latest";
function firstName(cv){
  const l = String(cv || "").split("\n").map((x) => x.trim()).find(Boolean) || "";
  if (!/^[A-Za-zÀ-ÿ'\-]+(\s+[A-Za-zÀ-ÿ'\-]+){0,3}$/.test(l)) return "";
  return l.split(/\s+/)[0];
}
function renderOverview(){
  if (!lastResult) return;
  const h = new Date().getHours();
  $("greet").textContent = T("greet", { part: T(h < 12 ? "morning" : h < 18 ? "afternoon" : "evening"), name: firstName(lastInputs.cv) });
  $("greetSub").textContent = T("greetSub");
  $("overviewBody").hidden = false;
  $("tabPrev").disabled = !prevSnap;
  if (!prevSnap && overviewTab === "prev") overviewTab = "latest";
  $("tabLatest").classList.toggle("on", overviewTab === "latest");
  $("tabPrev").classList.toggle("on", overviewTab === "prev");
  const prev = overviewTab === "prev";
  const score = prev ? prevSnap.overall : lastResult.overall;
  const t = (d) => d.toLocaleTimeString(I18N.lang === "fa" ? "fa-IR" : "en-GB", { hour: "2-digit", minute: "2-digit" });
  $("headline").textContent = prev ? T("headlinePrev", { n: N(score), t: t(prevSnap.at) }) : T("headline", { n: N(score) });
  $("band").textContent = bandFor(score);
  $("band").style.color = colorFor(score);
  let d = T(score >= 80 ? "descStrong" : score >= 65 ? "descGood" : score >= 50 ? "descMid" : "descWeak");
  const fails = prev ? prevSnap.fails : (lastResult.gate || []).filter((g) => g.status === "fail").length;
  if (fails) d += T("descFails", { n: N(fails), k: fails });
  $("odesc").textContent = d;
  $("marker").style.left = score + "%";
  $("markerLbl").style.left = score + "%";
  $("threshLbl").style.left = "80%";
  $("threshLbl").style.visibility = "visible";
  requestAnimationFrame(() => {
    // Hide the threshold label when it would overlap the marker label (narrow screens or nearby scores).
    const m = $("markerLbl").getBoundingClientRect(), t = $("threshLbl").getBoundingClientRect();
    if (m.right + 8 > t.left && m.left < t.right + 8) $("threshLbl").style.visibility = "hidden";
  });
}
$("tabLatest").addEventListener("click", () => { overviewTab = "latest"; renderOverview(); });
$("tabPrev").addEventListener("click", () => { if (prevSnap) { overviewTab = "prev"; renderOverview(); } });

// ---------- Sidebar: top fixes and completed checks ----------
function renderSidebar(r){
  const fixes = [], done = [];
  const tenth = (x) => N(Math.round(x / 10));
  const gate = r.gate || [];
  if (gate.length) {
    const f = gate.filter((g) => g.status === "fail").length;
    if (f) fixes.push({ key: "gate", label: T("fixKnockout"), cnt: N(f), cls: "bad", href: "#gateCard", sev: 1e6 });
    else done.push({ label: T("fixKnockout"), cnt: "✓", href: "#gateCard" });
  }
  for (const [key, c] of Object.entries(r.components)) {
    if (c.score == null) continue;
    const href = key === "keywords" ? "#kwCard" : "#compsCard";
    if (c.score >= 80) { done.push({ label: c.label, cnt: tenth(c.score), href }); continue; }
    let n = 1;
    if (key === "keywords") n = r.keywords.filter((k) => !k.hit && !k.soft).length || 1;
    else if (key === "dates") n = (r.dateIssues || []).length || 1;
    else if (key === "format") n = String(c.detail).split(/[;؛]/).filter((x) => x.trim()).length || 1;
    fixes.push({ key, label: key === "keywords" ? T("fixKeywords") : c.label, cnt: N(n), cls: c.score < 50 ? "bad" : "mid", href, sev: c.weight * (100 - c.score) });
  }
  fixes.sort((a, b) => b.sev - a.sev);
  fixes.forEach((x) => { x.href = fixAnchorFor(x.key, r) || x.href; });
  const row = (x, cls) => `<a class="fix" href="${x.href}"><span>${esc(x.label)}</span><span class="cnt ${cls || x.cls}">${esc(x.cnt)}</span></a>`;
  $("fixList").innerHTML = fixes.length ? fixes.map((x) => row(x)).join("") : `<p class="sempty">${esc(T("none"))}</p>`;
  $("doneList").innerHTML = done.map((x) => row(x, "good")).join("");
  $("doneGroup").hidden = !done.length;
  $("toolGroup").hidden = false;
}
document.querySelectorAll(".snav .navitem").forEach((a) => a.addEventListener("click", () => {
  document.querySelectorAll(".snav .navitem").forEach((x) => x.classList.toggle("on", x === a));
}));

const GS = { pass: ["gsPass", "st-pass"], fail: ["gsFail", "st-fail"], unknown: ["gsUnknown", "st-unknown"] };
function renderGate(gate){
  $("gateCard").style.display = gate.length ? "" : "none";
  const fails = gate.filter((g) => g.status === "fail").length, unk = gate.filter((g) => g.status === "unknown").length;
  $("gateBanner").innerHTML = fails ? `<div class="box bad" style="margin:0 0 10px"><h3>${esc(T("gateFails", { n: N(fails) }))}</h3>${esc(T("gateFailsBody"))}</div>`
    : unk ? `<div class="box warn" style="margin:0 0 10px">${esc(T("gateUnknown", { n: N(unk) }))}</div>`
    : `<div class="box tip" style="margin:0 0 10px">${esc(T("gateAllPass"))}</div>`;
  $("gateBody").innerHTML = gate.map((g) => `<tr><td>${esc(g.label)}</td><td class="en">${esc(g.requirement)}</td>
    <td><span class="st ${GS[g.status][1]}">${esc(T(GS[g.status][0]))}</span></td>
    <td>${g.evidence ? `<bdi>${esc(g.evidence)}</bdi><br>` : ""}<span class="note">${esc(g.note)}</span></td></tr>`).join("");
}

let currentKwFilter = "all";
function renderKw(f){
  if (!lastResult) return;
  currentKwFilter = f;
  document.querySelectorAll("#kwTabs button").forEach((b) => b.classList.toggle("on", b.dataset.f === f));
  const rows = lastResult.keywords.filter((k) => f === "all" || (f === "hit" ? k.hit : !k.hit));
  $("kwBody").innerHTML = rows.length ? rows.map((k) => `<tr><td class="en">${esc(k.name)}${k.soft ? ` <span class="tag t-neutral">${esc(T("soft"))}</span>` : ""}${k.extra ? ` <span class="tag t-neutral">${esc(T("other"))}</span>` : ""}</td>
      <td>${lvTag(k.level)}</td><td class="en">${k.weight}</td>
      <td>${k.hit ? '<span class="ok">✓</span>' + (k.inSkills ? ` <span class="note">${esc(T("inSkills"))}</span>` : "") : '<span class="no">✗</span>'}</td>
      <td class="en">${esc(k.evidence || "")}</td></tr>`).join("") : `<tr><td colspan="5" class="note">${esc(T("none"))}</td></tr>`;
}
$("kwTabs").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) renderKw(b.dataset.f); });

function runScore(opts){
  const cv = $("cv").value, jd = $("jd").value;
  $("runErr").textContent = "";
  if (cv.trim().split(/\s+/).length < 30) { $("runErr").textContent = T("cvShort"); return false; }
  if (jd.trim().split(/\s+/).length < 25) { $("runErr").textContent = T("jdShort"); return false; }
  try {
    if (lastResult) prevSnap = { overall: lastResult.overall, fails: (lastResult.gate || []).filter((g) => g.status === "fail").length, at: lastRunAt || new Date() };
    lastRunAt = new Date();
    overviewTab = "latest";
    lastInputs = { cv, jd, title: $("title").value, parse: cvParse };
    lastResult = ATS.score(cv, jd, { title: lastInputs.title, parse: cvParse, lang: I18N.lang });
    render(lastResult, cv, opts);
    return true;
  } catch (e) { $("runErr").textContent = T("calcErr") + (e.message || e); return false; }
}
$("run").addEventListener("click", () => { fixUndo.length = 0; $("fixUndo").disabled = true; $("fixMsg").textContent = ""; runScore(); });


// ---------- Fix in your CV: write the missing part, it goes into that exact place ----------
const fixUndo = [];
let fixItems = [];
const SEC_NAME = { summary: "Profile", experience: "Experience", education: "Education", skills: "Skills", languages: "Languages" };
function buildFixItems(r, cv){
  const items = [], byId = {};
  const add = (it) => { if (byId[it.id]) { if (it.why && !byId[it.id].why.includes(it.why)) byId[it.id].why.push(it.why); return; } it.why = it.why ? [it.why] : []; byId[it.id] = it; items.push(it); };
  const secItem = (name, why) => {
    const b = ATS.findBlock(cv, name);
    add({ id: "sec-" + name, kind: "section", name, title: T("fSecH", { s: b ? b.title : SEC_NAME[name] }), lead: b ? T("fSecEdit") : T("fSecNew", { s: SEC_NAME[name] }), value: b ? b.body : "", why });
  };
  // Knockout criteria that are not passed
  (r.gate || []).filter((g) => g.status !== "pass").forEach((g) => {
    if (g.key.startsWith("lang:")) { const l = g.key.slice(5); add({ id: "lang-" + l.toLowerCase(), kind: "add", name: "languages", title: T("fLangH", { l }), value: "", ph: l + " (B1)", why: g.note, bad: g.status === "fail" }); }
    else if (g.key === "degree") secItem("education", g.note);
    else if (g.key === "years") secItem("experience", g.note);
    else if (g.key === "permit") add({ id: "permit", kind: "header", title: g.label, value: "", ph: "Work permit: …", why: g.note + " " + T("fHeaderNote") });
    else if (g.key === "licence") add({ id: "licence", kind: "header", title: g.label, value: "", ph: "Driving licence: B", why: g.note + " " + T("fHeaderNote") });
  });
  // Contact details and missing standard sections
  const ci = r.contact || {};
  if (!ci.email) add({ id: "email", kind: "header", title: T("fEmailH"), value: "", ph: "name@example.com", why: T("fEmailWhy") });
  if (!ci.phone) add({ id: "phone", kind: "header", title: T("fPhoneH"), value: "", ph: "+358 40 123 4567", why: T("fPhoneWhy") });
  ["experience", "education", "skills"].forEach((n) => { if (!r.sections.includes(n)) secItem(n, ""); });
  // Job title / headline
  const tc = r.components.title;
  const adTitle = lastInputs && (lastInputs.title || ATS.guessTitle(lastInputs.jd || ""));
  if (tc && tc.score != null && tc.score < 100 && adTitle) { const hl = ATS.getHeadline(cv); add({ id: "title", kind: "headline", title: T("fTitleH"), value: hl ? hl.text : "", ph: adTitle, why: T("fTitleWhy", { t: adTitle }) }); }
  // Profile
  if (!r.sections.includes("summary")) add({ id: "sec-summary", kind: "section", name: "summary", title: T("fSummaryH"), lead: T("fSecNew", { s: "Profile" }), value: "", why: T("fSummaryWhy") });
  // Education that does not satisfy the ad
  const ec = r.components.education;
  if (ec && ec.score != null && ec.score < 80) secItem("education", T("fEduWhy"));
  // Dates
  if ((r.dateIssues || []).length) secItem(r.sections.includes("experience") ? "experience" : "education", T("fDatesWhy", { list: r.dateIssues.join(T("list")) }));
  // Missing hard keywords, most important first
  r.keywords.filter((k) => !k.hit && !k.soft).sort((a, b) => b.weight - a.weight).slice(0, 10).forEach((k) => {
    add({ id: "kw-" + k.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"), kind: "kw", kw: k.name, level: k.level, title: T("fkTitle", { k: k.name }), value: "", why: T("fkWhy") });
  });
  return items;
}
function fixAnchorFor(key, r){
  const has = (id) => fixItems.some((x) => x.id === id);
  const first = (pre) => { const x = fixItems.find((i) => i.id.startsWith(pre)); return x ? "#fix-" + x.id : null; };
  if (key === "keywords") return first("kw-");
  if (key === "title") return has("title") ? "#fix-title" : null;
  if (key === "dates" || key === "experience") return has("sec-experience") ? "#fix-sec-experience" : null;
  if (key === "education") return has("sec-education") ? "#fix-sec-education" : null;
  if (key === "languages") return first("lang-");
  if (key === "format" || key === "gate") return fixItems.length ? "#fixCard" : null;
  return null;
}
function renderFix(r, cv){
  fixItems = buildFixItems(r, cv);
  const entries = ATS.cvEntries(cv);
  const hasSummary = !!ATS.findBlock(cv, "summary");
  if (!fixItems.length) { $("fixItems").innerHTML = `<p class="note ok">${esc(T("fixNothing"))}</p>`; return; }
  $("fixItems").innerHTML = fixItems.map((it, i) => {
    let ed = "";
    if (it.kind === "section") ed = `<textarea id="fv${i}" spellcheck="true">${esc(it.value)}</textarea>`;
    else if (it.kind === "kw") {
      const opts = [`<option value="skills">${esc(T("tSkills"))}</option>`]
        .concat(entries.filter((e) => e.name !== "education").map((e) => `<option value="e${e.index}">${esc(T("tUnder", { t: e.text.length > 70 ? e.text.slice(0, 70) + "…" : e.text }))}</option>`))
        .concat(hasSummary ? [`<option value="summary">${esc(T("tSummary"))}</option>`] : []);
      ed = `<div class="frow"><span class="note">${esc(T("fixWhere"))}</span><select id="ft${i}">${opts.join("")}</select></div><input type="text" id="fv${i}" placeholder="${esc(it.kw)}">`;
    } else ed = `<input type="text" id="fv${i}" value="${esc(it.value)}" placeholder="${esc(it.ph || "")}">`;
    const tag = it.kind === "kw" ? lvTag(it.level) : it.bad ? `<span class="st st-fail">${esc(T("gsFail"))}</span>` : "";
    return `<div class="fixitem" id="fix-${esc(it.id)}"><div class="fhead"><b>${esc(it.title)}</b>${tag}</div>
      ${it.lead ? `<p class="why">${esc(it.lead)}</p>` : ""}${it.why.filter(Boolean).map((w) => `<p class="why">${esc(w)}</p>`).join("")}
      ${ed}<div class="actions"><button class="btn ghost" data-fix="${i}">${esc(T("fixApply"))}</button><span class="note" id="fm${i}"></span></div></div>`;
  }).join("");
  fixItems.forEach((it, i) => {
    if (it.kind === "kw") $("ft" + i).addEventListener("change", (e) => { $("fv" + i).placeholder = e.target.value === "skills" ? it.kw : T("fkPhBullet", { k: it.kw }); });
  });
  $("fixItems").querySelectorAll("button[data-fix]").forEach((b) => b.addEventListener("click", () => applyFix(+b.dataset.fix)));
}
function applyFix(i){
  const it = fixItems[i], val = $("fv" + i).value;
  const cv = $("cv").value;
  if (it.kind !== "section" && it.kind !== "headline" && !val.trim()) { $("fm" + i).innerHTML = `<span class="err">${esc(T("fixEmpty"))}</span>`; return; }
  let next = cv;
  if (it.kind === "section") next = ATS.setSectionBody(cv, it.name, val);
  else if (it.kind === "add") next = ATS.addToSection(cv, it.name, val);
  else if (it.kind === "header") next = ATS.addHeaderLine(cv, val);
  else if (it.kind === "headline") next = ATS.setHeadline(cv, val);
  else if (it.kind === "kw") {
    const t = $("ft" + i).value;
    if (t === "skills") next = ATS.addToSection(cv, "skills", val);
    else if (t === "summary") { const b = ATS.findBlock(cv, "summary"); next = ATS.setSectionBody(cv, "summary", (b ? b.body.replace(/\s+$/, "") + (/[.!?]$/.test(b.body.trim()) ? " " : ". ") : "") + val.trim()); }
    else next = ATS.addBulletUnder(cv, +t.slice(1), val);
  }
  if (next === cv) return;
  const before = lastResult ? lastResult.overall : null;
  fixUndo.push(cv);
  $("cv").value = next;
  if (runScore({ noScroll: true, keepImprove: false })) {
    $("fixUndo").disabled = false;
    $("fixMsg").textContent = T("fixApplied", { a: N(before), b: N(lastResult.overall) });
    const nextItem = $("fix-" + it.id);
    if (nextItem) { nextItem.classList.add("hl"); setTimeout(() => nextItem.classList.remove("hl"), 1600); }
  }
}
$("fixUndo").addEventListener("click", () => {
  if (!fixUndo.length) return;
  $("cv").value = fixUndo.pop();
  if (runScore({ noScroll: true })) $("fixMsg").textContent = T("fixUndone", { b: N(lastResult.overall) });
  $("fixUndo").disabled = !fixUndo.length;
});
$("cvPdf").addEventListener("click", () => { if (lastInputs) exportPdf($("cv").value, $("cvPdfMsg"), $("cvPdf"), null); });

// ---------- Language switch ----------
$("langSel").value = I18N.lang;
$("langSel").addEventListener("change", () => {
  I18N.setLang($("langSel").value);
  $("fixMsg").textContent = ""; $("cvPdfMsg").textContent = "";
  renderCvInfo();
  showAiStatus();
  if (lastInputs) {
    // Recompute the rule-based report in the new language; Claude output must be rerun.
    lastResult = ATS.score(lastInputs.cv, lastInputs.jd, { title: lastInputs.title, parse: lastInputs.parse, lang: I18N.lang });
    const hadAi = !!$("aiOut").innerHTML, hadImp = !!$("impOut").innerHTML;
    render(lastResult, lastInputs.cv, { noScroll: true });
    if (hadAi) $("aiStatus").textContent = T("langChanged");
    if (hadImp) $("impStatus").textContent = T("langChanged");
  }
});

// ---------- Semantic analysis (via this app's Worker API) ----------
const TOKEN_KEY = "ats_access_token";
let aiReady = false, needToken = false, aiStatusKey = "checking", emailReady = false;
function getToken(){ try { return localStorage.getItem(TOKEN_KEY) || ""; } catch (e) { return ""; } }
function setToken(v){ try { v ? localStorage.setItem(TOKEN_KEY, v) : localStorage.removeItem(TOKEN_KEY); } catch (e) {} }
function showAiStatus(){ $("aiStatus").textContent = aiStatusKey ? T(aiStatusKey) : ""; }
$("aiBtn").style.display = "none";
showAiStatus();
fetch("api/status").then((r) => r.ok ? r.json() : Promise.reject(new Error("HTTP " + r.status))).then((st) => {
  aiReady = !!st.ai; needToken = !!st.auth; emailReady = !!st.email;
  if (needToken) { $("tokenRow").style.display = ""; $("token").value = getToken(); }
  if (!aiReady) { aiStatusKey = "noKey"; showAiStatus(); return; }
  aiStatusKey = null; showAiStatus();
  $("aiBtn").style.display = "";
}).catch(() => { aiStatusKey = "noApi"; showAiStatus(); });
$("token").addEventListener("change", () => setToken($("token").value.trim()));

function authHeaders(){
  const headers = { "content-type": "application/json" };
  const tok = needToken ? $("token").value.trim() : "";
  if (tok) { headers.authorization = "Bearer " + tok; setToken(tok); }
  return { headers, tok };
}
async function postJson(path, body){
  const { headers } = authHeaders();
  const r = await fetch(path, { method: "POST", headers, body: JSON.stringify(body) });
  const data = await r.json().catch(() => ({}));
  if (r.status === 401) throw new Error(T("badToken"));
  if (r.status === 429) throw new Error(T("rateLimited"));
  if (!r.ok) throw new Error(data.error || ("HTTP " + r.status));
  return data;
}

let aiBusy = false;
$("aiBtn").addEventListener("click", async () => {
  if (!aiReady || aiBusy) return;
  const cv = $("cv").value, jd = $("jd").value;
  if (cv.trim().split(/\s+/).length < 30 || jd.trim().split(/\s+/).length < 25) { $("aiStatus").innerHTML = `<span class="err">${esc(T("needBoth"))}</span>`; return; }
  aiBusy = true; $("aiBtn").disabled = true;
  $("aiStatus").innerHTML = ' <span class="spinner"></span> ' + esc(T("analyzing"));
  $("aiOut").innerHTML = "";
  try {
    const data = await postJson("api/analyze", { cv, jd, lang: I18N.lang });
    renderAi(data);
    $("aiStatus").textContent = "";
  } catch (e) {
    $("aiStatus").innerHTML = `<span class="err">${esc(T("analyzeFailed"))}${esc((e && e.message) || e)}</span>`;
  } finally { aiBusy = false; $("aiBtn").disabled = false; }
});
function renderAi(d){
  const sc = Math.max(0, Math.min(100, Math.round(+d.score || 0)));
  const reqs = Array.isArray(d.requirements) ? d.requirements : [];
  const st = { met: [`<span class="ok">✓ ${esc(T("met"))}</span>`, 0], partial: [`<span class="part">◐ ${esc(T("partial"))}</span>`, 1], missing: [`<span class="no">✗ ${esc(T("missing"))}</span>`, 2] };
  const sorted = reqs.slice().sort((a, b) => (a.type === "must" ? 0 : 1) - (b.type === "must" ? 0 : 1) || ((st[a.status] || st.missing)[1] - (st[b.status] || st.missing)[1]));
  const li = (arr) => (Array.isArray(arr) && arr.length ? `<ul class="list">${arr.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : `<p class="note">${esc(T("none"))}</p>`);
  const must = reqs.filter((r) => r.type === "must"), mustMet = must.filter((r) => r.status === "met").length;
  let h = `<div class="row" style="margin:14px 0 6px;gap:14px"><div style="font:800 34px Inter;color:${colorFor(sc)}">${sc}</div><div><b>${esc(bandFor(sc))}</b><div class="note">${esc(d.verdict || "")}</div><div class="note">${esc(T("mustMet", { a: N(mustMet), b: N(must.length) }))}</div></div></div>`;
  h += `<div style="overflow-x:auto"><table><thead><tr><th>${esc(T("aiTh1"))}</th><th>${esc(T("aiTh2"))}</th><th>${esc(T("aiTh3"))}</th><th>${esc(T("aiTh4"))}</th></tr></thead><tbody>` +
    sorted.map((r) => `<tr><td class="en">${esc(r.text)}</td><td><span class="tag ${r.type === "must" ? "t-req" : "t-pref"}">${esc(T(r.type === "must" ? "must" : "nice"))}</span></td><td>${(st[r.status] || st.missing)[0]}</td><td class="en">${esc(r.evidence || "")}</td></tr>`).join("") +
    `</tbody></table></div>`;
  if (Array.isArray(d.knockout_risks) && d.knockout_risks.length) h += `<div class="box bad"><h3>${esc(T("koH"))}</h3>${li(d.knockout_risks)}</div>`;
  h += `<div class="box tip"><h3>${esc(T("strengthsH"))}</h3>${li(d.strengths)}</div>`;
  h += `<div class="box warn"><h3>${esc(T("gapsH"))}</h3>${li(d.gaps)}</div>`;
  const rs = Array.isArray(d.rewrite_suggestions) ? d.rewrite_suggestions : [];
  if (rs.length) h += `<div class="box tip"><h3>${esc(T("rewriteH"))}</h3><ul class="list">${rs.map((s) => `<li><b><bdi>${esc(s.section || "")}</bdi></b>: ${esc(s.suggestion || "")}${s.based_on ? ` <span class="note">(${esc(T("basedOn"))}: <bdi>${esc(s.based_on)}</bdi>)</span>` : ""}</li>`).join("")}</ul></div>`;
  h += `<p class="note">${esc(T("aiDisclaimer"))}</p>`;
  $("aiOut").innerHTML = h;
}

// ---------- Application email (Workers AI, Llama) ----------
let emailBusy = false;
$("emailBtn").addEventListener("click", async () => {
  if (emailBusy) return;
  if (!lastResult || !lastInputs) { $("emailStatus").innerHTML = `<span class="err">${esc(T("scoreFirst"))}</span>`; return; }
  if (!emailReady) { $("emailStatus").innerHTML = `<span class="err">${esc(T("emailNoAI"))}</span>`; return; }
  const facts = ATS.buildEmailFacts(lastInputs.cv, lastResult);
  emailBusy = true; $("emailBtn").disabled = true;
  $("emailStatus").innerHTML = ' <span class="spinner"></span> ' + esc(T("emailWriting"));
  $("emailOut").innerHTML = "";
  try {
    if (needToken && !$("token").value.trim()) throw new Error(T("tokenFirst"));
    const title = lastInputs.title || ATS.guessTitle(lastInputs.jd);
    const d = await postJson("api/email", { jd: lastInputs.jd, facts, title, lang: I18N.lang });
    renderEmail(d, facts);
    $("emailStatus").textContent = "";
  } catch (e) {
    $("emailStatus").innerHTML = `<span class="err">${esc(T("emailFailed"))}${esc((e && e.message) || e)}</span>`;
  } finally { emailBusy = false; $("emailBtn").disabled = false; }
});
function renderEmail(d, facts){
  const v = ATS.validateEmail(d.body, facts.map((f) => f.text), lastInputs.jd, { lang: I18N.lang, maxWords: 150 });
  const sv = ATS.validateEmail(d.subject, facts.map((f) => f.text), lastInputs.jd, { lang: I18N.lang, maxWords: 30 });
  const errors = [...v.errors, ...sv.errors], warnings = [...new Set([...v.warnings, ...sv.warnings])];
  const ok = errors.length === 0;
  const to = (lastInputs.jd.match(/[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/) || [""])[0];
  let h = `<div class="mail ${ok ? "" : "rej"}"><div class="subj">${esc(d.subject)}</div><div class="body">${esc(d.body)}</div></div>`;
  h += `<p class="note">${esc(T("emailWords", { n: N(v.words), max: N(150) }))}${d.retried ? " · " + esc(T("emailRetried")) : ""}</p>`;
  if (!ok) h += `<div class="box bad"><h3>${esc(T("emailRejected"))}</h3><ul class="list">${errors.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>`;
  else h += `<p class="note" style="color:var(--good)">${esc(T("emailOk"))}</p>`;
  if (warnings.length) h += `<div class="box warn"><h3>${esc(T("emailCheck"))}</h3><ul class="list">${warnings.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>`;
  if (ok) {
    h += `<div class="actions"><button class="btn ghost" id="mailCopyS">${esc(T("copySubject"))}</button><button class="btn ghost" id="mailCopyB">${esc(T("copyBody"))}</button>`;
    if (to) h += `<a class="btn ghost" style="text-decoration:none" href="mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(d.subject)}&body=${encodeURIComponent(d.body)}">${esc(T("openMail"))} (${esc(to)})</a>`;
    h += `<span id="mailMsg" class="note"></span></div>`;
  }
  h += `<details><summary class="note">${esc(T("emailFacts", { n: N(facts.length) }))}</summary><ul class="list note">${facts.map((f) => `<li><bdi>${esc(f.id)} [${esc(f.label)}]: ${esc(f.text)}</bdi></li>`).join("")}</ul></details>`;
  $("emailOut").innerHTML = h;
  const copy = async (t) => { try { await navigator.clipboard.writeText(t); $("mailMsg").textContent = T("copied"); } catch (e) { $("mailMsg").textContent = T("copyFail"); } };
  if (ok) { $("mailCopyS").addEventListener("click", () => copy(d.subject)); $("mailCopyB").addEventListener("click", () => copy(d.body)); }
}

// ---------- Improve mode ----------
function renderQuestions(r){
  $("impOut").innerHTML = ""; $("impStatus").textContent = "";
  const miss = r.keywords.filter((k) => !k.hit && !k.soft).sort((a, b) => b.weight - a.weight).slice(0, 12);
  if (!miss.length) { $("impQ").innerHTML = `<p class="note">${esc(T("allKwPresent"))}</p>`; return; }
  $("impQ").innerHTML = `<p class="note" style="margin:0 0 6px">${esc(T("qIntro"))}</p>` +
    miss.map((k, i) => `<div class="q"><input type="checkbox" id="q${i}" data-kw="${esc(k.name)}"><label class="kw" for="q${i}">${esc(k.name)} ${lvTag(k.level)}</label>
      <input type="text" id="qa${i}" placeholder="e.g. Used ${esc(k.name)} daily at Example Institute (2021-2022)" disabled></div>`).join("");
  miss.forEach((k, i) => $("q" + i).addEventListener("change", (e) => { $("qa" + i).disabled = !e.target.checked; if (e.target.checked) $("qa" + i).focus(); }));
}

let impData = null, impBusy = false;
$("impBtn").addEventListener("click", async () => {
  if (impBusy) return;
  if (!lastResult || !lastInputs) { $("impStatus").innerHTML = `<span class="err">${esc(T("scoreFirst"))}</span>`; return; }
  if (!aiReady) { $("impStatus").innerHTML = `<span class="err">${esc(T("impNoKey"))}</span>`; return; }
  const facts = [];
  let bad = false;
  document.querySelectorAll("#impQ input[type=checkbox]").forEach((cb) => {
    if (!cb.checked) return;
    const ans = $("qa" + cb.id.slice(1)).value.trim();
    if (!ans) bad = true; else facts.push({ id: "U" + (facts.length + 1), keyword: cb.dataset.kw, text: ans });
  });
  if (bad) { $("impStatus").innerHTML = `<span class="err">${esc(T("needAnswer"))}</span>`; return; }
  $("impExtra").value.split("\n").map((x) => x.trim()).filter(Boolean).slice(0, 10).forEach((t) => facts.push({ id: "U" + (facts.length + 1), keyword: "other", text: t }));
  const lines = ATS.cvLines(lastInputs.cv).map(({ id, text }) => ({ id, text }));
  const targets = lastResult.keywords.filter((k) => !k.soft).map((k) => k.name);
  impBusy = true; $("impBtn").disabled = true;
  $("impStatus").innerHTML = ' <span class="spinner"></span> ' + esc(T("rewriting"));
  $("impOut").innerHTML = "";
  try {
    if (needToken && !$("token").value.trim()) throw new Error(T("tokenFirst"));
    const data = await postJson("api/improve", { cv: lastInputs.cv, jd: lastInputs.jd, lines, facts, targets, lang: I18N.lang });
    impData = prepareImprove(data, lines, facts);
    renderImprove();
    $("impStatus").textContent = "";
  } catch (e) {
    $("impStatus").innerHTML = `<span class="err">${esc(T("failed"))}${esc((e && e.message) || e)}</span>`;
  } finally { impBusy = false; $("impBtn").disabled = false; }
});

// Validate every suggestion against its cited sources; rejected ones can't be selected.
function prepareImprove(d, lines, facts){
  const src = Object.fromEntries([...lines.map((l) => [l.id, l.text]), ...facts.map((f) => [f.id, f.text])]);
  const srcLabel = Object.fromEntries([...lines.map((l) => [l.id, l.text]), ...facts.map((f) => [f.id, T("yourAnswer") + " (" + f.keyword + "): " + f.text])]);
  const check = (text, ids, item) => {
    const v = ATS.validateSuggestion(text, (ids || []).map((i) => src[i]).filter(Boolean), I18N.lang);
    if (item) v.errors.push(...ATS.checkPreserved(lastInputs.cv, { ...item, text }, I18N.lang));
    v.ok = v.errors.length === 0;
    return v;
  };
  const items = [];
  if (d.summary) { const v = check(d.summary.text, d.summary.sources, { kind: "summary" }); items.push({ kind: "summary", text: d.summary.text, sources: d.summary.sources, v, on: v.ok }); }
  (d.bullets || []).forEach((b) => { const v = check(b.text, b.sources, { kind: "bullet", replaces: b.replaces }); items.push({ kind: "bullet", replaces: b.replaces, after: b.after, before: b.replaces ? src[b.replaces] : "", text: b.text, sources: b.sources, v, on: v.ok }); });
  (d.add_to_skills || []).forEach((x) => { const v = check(x.text, x.sources); items.push({ kind: "skill", text: x.text, sources: x.sources, v, on: v.ok }); });
  return { items, tips: d.tips || [], srcLabel };
}

function improvedText(){
  const picks = { bullets: [], skills: [] };
  impData.items.filter((x) => x.on && x.v.ok).forEach((x) => {
    if (x.kind === "summary") picks.summary = { text: x.text };
    else if (x.kind === "bullet") picks.bullets.push({ replaces: x.replaces, after: x.after, text: x.text });
    else picks.skills.push({ text: x.text });
  });
  return ATS.applyImprovements(lastInputs.cv, picks);
}

function renderImprove(){
  const it = impData.items;
  const ok = it.filter((x) => x.v.ok).length, rej = it.length - ok;
  const srcChips = (ids) => (ids || []).map((i) => `<span class="src" title="${esc(impData.srcLabel[i] || "")}">${esc(i)}</span>`).join("") || `<span class="no">${esc(T("noSources"))}</span>`;
  const KIND = { summary: "kindSummary", bullet: "kindBullet", skill: "kindSkill" };
  let h = `<p class="note">${esc(T("sugCount", { n: N(it.length), ok: N(ok), rej: N(rej) }))}</p>`;
  h += it.map((x, i) => {
    const where = x.kind === "bullet" ? (x.replaces ? ` <span class="note">${esc(T("replaces"))} ${esc(x.replaces)}</span>` : ` <span class="note">${esc(T("newAfter"))} ${esc(x.after)}</span>`) : "";
    const head = `<div class="head"><label><input type="checkbox" data-i="${i}" ${x.on ? "checked" : ""} ${x.v.ok ? "" : "disabled"}> <b>${esc(T(KIND[x.kind]))}</b>${where}</label>
      <span>${esc(T("sources"))}: ${srcChips(x.sources)}</span></div>`;
    const body = (x.before ? `<div class="before">${esc(x.before)}</div>` : "") + `<div class="after">${esc(x.text)}</div>`;
    const errs = x.v.errors.length ? `<div class="err" style="margin-top:6px">${esc(T("rejected"))}${x.v.errors.map(esc).join(T("list"))}</div>` : "";
    const warns = x.v.warnings.length ? `<div class="note" style="margin-top:6px;color:var(--warn)">${esc(T("checkThis"))}${x.v.warnings.map(esc).join(T("list"))}</div>` : "";
    return `<div class="sug ${x.v.ok ? "" : "rej"}">${head}${body}${errs}${warns}</div>`;
  }).join("");
  if (impData.tips.length) h += `<div class="box tip"><h3>${esc(T("tipsH2"))}</h3><ul class="list">${impData.tips.map((t) => `<li>${esc(t)}</li>`).join("")}</ul></div>`;
  h += `<div class="card section-gap" style="background:var(--bg)"><h2>${esc(T("beforeAfter"))}</h2><div id="impCmp"></div>
    <div class="actions"><button class="btn" id="impCopy">${esc(T("copyNew"))}</button><button class="btn ghost" id="impUse">${esc(T("useNew"))}</button><button class="btn ghost" id="impPdf">${esc(T("dlPdf"))}</button><span id="impCopyMsg" class="note"></span></div>
    <div id="impPdfMsg" class="note"></div>
    <details><summary>${esc(T("fullNew"))}</summary><pre id="impText"></pre></details></div>`;
  $("impOut").innerHTML = h;
  $("impOut").querySelectorAll("input[type=checkbox][data-i]").forEach((cb) => cb.addEventListener("change", () => { impData.items[+cb.dataset.i].on = cb.checked; updateCompare(); }));
  $("impCopy").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(improvedText()); $("impCopyMsg").textContent = T("copied"); }
    catch (e) { $("impCopyMsg").textContent = T("copyFail"); }
  });
  $("impPdf").addEventListener("click", downloadPdf);
  $("impUse").addEventListener("click", () => { $("cv").value = improvedText(); cvParse = {}; cvInfoState = { msg: "replaced" }; renderCvInfo(); $("run").click(); });
  updateCompare();
}

// Build the PDF in the browser (no API call), download it, then read it back with the same parser and re-score it.
let pdfBusy = false;
function downloadPdf(){
  // Lines of the original CV that must still be in the improved text (all except the ones deliberately replaced).
  const picked = impData.items.filter((x) => x.on && x.v.ok);
  const replacedIds = new Set(picked.filter((x) => x.kind === "bullet" && x.replaces).map((x) => x.replaces));
  const sb = picked.some((x) => x.kind === "summary") ? ATS.summaryBody(lastInputs.cv) : null;
  const kept = ATS.cvLines(lastInputs.cv).filter((l) => !replacedIds.has(l.id) && !(sb && l.index >= sb.start && l.index < sb.end)).map((l) => l.text).join("\n");
  return exportPdf(improvedText(), $("impPdfMsg"), $("impPdf"), kept);
}
async function exportPdf(text, msg, btn, kept){
  if (pdfBusy) return;
  pdfBusy = true; btn.disabled = true;
  msg.innerHTML = '<span class="spinner"></span> ' + esc(T("pdfBuilding"));
  try {
    const { doc, file, dropped } = await CVPDF.build(text);
    const buf = doc.output("arraybuffer");
    doc.save(file);
    const back = await readPdf(buf.slice(0));
    const o = { title: lastInputs.title, lang: I18N.lang };
    const sText = ATS.score(text, lastInputs.jd, o).overall;
    const sPdf = ATS.score(back.text, lastInputs.jd, o).overall;
    // Every line must survive: the text given -> PDF, and (improve mode) the original CV -> improved text.
    const lostCv = kept == null ? [] : ATS.missingLines(kept, text);
    const lostPdf = ATS.missingLines(text, back.text);
    const nLines = text.split("\n").filter((x) => x.trim()).length;
    const short = (arr) => arr.slice(0, 5).map((x) => "\u201c" + (x.length > 70 ? x.slice(0, 70) + "\u2026" : x) + "\u201d").join(T("list")) + (arr.length > 5 ? " \u2026" : "");
    const parts = [esc(T("pdfSaved", { file }))];
    if (back.parse.emptyText) parts.push(`<span class="err">${esc(T("pdfNoText"))}</span>`);
    else parts.push(esc(T("pdfCheck", { a: sPdf, b: sText })) + (Math.abs(sPdf - sText) <= 2 ? " ✓" : ` <span class="err">${esc(T("pdfDiff"))}</span>`));
    if (lostCv.length) parts.push(`<span class="err">${esc(T("cvMissing", { n: N(lostCv.length), list: short(lostCv) }))}</span>`);
    if (lostPdf.length) parts.push(`<span class="err">${esc(T("pdfMissing", { n: N(lostPdf.length), list: short(lostPdf) }))}</span>`);
    else parts.push(esc(T("pdfAllLines", { n: N(nLines) })) + " \u2713");
    if (dropped.length) parts.push(`<span class="err">${esc(T("pdfDropped", { chars: dropped.join(" ") }))}</span>`);
    msg.innerHTML = parts.join("<br>");
  } catch (e) {
    msg.innerHTML = `<span class="err">${esc(T("pdfFailed"))}${esc((e && e.message) || e)}</span>`;
  } finally { pdfBusy = false; btn.disabled = false; }
}

function updateCompare(){
  const text = improvedText();
  const o = { title: lastInputs.title, lang: I18N.lang };
  const after = ATS.score(text, lastInputs.jd, o);
  const before = ATS.score(lastInputs.cv, lastInputs.jd, o);
  const d = (a, b) => (a == null || b == null) ? "" : b > a ? `<span class="up">+${b - a}</span>` : b < a ? `<span class="down">${b - a}</span>` : "0";
  let h = `<div class="cmp"><div class="h">${esc(T("cmpPart"))}</div><div class="h">${esc(T("cmpBefore"))}</div><div class="h">${esc(T("cmpAfter"))}</div><div class="h">${esc(T("cmpDelta"))}</div>
    <div><b>${esc(T("cmpTotal"))}</b></div><div><b>${before.overall}</b></div><div><b>${after.overall}</b></div><div>${d(before.overall, after.overall)}</div>`;
  for (const k of Object.keys(before.components)) {
    const a = before.components[k].score, b = after.components[k].score;
    h += `<div>${esc(before.components[k].label)}</div><div>${a == null ? "?" : a}</div><div>${b == null ? "?" : b}</div><div>${d(a, b)}</div>`;
  }
  const fb = before.gate.filter((g) => g.status === "fail").length, fa2 = after.gate.filter((g) => g.status === "fail").length;
  h += `<div>${esc(T("cmpGate"))}</div><div>${fb}</div><div>${fa2}</div><div>${fa2 < fb ? `<span class="up">${fa2 - fb}</span>` : ""}</div></div>`;
  $("impCmp").innerHTML = h;
  $("impText").textContent = text;
}
})();
