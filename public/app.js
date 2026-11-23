(function(){
"use strict";
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fa = (n) => String(n).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[d]);
let cvParse = {};
let lastResult = null;
let lastInputs = null;

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

async function readPdf(buf){
  if (!setupPdf()) throw new Error("کتابخانه PDF بارگذاری نشد");
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
          if (gap > vp.width * 0.12 && line.trim().length > 2 && it.s.trim().length > 2) split = true;
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
      iconGlyphs: (text.match(/[\uE000-\uF8FF\uFFFC-\uFFFE]/g) || []).length,
      pages: pdf.numPages,
    },
  };
}
async function readDocx(buf){
  if (!window.mammoth) throw new Error("کتابخانه Word بارگذاری نشد");
  const raw = await mammoth.extractRawText({ arrayBuffer: buf });
  let tables = 0;
  try { const html = await mammoth.convertToHtml({ arrayBuffer: buf }); tables = (html.value.match(/<table/g) || []).length; } catch (e) {}
  const text = raw.value.replace(/\n{3,}/g, "\n\n");
  return { text, parse: { tables, iconGlyphs: (text.match(/[\uE000-\uF8FF\uFFFC-\uFFFE]/g) || []).length, emptyText: text.replace(/\s/g, "").length < 150 } };
}
async function readFile(file){
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return readPdf(await file.arrayBuffer());
  if (name.endsWith(".docx")) return readDocx(await file.arrayBuffer());
  if (name.endsWith(".doc")) throw new Error("فرمت قدیمی .doc پشتیبانی نمی‌شود؛ آن را DOCX یا PDF ذخیره کنید");
  return { text: await file.text(), parse: {} };
}

