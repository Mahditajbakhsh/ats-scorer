// Builds a clean, ATS-friendly CV PDF (single column, real selectable text) from CV plain text.
// Layout: navy serif name and section headings (Source Serif 4, OFL, bundled in /fonts),
// Noto Sans body (OFL, bundled), contact row with vector icons, title/date rows, bullets, numbered publications,
// and a label/value table for skills. Icons are drawn as shapes so they add no text for an ATS.
(function (root) {
  "use strict";
  const JSPDF_URL = "https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js";
  const FONT_FILES = {
    SourceSerif: { normal: "fonts/SourceSerif4-400Regular.ttf", semibold: "fonts/SourceSerif4-600SemiBold.ttf", bold: "fonts/SourceSerif4-700Bold.ttf" },
    NotoSans: { normal: "fonts/NotoSans-400Regular.ttf", italic: "fonts/NotoSans-400Regular_Italic.ttf", bold: "fonts/NotoSans-700Bold.ttf" },
  };
  const NAVY = [22, 41, 94], TEXT = [34, 34, 34], MUTED = [85, 85, 85], RULE = [160, 172, 205];
  const PT = 0.3528; // mm per point

  let loading = null;
  function loadJsPdf() {
    if (root.jspdf && root.jspdf.jsPDF) return Promise.resolve();
    if (!loading) {
      loading = new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = JSPDF_URL;
        s.onload = () => (root.jspdf && root.jspdf.jsPDF ? resolve() : reject(new Error("jsPDF did not load")));
        s.onerror = () => { loading = null; reject(new Error("jsPDF did not load")); };
        document.head.appendChild(s);
      });
    }
    return loading;
  }
  let fontCache = null;
  async function loadFonts() {
    if (fontCache) return fontCache;
    const out = {};
    for (const [fam, styles] of Object.entries(FONT_FILES)) {
      out[fam] = {};
      for (const [style, url] of Object.entries(styles)) {
        const r = await fetch(url);
        if (!r.ok) throw new Error("font " + url + " HTTP " + r.status);
        const u8 = new Uint8Array(await r.arrayBuffer());
        let s = "";
        for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
        out[fam][style] = btoa(s);
      }
    }
    fontCache = out;
    return out;
  }

  // ---------- character safety ----------
  const WIN_ANSI = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ");
  const MAP = { "≥": ">=", "≤": "<=", "→": "->", "←": "<-", "−": "-", "‐": "-", "‑": "-", "‒": "-", "―": "-", "✓": "", "✔": "", "▪": "•", "●": "•", "◦": "•", "·": "•", " ": " ", "​": "", " ": " ", " ": " ", "\t": " " };
  let EXT = false; // true when embedded fonts with Latin Extended-A are available
  function clean(str, dropped, serif) {
    serif = serif || EXT;
    let out = "";
    for (const ch of String(str)) {
      if (MAP[ch] !== undefined) { out += MAP[ch]; continue; }
      const c = ch.codePointAt(0);
      if ((c >= 32 && c <= 126) || (c >= 160 && c <= 255) || WIN_ANSI.has(ch)) { out += ch; continue; }
      if (serif && c >= 0x100 && c <= 0x17f) { out += ch; continue; }
      dropped.add(ch);
    }
    return out;
  }

  // ---------- structure detection ----------
  const BULLET = /^\s*[•\-*▪●◦·]\s+/;
  const NUMBERED = /^\s*(\d{1,2})[.)]\s+/;
  const HEAD_WORDS = new Set(("summary profile objective about me research interests interest education experience work professional employment history " +
    "academic research projects project publications publication presentations presentation conference conferences talks posters teaching supervision " +
    "mentoring courses course training certifications certificates licenses skills skill technical computational laboratory languages language awards " +
    "honors honours grants funding scholarships fellowships references referees volunteering volunteer activities memberships membership patents " +
    "selected key other additional relevant core competencies expertise tools technologies service leadership and of & internships internship").split(/\s+/));
  function isHeadingText(t) {
    const s = t.trim();
    if (!s || s.length > 45 || /\d/.test(s) || /[.:;,!?@]$/.test(s) || /@|https?:|www\./i.test(s)) return false;
    if (/[A-Z]/.test(s) && s === s.toUpperCase() && s.length > 2) return true;
    const words = s.toLowerCase().replace(/&/g, " & ").split(/\s+/).filter(Boolean);
    return words.length > 0 && words.length <= 5 && words.every((w) => HEAD_WORDS.has(w)) && words.some((w) => !["and", "of", "&", "selected", "key", "other", "additional", "relevant", "core"].includes(w));
  }
  const DATE_RX = () => /((?:(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+)?\d{4}|\d{1,2}[\/.]\d{4})\s*(?:-|–|—|to|until)\s*((?:(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+)?\d{4}|\d{1,2}[\/.]\d{4}|[Pp]resent|[Cc]urrent|[Nn]ow|[Oo]ngoing)/;
  function splitDate(line) {
    const m = line.match(DATE_RX());
    if (!m) return null;
    const start = m.index, end = m.index + m[0].length;
    const before = line.slice(0, start), after = line.slice(end);
    // Only treat as a title row if the date sits at the end (or start) of the line.
    if (after.replace(/[\s,;|.)(]+/g, "").length > 0 && before.trim().length > 0) return null;
    const title = (before + " " + after).replace(/[\s,;|—–\-(]+$/g, "").replace(/^[\s,;|—–\-)]+/, "").replace(/\s+/g, " ").trim();
    return { title, date: m[0].replace(/\s*(-|–|—)\s*/, " – ").trim() };
  }
  function contactKind(item) {
    const s = item.toLowerCase();
    if (/@/.test(s)) return "mail";
    if (/linkedin/.test(s)) return "in";
    if (/orcid|\b\d{4}-\d{4}-\d{4}-\d{3}[\dx]\b/.test(s)) return "orcid";
    if (/scholar/.test(s)) return "scholar";
    if (/github/.test(s)) return "gh";
    if (/https?:|www\.|\.[a-z]{2,}\//.test(s)) return "web";
    if (/^\+?[\d\s()\-./]{7,}$/.test(item.trim())) return "phone";
    return "pin";
  }

  async function build(text, opts) {
    opts = opts || {};
    await loadJsPdf();
    const { jsPDF } = root.jspdf;
    const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
    let SERIF = "times", SANS = "helvetica";
    EXT = false;
    try {
      const f = await loadFonts();
      for (const [fam, styles] of Object.entries(f)) for (const [style, data] of Object.entries(styles)) { doc.addFileToVFS(fam + "-" + style + ".ttf", data); doc.addFont(fam + "-" + style + ".ttf", fam, style); }
      SERIF = "SourceSerif"; SANS = "NotoSans"; EXT = true;
    } catch (e) { /* fall back to built-in Times and Helvetica */ }
    const serifStyle = (s) => (SERIF === "times" ? (s === "normal" ? "normal" : "bold") : s);
    const sansStyle = (s) => (SANS === "helvetica" ? s : s === "bolditalic" ? "bold" : s);

    const dropped = new Set();
    const M = 16, W = 210 - 2 * M, BOTTOM = 297 - 14;
    let y = 14;

    const color = (c) => doc.setTextColor(c[0], c[1], c[2]);
    const font = (fam, style, size) => { if (fam === "helvetica") fam = SANS; doc.setFont(fam, fam === SERIF ? serifStyle(style) : sansStyle(style)); doc.setFontSize(size); };
    const ensure = (h) => { if (y + h > BOTTOM) { doc.addPage(); y = 14; } };

    // Rich text: segments [{t, s: "normal"|"bold"|"italic"|"bolditalic"}], Helvetica, wrapped to width.
    function rich(segs, x, width, size, col, lhFactor) {
      const lh = size * PT * (lhFactor || 1.32);
      const words = [];
      segs.forEach((sg) => String(sg.t).split(/(\s+)/).forEach((w) => { if (w) words.push({ t: w, s: sg.s || "normal" }); }));
      const lines = [[]];
      let lineW = 0;
      for (const w of words) {
        font("helvetica", w.s, size);
        const ww = doc.getTextWidth(w.t);
        const isSpace = /^\s+$/.test(w.t);
        if (!isSpace && lineW + ww > width && lines[lines.length - 1].length) { lines.push([]); lineW = 0; }
        if (isSpace && !lines[lines.length - 1].length) continue;
        lines[lines.length - 1].push({ ...w, w: ww });
        lineW += ww;
      }
      color(col || TEXT);
      for (const ln of lines) {
        while (ln.length && /^\s+$/.test(ln[ln.length - 1].t)) ln.pop();
        ensure(lh);
        let cx = x;
        // merge neighbouring words of the same style so text extraction keeps normal spacing
        const runs = [];
        ln.forEach((w) => { const last = runs[runs.length - 1]; if (last && last.s === w.s) { last.t += w.t; last.w += w.w; } else runs.push({ ...w }); });
        for (const r of runs) { font("helvetica", r.s, size); doc.text(r.t, cx, y + size * PT); cx += doc.getTextWidth(r.t.replace(/\s+$/, "")) + (/\s$/.test(r.t) ? doc.getTextWidth("n") * 0.55 : 0); }
        y += lh;
      }
    }
    const plain = (t, s) => [{ t: clean(t, dropped), s: s || "normal" }];

    // ---------- icons (vector only) ----------
    function icon(kind, x, cy) {
      const r = 1.35;
      doc.setDrawColor(NAVY[0], NAVY[1], NAVY[2]); doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]); doc.setLineWidth(0.28);
      if (kind === "mail") { doc.rect(x, cy - 1.0, 2.9, 2.0); doc.line(x, cy - 1.0, x + 1.45, cy + 0.2); doc.line(x + 2.9, cy - 1.0, x + 1.45, cy + 0.2); }
      else if (kind === "phone") { doc.roundedRect(x + 0.6, cy - 1.45, 1.7, 2.9, 0.35, 0.35); doc.line(x + 1.15, cy + 1.0, x + 1.75, cy + 1.0); }
      else if (kind === "pin") { doc.circle(x + 1.45, cy - 0.45, 0.95); doc.triangle(x + 0.62, cy - 0.05, x + 2.28, cy - 0.05, x + 1.45, cy + 1.5, "F"); }
      else if (kind === "in") { doc.roundedRect(x + 0.1, cy - r, 2.7, 2.7, 0.45, 0.45, "F"); }
      else if (kind === "orcid") { doc.circle(x + 1.45, cy, r, "F"); }
      else if (kind === "scholar") { doc.triangle(x, cy - 0.2, x + 2.9, cy - 0.2, x + 1.45, cy - 1.4, "F"); doc.rect(x + 0.75, cy - 0.2, 1.4, 1.1, "F"); }
      else if (kind === "gh") { doc.circle(x + 1.45, cy, r); doc.circle(x + 1.45, cy, 0.55, "F"); }
      else { doc.circle(x + 1.45, cy, r); doc.line(x + 0.1, cy, x + 2.8, cy); }
    }

    // ---------- parse ----------
    const raw = String(text || "").replace(/\r/g, "").split("\n");
    let i = raw.findIndex((l) => l.trim());
    if (i < 0) throw new Error("empty");
    const name = clean(raw[i].trim(), dropped, true);
    const surname = (name.split(/\s+/).pop() || "").replace(/[^A-Za-zÀ-ž'\-]/g, "");
    i++;
    const header = [];
    while (i < raw.length && !isHeadingText(raw[i])) { if (raw[i].trim()) header.push(raw[i].trim()); i++; }
    let subtitle = "";
    if (header.length && !/@|https?:|www\.|\||\d{5,}|linkedin|github/i.test(header[0]) && header[0].length <= 90) subtitle = header.shift();
    const contacts = [];
    header.forEach((l) => l.split(/\s+[|•·]\s+|\s{3,}/).map((x) => x.trim()).filter(Boolean).forEach((x) => contacts.push(x)));

    // ---------- header ----------
    font(SERIF, "bold", 25); color(NAVY);
    doc.text(name, M, y + 25 * PT * 0.82);
    y += 25 * PT * 1.02;
    if (subtitle) { font(SERIF, "semibold", 12.5); color(NAVY); doc.text(clean(subtitle, dropped, true), M, y + 12.5 * PT * 0.9); y += 12.5 * PT * 1.4; }
    if (contacts.length) {
      y += 1;
      const size = 8.8, lh = size * PT * 1.7;
      let cx = M;
      font("helvetica", "normal", size);
      const sepW = doc.getTextWidth("  |  ");
      contacts.forEach((c, k) => {
        const t = clean(c, dropped);
        const w = 3.8 + doc.getTextWidth(t);
        if (k > 0 && cx + sepW + w > M + W) { cx = M; y += lh; } else if (k > 0) { color(MUTED); doc.text("  |  ", cx, y + size * PT); cx += sepW; }
        ensure(lh);
        icon(contactKind(c), cx, y + size * PT * 0.62);
        color(TEXT); font("helvetica", "normal", size);
        doc.text(t, cx + 3.8, y + size * PT);
        cx += w;
      });
      y += lh;
    }

    // ---------- body ----------
    let section = "", afterTitle = false, pubNo = 0;
    const sectionIs = (rx) => rx.test(section);
    for (; i < raw.length; i++) {
      const line = raw[i];
      const t = line.trim();
      if (!t) { y += 1.2; afterTitle = false; continue; }

      if (isHeadingText(t)) {
        section = t.toLowerCase(); afterTitle = false; pubNo = 0;
        y += 2.4; ensure(14);
        doc.setDrawColor(NAVY[0], NAVY[1], NAVY[2]); doc.setLineWidth(0.55); doc.line(M, y, M + W, y);
        y += 1.6;
        font(SERIF, "semibold", 13.5); color(NAVY);
        doc.text(clean(t.replace(/^([A-Z])([A-Z\s&]+)$/, (m0) => m0.length > 3 ? m0.toLowerCase().replace(/(^|\s|&)([a-z])/g, (q, a, b) => a + b.toUpperCase()) : m0), dropped, true), M + 0.5, y + 13.5 * PT * 0.85);
        y += 13.5 * PT * 1.1;
        doc.setDrawColor(RULE[0], RULE[1], RULE[2]); doc.setLineWidth(0.3); doc.line(M, y, M + W, y);
        y += 1.8;
        continue;
      }

      // Publications: numbered, candidate surname bold, journal italic
      if (sectionIs(/publication|paper|article/)) {
        pubNo++;
        const body = clean(t.replace(BULLET, "").replace(NUMBERED, ""), dropped);
        const marks = [];
        if (surname.length > 1) { const rx = new RegExp("\\b" + surname.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?:\\s+[A-Z]{1,3}\\.?)?", "g"); let m; while ((m = rx.exec(body))) marks.push([m.index, m.index + m[0].length, "bold"]); }
        const jm = body.match(/\.\s+([A-Z][A-Za-z&:'\-\s]{3,80}?),\s+(?:vol\.?\s*\d+|\d+\s*\(|(?:19|20)\d{2})/);
        if (jm) { const st = jm.index + jm[0].indexOf(jm[1]); marks.push([st, st + jm[1].length, "italic"]); }
        marks.sort((a, b) => a[0] - b[0]);
        const segs = []; let p = 0;
        marks.forEach(([a, b, s]) => { if (a < p) return; if (a > p) segs.push({ t: body.slice(p, a), s: "normal" }); segs.push({ t: body.slice(a, b), s }); p = b; });
        if (p < body.length) segs.push({ t: body.slice(p), s: "normal" });
        font("helvetica", "normal", 9.5); color(TEXT); ensure(5);
        doc.text(pubNo + ".", M + 1.5, y + 9.5 * PT);
        rich(segs, M + 7, W - 7, 9.5);
        y += 0.8;
        continue;
      }

      // Bullets
      if (BULLET.test(line) || NUMBERED.test(line)) {
        const num = line.match(NUMBERED);
        const body = clean(t.replace(BULLET, "").replace(NUMBERED, ""), dropped);
        let segs = [{ t: body, s: "normal" }];
        const pm = body.match(/^(.{3,45}?)\s+[–—]\s+/);
        if (pm && (sectionIs(/conference|presentation|talk|poster|award|honou?r|grant|fellowship/) || /\d{4}/.test(pm[1]))) segs = [{ t: pm[1], s: "bold" }, { t: body.slice(pm[1].length), s: "normal" }];
        font("helvetica", "normal", 9.5); color(TEXT); ensure(5);
        if (num) doc.text(num[1] + ".", M + 2.5, y + 9.5 * PT); else { doc.setFillColor(TEXT[0], TEXT[1], TEXT[2]); doc.circle(M + 3.6, y + 9.5 * PT * 0.64, 0.5, "F"); }
        rich(segs, M + 7, W - 7, 9.5);
        y += 0.5;
        continue;
      }

      // Title row with right-aligned dates
      const sd = splitDate(t);
      if (sd && sd.title) {
        y += 0.8;
        const date = clean(sd.date, dropped);
        font("helvetica", "normal", 9.5); const dw = doc.getTextWidth(date);
        ensure(9);
        const yTop = y;
        rich(plain(sd.title, "bold"), M, W - dw - 6, 9.8);
        font("helvetica", "normal", 9.5); color(TEXT);
        doc.text(date, M + W, yTop + 9.8 * PT, { align: "right" });
        afterTitle = true;
        continue;
      }

      // Skills table "Label: value"
      const kv = t.match(/^([^:]{2,38}):\s+(.+)$/);
      if (kv && sectionIs(/skill|tool|technolog|competenc|expertise|language/)) {
        const yTop = y;
        font("helvetica", "bold", 9.5);
        const labelLines = doc.splitTextToSize(clean(kv[1] + ":", dropped), 50);
        ensure(5);
        color(TEXT); labelLines.forEach((l, k) => doc.text(l, M, yTop + 9.5 * PT + k * 9.5 * PT * 1.32));
        rich(plain(kv[2]), M + 54, W - 54, 9.5);
        y = Math.max(y, yTop + labelLines.length * 9.5 * PT * 1.32) + 0.5;
        continue;
      }

      // Institution line right after a title row, or a normal paragraph
      rich(plain(t), M, W, 9.5);
      if (afterTitle) afterTitle = false;
    }

    doc.setProperties({ title: (name || "CV") + " CV", subject: "Curriculum vitae", creator: "" });
    const file = (name || "CV").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "") + "_CV.pdf";
    return { doc, file, dropped: [...dropped], serif: SERIF !== "times", sans: SANS !== "helvetica" };
  }

  root.CVPDF = { build };
})(window);
