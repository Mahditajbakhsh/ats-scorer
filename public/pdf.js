// Builds a simple, ATS-friendly PDF (single column, real selectable text) from CV plain text.
// Uses jsPDF with the standard Helvetica font, so only Latin characters can be embedded;
// anything else is mapped to an ASCII equivalent or reported as dropped.
(function (root) {
  "use strict";
  const JSPDF_URL = "https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js";
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

  // Characters the standard PDF fonts (WinAnsi) can show, besides Latin-1.
  const WIN_ANSI = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ");
  const MAP = { "≥": ">=", "≤": "<=", "→": "->", "←": "<-", "−": "-", "‐": "-", "‑": "-", "‒": "-", "―": "-", "✓": "", "✔": "", "▪": "•", "●": "•", "◦": "•", "·": "•", " ": " ", "​": "", " ": " ", " ": " " };
  function clean(str, dropped) {
    let out = "";
    for (const ch of String(str)) {
      if (MAP[ch] !== undefined) { out += MAP[ch]; continue; }
      const c = ch.codePointAt(0);
      if ((c >= 32 && c <= 126) || (c >= 160 && c <= 255) || WIN_ANSI.has(ch)) { out += ch; continue; }
      if (c === 9) { out += " "; continue; }
      dropped.add(ch);
    }
    return out;
  }

  const BULLET = /^\s*[•\-*▪●◦·]\s+/;
  function isHeading(line, idx, headingIdx) {
    if (headingIdx.has(idx)) return true;
    const t = line.trim();
    return t.length > 1 && t.length <= 40 && /[A-Z]/.test(t) && t === t.toUpperCase() && !/\d{4}/.test(t) && !/@/.test(t);
  }

  async function build(text, opts) {
    opts = opts || {};
    await loadJsPdf();
    const { jsPDF } = root.jspdf;
    const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
    const dropped = new Set();
    const PT = 0.3528; // mm per point
    const M = 18, W = 210 - 2 * M, H = 297, BOTTOM = H - 16;
    let y = M;

    const raw = String(text || "").replace(/\r/g, "").split("\n");
    const headingIdx = new Set();
    try { Object.values(root.ATS.detectSections(text)).forEach((s) => headingIdx.add(s.start)); } catch (e) {}
    const hasDates = (l) => { try { return root.ATS.parseRanges(l).length > 0; } catch (e) { return false; } };

    const ensure = (h) => { if (y + h > BOTTOM) { doc.addPage(); y = M; } };
    const write = (str, size, style, indent, color) => {
      doc.setFont("helvetica", style || "normal");
      doc.setFontSize(size);
      doc.setTextColor(color || 20);
      const width = W - (indent || 0);
      const parts = doc.splitTextToSize(str, width);
      const lh = size * PT * 1.35;
      parts.forEach((p) => { ensure(lh); doc.text(p, M + (indent || 0), y + size * PT); y += lh; });
    };

    // Name: first non-empty line. Contact block: lines before the first heading.
    let i = raw.findIndex((l) => l.trim());
    if (i < 0) throw new Error("empty");
    const name = clean(raw[i].trim(), dropped);
    write(name, 18, "bold");
    y += 1;
    i++;
    while (i < raw.length && !isHeading(raw[i], i, headingIdx)) {
      const t = raw[i].trim();
      if (t) write(clean(t, dropped), 9.5, "normal", 0, 70);
      i++;
    }
    y += 2;

    for (; i < raw.length; i++) {
      const line = raw[i];
      const t = line.trim();
      if (!t) { y += 1.5; continue; }
      if (isHeading(line, i, headingIdx)) {
        y += 3;
        ensure(10);
        write(clean(t.toUpperCase(), dropped), 11.5, "bold", 0, 20);
        doc.setDrawColor(150); doc.setLineWidth(0.3);
        doc.line(M, y + 0.3, M + W, y + 0.3);
        y += 2.5;
        continue;
      }
      if (BULLET.test(line)) {
        const body = clean(t.replace(BULLET, ""), dropped);
        doc.setFont("helvetica", "normal"); doc.setFontSize(10);
        const parts = doc.splitTextToSize(body, W - 5);
        const lh = 10 * PT * 1.35;
        parts.forEach((p, k) => { ensure(lh); if (k === 0) doc.text("•", M + 1, y + 10 * PT); doc.text(p, M + 5, y + 10 * PT); y += lh; });
        continue;
      }
      write(clean(t, dropped), 10, hasDates(t) ? "bold" : "normal");
    }

    doc.setProperties({ title: (name || "CV") + " CV", subject: "Curriculum vitae", creator: "" });
    const file = (name || "CV").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "") + "_CV.pdf";
    return { doc, file, dropped: [...dropped] };
  }

  root.CVPDF = { build };
})(window);
