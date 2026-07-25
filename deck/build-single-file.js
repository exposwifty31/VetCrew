/*
 * Packs the deck into ONE self-contained HTML file for email:
 *   - styles.css + tokens/*.css inlined (imports resolved)
 *   - Google Fonts downloaded and embedded as base64 @font-face (hebrew+latin)
 *   - the three iframe pages (mountain, split-screen, t2-nibp) inlined via srcdoc
 *   - monitor.js inlined into the split-screen page
 *   - assets/aar-screen.png embedded as a data URI
 *
 * Usage:  node build-single-file.js   →  dist/VetCrew-Concept.html
 */
const fs = require("fs");
const path = require("path");
const https = require("https");

const DECK = __dirname;
const OUT_DIR = path.join(DECK, "dist");
const OUT = path.join(OUT_DIR, "VetCrew-Concept.html");

// woff2-capable UA so Google serves woff2 with unicode-range subsets
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { "User-Agent": UA } }, (res) => {
      if (res.statusCode !== 200) return reject(new Error(`${res.statusCode} ${url}`));
      let d = "";
      res.on("data", (c) => (d += c));
      res.on("end", () => resolve(d));
    }).on("error", reject);
  });
}

function fetchBuf(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { "User-Agent": UA } }, (res) => {
      if (res.statusCode !== 200) return reject(new Error(`${res.statusCode} ${url}`));
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks)));
    }).on("error", reject);
  });
}

/** Download the Google Fonts CSS and return it with every woff2 embedded,
 *  keeping only the hebrew and latin unicode-range subsets. */
async function buildEmbeddedFontsCss(importUrl) {
  const css = await fetchText(importUrl);
  // split into individual "/* subset */ @font-face {...}" blocks
  const blocks = css.split(/(?=\/\* [a-z-]+ \*\/)/g).filter((b) => b.includes("@font-face"));
  const keep = blocks.filter((b) => /^\/\* (hebrew|latin) \*\//.test(b.trim()));
  const out = [];
  for (const block of keep) {
    const m = block.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.woff2)\)/);
    if (!m) continue;
    const buf = await fetchBuf(m[1]);
    out.push(
      block.replace(m[1], `data:font/woff2;base64,${buf.toString("base64")}`)
    );
    process.stdout.write(`  font ${path.basename(m[1])}  ${(buf.length / 1024).toFixed(0)}KB\n`);
  }
  return out.join("\n");
}

/** styles.css → flat CSS: resolve local @imports; swap the Google import
 *  for the embedded @font-face rules. */
function flattenCss(file, fontsCss) {
  const src = fs.readFileSync(path.join(DECK, file), "utf8");
  return src.replace(/@import url\((['"]?)([^'")]+)\1\);?/g, (_, __, url) => {
    if (url.startsWith("https://fonts.googleapis.com")) return fontsCss;
    return flattenCss(path.join(path.dirname(file), url), fontsCss);
  });
}

function esc(html) {
  // srcdoc attribute escaping (attribute is double-quoted)
  return html.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

(async () => {
  // 1. fonts — pull the import URL out of tokens/fonts.css
  const fontsCssSrc = fs.readFileSync(path.join(DECK, "tokens/fonts.css"), "utf8");
  const importUrl = fontsCssSrc.match(/@import url\('([^']+)'\)/)[1];
  console.log("embedding fonts (hebrew + latin subsets)…");
  const fontsCss = await buildEmbeddedFontsCss(importUrl);

  const flatCss = flattenCss("styles.css", fontsCss);
  const styleTag = `<style>\n${flatCss}\n</style>`;
  const inlineStyles = (html) =>
    html.replace(/<link rel="stylesheet" href="styles.css">/, styleTag);

  // 2. child pages → self-contained strings
  const monitorJs = fs.readFileSync(path.join(DECK, "monitor.js"), "utf8");
  const child = {};
  for (const f of ["mountain.html", "split-screen.html", "t2-nibp.html"]) {
    let html = inlineStyles(fs.readFileSync(path.join(DECK, f), "utf8"));
    html = html.replace(
      /<script src="monitor.js"><\/script>/,
      () => `<script>\n${monitorJs}\n</script>`
    );
    child[f] = html;
  }

  // 3. main page
  let index = inlineStyles(fs.readFileSync(path.join(DECK, "index.html"), "utf8"));

  // iframes: data-src → srcdoc (loads immediately; the lazy-loader no-ops)
  index = index.replace(
    /<iframe([^>]*?) data-src="([^"]+)"><\/iframe>/g,
    (_, attrs, src) => `<iframe${attrs} srcdoc="${esc(child[src])}"></iframe>`
  );

  // AAR screenshot → data URI
  const png = fs.readFileSync(path.join(DECK, "assets/aar-screen.png"));
  index = index.replace(
    'src="assets/aar-screen.png"',
    `src="data:image/png;base64,${png.toString("base64")}"`
  );

  const leftovers = index.match(/data-src=|href="styles|src="assets\/|src="monitor/);
  if (leftovers) throw new Error("unresolved external reference: " + leftovers[0]);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT, index);
  console.log(`\nwrote ${OUT}  (${(fs.statSync(OUT).size / 1024 / 1024).toFixed(2)} MB)`);
})();