function wireFile(inputId, dropId, targetId, infoId, isCv){
  const input = $(inputId), drop = $(dropId);
  const handle = async (file) => {
    if (!file) return;
    const info = infoId ? $(infoId) : null;
    if (info) info.innerHTML = '<span class="spinner"></span> در حال خواندن ' + esc(file.name);
    try {
      const r = await readFile(file);
      $(targetId).value = r.text.trim();
      if (isCv) {
        cvParse = r.parse || {};
        const bits = [esc(file.name)];
        if (r.parse.pages) bits.push(fa(r.parse.pages) + " صفحه");
        bits.push(fa(r.text.split(/\s+/).filter(Boolean).length) + " کلمه استخراج شد");
        if (r.parse.emptyText) bits.push('<span class="err">متن قابل‌خواندنی پیدا نشد؛ احتمالاً PDF تصویری است</span>');
        if (r.parse.multiColumn) bits.push('<span class="err">احتمال چیدمان چندستونی</span>');
        if (r.parse.tables) bits.push('<span class="err">' + fa(r.parse.tables) + " جدول</span>");
        if (info) info.innerHTML = bits.join(" · ");
      }
    } catch (e) {
      if (info) info.innerHTML = '<span class="err">خطا در خواندن فایل: ' + esc(e.message || e) + "</span>";
    }
  };
  input.addEventListener("change", () => handle(input.files[0]));
  ["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("over"); }));
  ["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("over"); }));
  drop.addEventListener("drop", (e) => handle(e.dataTransfer.files[0]));
}
wireFile("cvFile", "cvDrop", "cv", "cvInfo", true);
wireFile("jdFile", "jdDrop", "jd", null, false);
$("cv").addEventListener("input", () => { if (!$("cv").value.trim()) { cvParse = {}; $("cvInfo").textContent = ""; } });

function colorFor(s){ return s >= 80 ? "var(--good)" : s >= 65 ? "var(--accent)" : s >= 50 ? "var(--mid)" : "var(--bad)"; }
function bandFor(s){ return s >= 80 ? "تطابق قوی" : s >= 65 ? "تطابق خوب" : s >= 50 ? "تطابق متوسط" : "تطابق ضعیف"; }
const LV = { req: ["الزامی", "t-req"], task: ["وظیفه", "t-task"], neutral: ["متن آگهی", "t-neutral"], pref: ["امتیاز", "t-pref"], offer: ["بخش مزایا", "t-offer"] };

function render(r, cvText){
  $("results").style.display = "block";
  $("overall").textContent = r.overall;
  const arc = $("arc");
  arc.style.stroke = colorFor(r.overall);
  arc.style.transition = "stroke-dashoffset .8s ease";
  requestAnimationFrame(() => { arc.style.strokeDashoffset = String(452.4 * (1 - r.overall / 100)); });
  $("band").textContent = bandFor(r.overall);
  $("band").style.color = colorFor(r.overall);

  $("comps").innerHTML = Object.values(r.components).map((c) => {
    const na = c.score == null;
    return `<div class="comp"><div class="name">${esc(c.label)}<small>وزن ${fa(c.weight)}${na ? " · محاسبه نشد" : ""}</small></div>
      <div class="bar"><i style="width:${na ? 0 : c.score}%;background:${na ? "transparent" : colorFor(c.score)}"></i></div>
      <div class="val">${na ? "؟" : c.score}</div><div class="det">${esc(c.detail)}</div></div>`;
  }).join("");

  renderGate(r.gate || []);

  let adv = "";
  if (r.tips.length) adv += `<div class="box tip"><h3>پیشنهادها</h3><ul class="list">${r.tips.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>`;
  const fw = r.warnings.filter((w) => !r.knockouts.includes(w));
  if (fw.length) adv += `<div class="box warn"><h3>ساختار و خوانایی</h3><ul class="list">${fw.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>`;
  adv += `<p class="note" style="margin-bottom:0">فقط مهارتی را اضافه کنید که واقعاً دارید و در مصاحبه می‌توانید از آن دفاع کنید. پر کردن رزومه با کلمه کلیدی یا متن مخفی معمولاً هنگام استخراج متن یا بررسی انسانی دیده می‌شود.</p>`;
  $("advice").innerHTML = adv;

  renderKw("all");
  renderQuestions(r);
  $("parsed").textContent = cvText;
  $("secs").innerHTML = r.sections.length ? r.sections.map((s) => `<bdi>${esc(s)}</bdi>`).join("، ") : "هیچ‌کدام";
  $("aiOut").innerHTML = ""; if (aiReady) $("aiStatus").textContent = "";
  $("results").scrollIntoView({ behavior: "smooth", block: "start" });
}
const GS = { pass: ["قبول", "st-pass"], fail: ["رد", "st-fail"], unknown: ["نامعلوم", "st-unknown"] };
function renderGate(gate){
  $("gateCard").style.display = gate.length ? "" : "none";
  const fails = gate.filter((g) => g.status === "fail").length, unk = gate.filter((g) => g.status === "unknown").length;
  $("gateBanner").innerHTML = fails ? `<div class="box bad" style="margin:0 0 10px"><h3>${fa(fails)} شرط حذفی رد شده</h3>با این وضعیت احتمال حذف خودکار زیاد است، حتی اگر نمره بالا باشد.</div>`
    : unk ? `<div class="box warn" style="margin:0 0 10px">هیچ شرطی رد نشده؛ ${fa(unk)} مورد نامعلوم است.</div>`
    : `<div class="box tip" style="margin:0 0 10px">همه شرط‌های حذفی قابل‌تشخیص قبول هستند.</div>`;
  $("gateBody").innerHTML = gate.map((g) => `<tr><td>${esc(g.label)}</td><td class="en">${esc(g.requirement)}</td>
    <td><span class="st ${GS[g.status][1]}">${GS[g.status][0]}</span></td>
    <td>${g.evidence ? `<bdi>${esc(g.evidence)}</bdi><br>` : ""}<span class="note">${esc(g.note)}</span></td></tr>`).join("");
}

function renderKw(f){
  if (!lastResult) return;
  document.querySelectorAll("#kwTabs button").forEach((b) => b.classList.toggle("on", b.dataset.f === f));
  const rows = lastResult.keywords.filter((k) => f === "all" || (f === "hit" ? k.hit : !k.hit));
  $("kwBody").innerHTML = rows.length ? rows.map((k) => {
    const lv = LV[k.level] || LV.neutral;
    return `<tr><td class="en">${esc(k.name)}${k.soft ? ' <span class="tag t-neutral">نرم</span>' : ""}${k.extra ? ' <span class="tag t-neutral">دیگر</span>' : ""}</td>
      <td><span class="tag ${lv[1]}">${lv[0]}</span></td><td class="en">${k.weight}</td>
      <td>${k.hit ? '<span class="ok">✓</span>' + (k.inSkills ? ' <span class="note">در Skills</span>' : "") : '<span class="no">✗</span>'}</td>
      <td class="en">${esc(k.evidence || "")}</td></tr>`;
  }).join("") : `<tr><td colspan="5" class="note">موردی نیست</td></tr>`;
}
$("kwTabs").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) renderKw(b.dataset.f); });

