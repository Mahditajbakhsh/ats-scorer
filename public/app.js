(function(){
"use strict";
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fa = (n) => String(n).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[d]);
let cvParse = {};
let lastResult = null;

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

  let adv = "";
  if (r.knockouts.length) adv += `<div class="box bad"><h3>ریسک‌های حذفی احتمالی</h3><ul class="list">${r.knockouts.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>`;
  if (r.tips.length) adv += `<div class="box tip"><h3>پیشنهادها</h3><ul class="list">${r.tips.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>`;
  const fw = r.warnings.filter((w) => !r.knockouts.includes(w));
  if (fw.length) adv += `<div class="box warn"><h3>ساختار و خوانایی</h3><ul class="list">${fw.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>`;
  adv += `<p class="note" style="margin-bottom:0">فقط مهارتی را اضافه کنید که واقعاً دارید و در مصاحبه می‌توانید از آن دفاع کنید. پر کردن رزومه با کلمه کلیدی یا متن مخفی معمولاً هنگام استخراج متن یا بررسی انسانی دیده می‌شود.</p>`;
  $("advice").innerHTML = adv;

  renderKw("all");
  $("parsed").textContent = cvText;
  $("secs").innerHTML = r.sections.length ? r.sections.map((s) => `<bdi>${esc(s)}</bdi>`).join("، ") : "هیچ‌کدام";
  $("aiOut").innerHTML = ""; if (aiReady) $("aiStatus").textContent = "";
  $("results").scrollIntoView({ behavior: "smooth", block: "start" });
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
    lastResult = ATS.score(cv, jd, { title: $("title").value, parse: cvParse });
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
})();