$("run").addEventListener("click", () => {
  const cv = $("cv").value, jd = $("jd").value;
  $("runErr").textContent = "";
  if (cv.trim().split(/\s+/).length < 30) { $("runErr").textContent = "متن رزومه خیلی کوتاه است یا خالی است."; return; }
  if (jd.trim().split(/\s+/).length < 25) { $("runErr").textContent = "متن آگهی خیلی کوتاه است؛ متن کامل آگهی را بچسبانید."; return; }
  try {
    lastInputs = { cv, jd, title: $("title").value, parse: cvParse };
    lastResult = ATS.score(cv, jd, { title: lastInputs.title, parse: cvParse });
    render(lastResult, cv);
  } catch (e) { $("runErr").textContent = "خطا در محاسبه: " + (e.message || e); }
});

// ---------- Claude semantic analysis (via this app's Worker API) ----------
const TOKEN_KEY = "ats_access_token";
let aiReady = false, needToken = false;
function getToken(){ try { return localStorage.getItem(TOKEN_KEY) || ""; } catch (e) { return ""; } }
function setToken(v){ try { v ? localStorage.setItem(TOKEN_KEY, v) : localStorage.removeItem(TOKEN_KEY); } catch (e) {} }
$("aiBtn").style.display = "none";
$("aiStatus").textContent = "در حال بررسی دسترسی…";
fetch("api/status").then((r) => r.ok ? r.json() : Promise.reject(new Error("HTTP " + r.status))).then((st) => {
  aiReady = !!st.ai; needToken = !!st.auth;
  if (!aiReady) { $("aiStatus").textContent = "کلید Anthropic روی سرور تنظیم نشده؛ تحلیل معنایی غیرفعال است. نمره کلمه‌محور بالا کامل کار می‌کند."; return; }
  $("aiBtn").style.display = ""; $("aiStatus").textContent = "";
  if (needToken) { $("tokenRow").style.display = ""; $("token").value = getToken(); }
}).catch(() => { $("aiStatus").textContent = "API سرور در دسترس نیست؛ تحلیل معنایی غیرفعال است."; });
$("token").addEventListener("change", () => setToken($("token").value.trim()));

let aiBusy = false;
$("aiBtn").addEventListener("click", async () => {
  if (!aiReady || aiBusy) return;
  const cv = $("cv").value, jd = $("jd").value;
  if (cv.trim().split(/\s+/).length < 30 || jd.trim().split(/\s+/).length < 25) { $("aiStatus").innerHTML = '<span class="err">اول رزومه و آگهی کامل را وارد کنید.</span>'; return; }
  aiBusy = true; $("aiBtn").disabled = true;
  $("aiStatus").innerHTML = ' <span class="spinner"></span> در حال تحلیل… (ممکن است تا یک دقیقه طول بکشد)';
  $("aiOut").innerHTML = "";
  try {
    const headers = { "content-type": "application/json" };
    const tok = needToken ? $("token").value.trim() : "";
    if (tok) { headers.authorization = "Bearer " + tok; setToken(tok); }
    const r = await fetch("api/analyze", { method: "POST", headers, body: JSON.stringify({ cv, jd }) });
    const data = await r.json().catch(() => ({}));
    if (r.status === 401) throw new Error("رمز دسترسی درست نیست.");
    if (r.status === 429) throw new Error("تعداد درخواست‌ها زیاد بود؛ کمی بعد دوباره امتحان کنید.");
    if (!r.ok) throw new Error(data.error || ("HTTP " + r.status));
    renderAi(data);
    $("aiStatus").textContent = "";
  } catch (e) {
    $("aiStatus").innerHTML = '<span class="err">تحلیل انجام نشد: ' + esc((e && e.message) || e) + "</span>";
  } finally { aiBusy = false; $("aiBtn").disabled = false; }
});
function renderAi(d){
  const sc = Math.max(0, Math.min(100, Math.round(+d.score || 0)));
  const reqs = Array.isArray(d.requirements) ? d.requirements : [];
  const st = { met: ['<span class="ok">✓ دارد</span>', 0], partial: ['<span class="part">◐ تا حدی</span>', 1], missing: ['<span class="no">✗ ندارد</span>', 2] };
  const sorted = reqs.slice().sort((a, b) => (a.type === "must" ? 0 : 1) - (b.type === "must" ? 0 : 1) || ((st[a.status] || st.missing)[1] - (st[b.status] || st.missing)[1]));
  const li = (arr) => (Array.isArray(arr) && arr.length ? `<ul class="list">${arr.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : '<p class="note">موردی نیست</p>');
  const must = reqs.filter((r) => r.type === "must"), mustMet = must.filter((r) => r.status === "met").length;
  let h = `<div class="row" style="margin:14px 0 6px;gap:14px"><div style="font:800 34px Inter;color:${colorFor(sc)}">${sc}</div><div><b>${esc(bandFor(sc))}</b><div class="note">${esc(d.verdict || "")}</div><div class="note">شرط‌های الزامی برآورده‌شده: ${fa(mustMet)} از ${fa(must.length)}</div></div></div>`;
  h += `<div style="overflow-x:auto"><table><thead><tr><th>شرط آگهی</th><th>نوع</th><th>وضعیت</th><th>شاهد در رزومه</th></tr></thead><tbody>` +
    sorted.map((r) => `<tr><td class="en">${esc(r.text)}</td><td><span class="tag ${r.type === "must" ? "t-req" : "t-pref"}">${r.type === "must" ? "الزامی" : "امتیاز"}</span></td><td>${(st[r.status] || st.missing)[0]}</td><td class="en">${esc(r.evidence || "")}</td></tr>`).join("") +
    `</tbody></table></div>`;
  if (Array.isArray(d.knockout_risks) && d.knockout_risks.length) h += `<div class="box bad"><h3>ریسک‌های حذفی</h3>${li(d.knockout_risks)}</div>`;
  h += `<div class="box tip"><h3>نقاط قوت</h3>${li(d.strengths)}</div>`;
  h += `<div class="box warn"><h3>کمبودها</h3>${li(d.gaps)}</div>`;
  const rs = Array.isArray(d.rewrite_suggestions) ? d.rewrite_suggestions : [];
  if (rs.length) h += `<div class="box tip"><h3>پیشنهاد بازنویسی (فقط بر پایه محتوای فعلی رزومه)</h3><ul class="list">${rs.map((s) => `<li><b><bdi>${esc(s.section || "")}</bdi></b>: ${esc(s.suggestion || "")}${s.based_on ? ` <span class="note">(بر اساس: <bdi>${esc(s.based_on)}</bdi>)</span>` : ""}</li>`).join("")}</ul></div>`;
  h += `<p class="note">این تحلیل را یک مدل زبانی انجام داده و ممکن است خطا داشته باشد؛ شاهدها را با رزومه خودتان چک کنید.</p>`;
  $("aiOut").innerHTML = h;
}

// ---------- Improve mode ----------
function renderQuestions(r){
  $("impOut").innerHTML = ""; $("impStatus").textContent = "";
  const miss = r.keywords.filter((k) => !k.hit && !k.soft).sort((a, b) => b.weight - a.weight).slice(0, 12);
  if (!miss.length) { $("impQ").innerHTML = '<p class="note">همه کلمات کلیدی سخت آگهی در رزومه هست. باز هم می‌توانید بازنویسی بگیرید.</p>'; return; }
  $("impQ").innerHTML = `<p class="note" style="margin:0 0 6px">این‌ها در آگهی هست و در رزومه نیست. فقط مواردی را تیک بزنید که واقعاً دارید و یک خط بنویسید کجا و چطور (به انگلیسی). موارد تیک‌نخورده وارد رزومه نمی‌شوند.</p>` +
    miss.map((k, i) => `<div class="q"><input type="checkbox" id="q${i}" data-kw="${esc(k.name)}"><label class="kw" for="q${i}">${esc(k.name)} <span class="tag ${(LV[k.level] || LV.neutral)[1]}">${(LV[k.level] || LV.neutral)[0]}</span></label>
      <input type="text" id="qa${i}" placeholder="e.g. Used ${esc(k.name)} daily at Example Institute (2021-2022)" disabled></div>`).join("");
  miss.forEach((k, i) => $("q" + i).addEventListener("change", (e) => { $("qa" + i).disabled = !e.target.checked; if (e.target.checked) $("qa" + i).focus(); }));
}

let impData = null, impBusy = false;
$("impBtn").addEventListener("click", async () => {
  if (impBusy) return;
  if (!lastResult || !lastInputs) { $("impStatus").innerHTML = '<span class="err">اول نمره را محاسبه کنید.</span>'; return; }
  if (!aiReady) { $("impStatus").innerHTML = '<span class="err">کلید Anthropic روی سرور تنظیم نشده؛ این بخش به Claude نیاز دارد.</span>'; return; }
  const facts = [];
  let bad = false;
  document.querySelectorAll("#impQ input[type=checkbox]").forEach((cb) => {
    if (!cb.checked) return;
    const ans = $("qa" + cb.id.slice(1)).value.trim();
    if (!ans) bad = true; else facts.push({ id: "U" + (facts.length + 1), keyword: cb.dataset.kw, text: ans });
  });
  if (bad) { $("impStatus").innerHTML = '<span class="err">برای هر مورد تیک‌خورده یک خط توضیح بنویسید.</span>'; return; }
  $("impExtra").value.split("\n").map((x) => x.trim()).filter(Boolean).slice(0, 10).forEach((t) => facts.push({ id: "U" + (facts.length + 1), keyword: "other", text: t }));
  const lines = ATS.cvLines(lastInputs.cv).map(({ id, text }) => ({ id, text }));
  const targets = lastResult.keywords.filter((k) => !k.soft).map((k) => k.name);
  impBusy = true; $("impBtn").disabled = true;
  $("impStatus").innerHTML = ' <span class="spinner"></span> در حال بازنویسی… (ممکن است تا دو دقیقه طول بکشد)';
  $("impOut").innerHTML = "";
  try {
    const headers = { "content-type": "application/json" };
    const tok = needToken ? $("token").value.trim() : "";
    if (tok) { headers.authorization = "Bearer " + tok; setToken(tok); }
    if (needToken && !tok) throw new Error("رمز دسترسی را در بخش تحلیل معنایی وارد کنید.");
    const r = await fetch("api/improve", { method: "POST", headers, body: JSON.stringify({ cv: lastInputs.cv, jd: lastInputs.jd, lines, facts, targets }) });
    const data = await r.json().catch(() => ({}));
    if (r.status === 401) throw new Error("رمز دسترسی درست نیست.");
    if (r.status === 429) throw new Error("تعداد درخواست‌ها زیاد بود؛ کمی بعد دوباره امتحان کنید.");
    if (!r.ok) throw new Error(data.error || ("HTTP " + r.status));
    impData = prepareImprove(data, lines, facts);
    renderImprove();
    $("impStatus").textContent = "";
  } catch (e) {
    $("impStatus").innerHTML = '<span class="err">انجام نشد: ' + esc((e && e.message) || e) + "</span>";
  } finally { impBusy = false; $("impBtn").disabled = false; }
});

// Validate every suggestion against its cited sources; rejected ones can't be selected.
function prepareImprove(d, lines, facts){
  const src = Object.fromEntries([...lines.map((l) => [l.id, l.text]), ...facts.map((f) => [f.id, f.text])]);
  const srcLabel = Object.fromEntries([...lines.map((l) => [l.id, l.text]), ...facts.map((f) => [f.id, "پاسخ شما (" + f.keyword + "): " + f.text])]);
  const check = (text, ids) => ATS.validateSuggestion(text, (ids || []).map((i) => src[i]).filter(Boolean));
  const items = [];
  if (d.summary) { const v = check(d.summary.text, d.summary.sources); items.push({ kind: "summary", text: d.summary.text, sources: d.summary.sources, v, on: v.ok }); }
  (d.bullets || []).forEach((b) => { const v = check(b.text, b.sources); items.push({ kind: "bullet", replaces: b.replaces, after: b.after, before: b.replaces ? src[b.replaces] : "", text: b.text, sources: b.sources, v, on: v.ok }); });
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
  const srcChips = (ids) => (ids || []).map((i) => `<span class="src" title="${esc(impData.srcLabel[i] || "")}">${esc(i)}</span>`).join("") || '<span class="no">بدون منبع</span>';
  const KIND = { summary: "خلاصه پروفایل", bullet: "بولت", skill: "مهارت برای بخش Skills" };
  let h = `<p class="note">${fa(it.length)} پیشنهاد: ${fa(ok)} معتبر، ${fa(rej)} رد شده. روی شناسه منبع (مثلاً L10) نگه دارید تا متن منبع را ببینید.</p>`;
  h += it.map((x, i) => {
    const head = `<div class="head"><label><input type="checkbox" data-i="${i}" ${x.on ? "checked" : ""} ${x.v.ok ? "" : "disabled"}> <b>${KIND[x.kind]}</b>${x.kind === "bullet" ? (x.replaces ? ` <span class="note">جایگزین ${esc(x.replaces)}</span>` : ` <span class="note">بولت جدید بعد از ${esc(x.after)}</span>`) : ""}</label>
      <span>منبع: ${srcChips(x.sources)}</span></div>`;
    const body = (x.before ? `<div class="before">${esc(x.before)}</div>` : "") + `<div class="after">${esc(x.text)}</div>`;
    const errs = x.v.errors.length ? `<div class="err" style="margin-top:6px">رد شد: ${x.v.errors.map(esc).join("، ")}</div>` : "";
    const warns = x.v.warnings.length ? `<div class="note" style="margin-top:6px;color:var(--warn)">بررسی کنید: ${x.v.warnings.map(esc).join("، ")}</div>` : "";
    return `<div class="sug ${x.v.ok ? "" : "rej"}">${head}${body}${errs}${warns}</div>`;
  }).join("");
  if (impData.tips.length) h += `<div class="box tip"><h3>نکته‌ها</h3><ul class="list">${impData.tips.map((t) => `<li>${esc(t)}</li>`).join("")}</ul></div>`;
  h += `<div class="card section-gap" style="background:var(--bg)"><h2>نمره قبل و بعد</h2><div id="impCmp"></div>
    <div class="actions"><button class="btn" id="impCopy">کپی رزومه جدید</button><button class="btn ghost" id="impUse">جایگزین در کادر رزومه و محاسبه دوباره</button><span id="impCopyMsg" class="note"></span></div>
    <details><summary>متن کامل رزومه جدید</summary><pre id="impText"></pre></details></div>`;
  $("impOut").innerHTML = h;
  $("impOut").querySelectorAll("input[type=checkbox][data-i]").forEach((cb) => cb.addEventListener("change", () => { impData.items[+cb.dataset.i].on = cb.checked; updateCompare(); }));
  $("impCopy").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(improvedText()); $("impCopyMsg").textContent = "کپی شد."; }
    catch (e) { $("impCopyMsg").textContent = "کپی خودکار ممکن نشد؛ متن را از بخش «متن کامل» دستی کپی کنید."; }
  });
  $("impUse").addEventListener("click", () => { $("cv").value = improvedText(); cvParse = {}; $("cvInfo").textContent = "متن بهبودیافته جایگزین شد."; $("run").click(); });
  updateCompare();
}

function updateCompare(){
  const text = improvedText();
  const after = ATS.score(text, lastInputs.jd, { title: lastInputs.title });
  const before = ATS.score(lastInputs.cv, lastInputs.jd, { title: lastInputs.title });
  const d = (a, b) => (a == null || b == null) ? "" : b > a ? `<span class="up">+${b - a}</span>` : b < a ? `<span class="down">${b - a}</span>` : "۰";
  let h = `<div class="cmp"><div class="h">بخش</div><div class="h">قبل</div><div class="h">بعد</div><div class="h">تغییر</div>
    <div><b>نمره کل</b></div><div><b>${before.overall}</b></div><div><b>${after.overall}</b></div><div>${d(before.overall, after.overall)}</div>`;
  for (const k of Object.keys(before.components)) {
    const a = before.components[k].score, b = after.components[k].score;
    h += `<div>${esc(before.components[k].label)}</div><div>${a == null ? "؟" : a}</div><div>${b == null ? "؟" : b}</div><div>${d(a, b)}</div>`;
  }
  const fb = before.gate.filter((g) => g.status === "fail").length, fa2 = after.gate.filter((g) => g.status === "fail").length;
  h += `<div>شرط‌های حذفی رد شده</div><div>${fb}</div><div>${fa2}</div><div>${fa2 < fb ? `<span class="up">${fa2 - fb}</span>` : ""}</div></div>`;
  $("impCmp").innerHTML = h;
  $("impText").textContent = text;
}
})();
