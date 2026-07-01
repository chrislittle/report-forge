#!/usr/bin/env node
'use strict';
/*
 * report-forge — build a single self-contained HTML report from a JSON manifest.
 *
 *   node report-forge.js <manifest.json> [options]
 *
 * Options:
 *   --out <file>       Output path (default: <manifest basename>.html next to the manifest)
 *   --no-linkcheck     Skip external link verification
 *   --strict-links     Exit non-zero if any external link is not HTTP 200
 *   --link-timeout <ms> Per-link timeout (default 15000)
 *   --quiet            Less console output
 *
 * Zero runtime dependencies. Requires Node 18+ (uses global fetch).
 * MIT licensed. Vendor-neutral — no organisation-specific concepts.
 */

const fs = require('fs');
const path = require('path');

// ----------------------------------------------------------------------------
// small utils
// ----------------------------------------------------------------------------
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
function escAttr(s) {
  return esc(s).replace(/"/g, '&quot;');
}

// Minimal inline markdown -> HTML (links, bold, italics, inline code).
function inline(s) {
  if (s == null) return '';
  let t = String(s);
  t = t.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    (m, txt, url) => `<a href="${escAttr(url)}">${txt}</a>`);
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
  t = t.replace(/`([^`]+)`/g, (m, c) => `<code>${esc(c)}</code>`);
  return t;
}

// Block markdown-lite: paragraphs + "-"/"*" bullet lists + raw-HTML passthrough.
function mdBlock(s) {
  if (s == null) return '';
  const lines = String(s).split(/\r?\n/);
  let html = '';
  let inList = false;
  const flush = () => { if (inList) { html += '</ul>'; inList = false; } };
  for (const raw of lines) {
    const line = raw.trim();
    if (line === '') { flush(); continue; }
    if (/^[-*]\s+/.test(line)) {
      if (!inList) { html += '<ul>'; inList = true; }
      html += `<li>${inline(line.replace(/^[-*]\s+/, ''))}</li>`;
    } else if (/^<.+>/.test(line)) {
      flush(); html += line; // raw HTML line, passed through untouched
    } else {
      flush(); html += `<p>${inline(line)}</p>`;
    }
  }
  flush();
  return html;
}

const MIME = { png: 'png', jpg: 'jpeg', jpeg: 'jpeg', gif: 'gif', webp: 'webp', svg: 'svg+xml' };

// ----------------------------------------------------------------------------
// block renderers
// ----------------------------------------------------------------------------
function renderImage(block, baseDir) {
  const p = path.resolve(baseDir, block.src);
  const buf = fs.readFileSync(p);
  const ext = path.extname(p).slice(1).toLowerCase();
  const mime = MIME[ext] || ext;
  const alt = escAttr(block.alt || block.caption || '');
  const cap = block.caption ? `<p class="sub">${inline(block.caption)}</p>` : '';
  return `<img class="shot" alt="${alt}" src="data:image/${mime};base64,${buf.toString('base64')}" />${cap}`;
}

function renderCode(block, baseDir) {
  let code = block.code != null ? block.code
    : fs.readFileSync(path.resolve(baseDir, block.src), 'utf8');
  code = String(code).replace(/\r\n/g, '\n');
  let out = esc(code);

  // Highlight a region. Two modes:
  //   highlight.lines: [from, to]          (1-based, inclusive)
  //   highlight.wrap:  [startMarker, endMarkerExclusive]
  const hl = block.highlight;
  if (hl && Array.isArray(hl.lines)) {
    const [from, to] = hl.lines;
    const arr = out.split('\n');
    for (let i = from - 1; i <= to - 1 && i < arr.length; i++) {
      arr[i] = `<span class="hl">${arr[i]}</span>`;
    }
    out = arr.join('\n');
  } else if (hl && Array.isArray(hl.wrap)) {
    const start = out.indexOf(esc(hl.wrap[0]));
    if (start >= 0) {
      const endMarker = hl.wrap[1];
      const end = endMarker ? out.indexOf(esc(endMarker), start) : out.length;
      if (end > start) {
        out = out.slice(0, start) + '<span class="hl">' + out.slice(start, end) +
          '</span>' + out.slice(end);
      }
    }
  }

  const lang = block.language ? `<div class="code-lang">${esc(block.language)}</div>` : '';
  const cap = block.caption ? `<p class="sub">${inline(block.caption)}</p>` : '';
  return `<div class="codewrap">${lang}<pre>${out}</pre></div>${cap}`;
}

function renderTable(t) {
  let h = '<table><thead><tr>' +
    t.headers.map((x) => `<th>${inline(x)}</th>`).join('') +
    '</tr></thead><tbody>';
  (t.rows || []).forEach((row, i) => {
    const cls = (t.highlightRows || []).includes(i + 1) ? ' class="hl-row"' : '';
    h += `<tr${cls}>` + row.map((c) => `<td>${inline(c)}</td>`).join('') + '</tr>';
  });
  h += '</tbody></table>';
  return h;
}

function renderVerdict(v) {
  const tone = v.tone || 'info';
  return `<div class="verdict ${tone}">${mdBlock(v.body || v.html || '')}</div>`;
}

function renderSection(sec, baseDir) {
  let h = '';
  if (sec.heading) h += `<h2>${inline(sec.heading)}</h2>`;
  if (sec.body) h += mdBlock(sec.body);
  if (sec.callout) h += `<div class="callout ${sec.callout.tone || 'info'}">${mdBlock(sec.callout.body || sec.callout.html || '')}</div>`;
  if (sec.table) h += renderTable(sec.table);
  if (Array.isArray(sec.blocks)) {
    for (const b of sec.blocks) {
      if (b.type === 'subheading') h += `<h3>${inline(b.text)}</h3>`;
      else if (b.type === 'image') h += renderImage(b, baseDir);
      else if (b.type === 'code') h += renderCode(b, baseDir);
      else if (b.type === 'html') h += b.html || '';
      else if (b.type === 'text') h += mdBlock(b.body || '');
    }
  }
  if (Array.isArray(sec.links)) {
    h += '<ul>' + sec.links.map((l) =>
      `<li><a href="${escAttr(l.url)}">${esc(l.text || l.url)}</a></li>`).join('') + '</ul>';
  }
  return h;
}

// ----------------------------------------------------------------------------
// theme + template
// ----------------------------------------------------------------------------
function themeCss(theme = {}) {
  const t = Object.assign({
    accent: '#4f46e5', accentDark: '#4338ca',
    ink: '#1f2328', muted: '#57606a', line: '#e5e7eb', bg: '#f8fafc',
    ok: '#15803d', warn: '#b45309', danger: '#b91c1c', info: '#4f46e5',
    hlBg: '#5a2323', hlInk: '#ffd9d4',
    font: "'Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif",
    mono: "'Cascadia Code',Consolas,'SFMono-Regular',Menlo,monospace",
  }, theme);
  return `:root{--accent:${t.accent};--accent-dark:${t.accentDark};--ink:${t.ink};--muted:${t.muted};--line:${t.line};--bg:${t.bg};--ok:${t.ok};--warn:${t.warn};--danger:${t.danger};--info:${t.info};--hl-bg:${t.hlBg};--hl-ink:${t.hlInk};}
*{box-sizing:border-box}
body{font-family:${t.font};color:var(--ink);background:var(--bg);margin:0;line-height:1.55;}
.wrap{max-width:1040px;margin:0 auto;padding:32px 24px 64px;}
header{border-bottom:4px solid var(--accent);padding-bottom:16px;margin-bottom:8px;}
h1{font-size:26px;margin:0 0 4px;}
h2{font-size:19px;margin:32px 0 10px;color:var(--accent-dark);border-bottom:1px solid var(--line);padding-bottom:6px;}
h3{font-size:15px;margin:20px 0 8px;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;}
.sub{color:var(--muted);font-size:13px;}
.meta{display:flex;flex-wrap:wrap;gap:8px 28px;margin:14px 0 4px;font-size:13.5px;}
.meta div span{color:var(--muted);}
.verdict{padding:14px 18px;border-radius:6px;margin:18px 0;font-size:15px;border:1px solid var(--line);border-left:5px solid var(--info);background:#f5f6ff;}
.verdict.ok{background:#f1f9f3;border-left-color:var(--ok);}
.verdict.warn,.verdict.danger{background:#fdf3f1;border-left-color:var(--danger);}
.callout{border:1px solid var(--line);border-left:5px solid var(--info);padding:12px 16px;border-radius:6px;margin:16px 0;font-size:13.5px;background:#f5f6ff;}
.callout.warn,.callout.danger{background:#fdf3f1;border-left-color:var(--danger);}
.callout.ok{background:#f1f9f3;border-left-color:var(--ok);}
table{width:100%;border-collapse:collapse;margin:10px 0 4px;font-size:13.5px;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.06);border-radius:6px;overflow:hidden;}
th{background:var(--accent);color:#fff;text-align:left;padding:10px 12px;font-weight:600;font-size:12.5px;}
td{padding:9px 12px;border-top:1px solid var(--line);vertical-align:top;}
tr:nth-child(even) td{background:#fcfcfd;}
tr.hl-row td{background:#fdf3f1;}
code{background:#eef0f3;padding:1px 6px;border-radius:4px;font-family:${t.mono};font-size:12.5px;}
.codewrap{margin:10px 0;}
.code-lang{display:inline-block;background:#111827;color:#9ca3af;font-family:${t.mono};font-size:11px;padding:2px 10px;border-radius:6px 6px 0 0;}
pre{background:#1e1e1e;color:#d4d4d4;padding:14px 16px;border-radius:6px;overflow:auto;font-size:12px;font-family:${t.mono};line-height:1.5;margin:0;}
.code-lang + pre{border-top-left-radius:0;}
.hl{background:var(--hl-bg);color:var(--hl-ink);display:inline-block;width:100%;}
img.shot{max-width:100%;border:1px solid var(--line);border-radius:6px;display:block;margin:8px 0;}
ul{margin:8px 0;padding-left:22px;}li{margin:4px 0;}
a{color:var(--accent);text-decoration:none;}a:hover{text-decoration:underline;}
footer{margin-top:40px;padding-top:14px;border-top:1px solid var(--line);color:var(--muted);font-size:12px;}`;
}

function buildHtml(m, baseDir) {
  const meta = (m.meta || []).map((x) =>
    `<div><span>${esc(x.label)}:</span> ${inline(x.value)}</div>`).join('');
  const sections = (m.sections || []).map((s) => renderSection(s, baseDir)).join('\n');
  const verdict = m.verdict ? renderVerdict(m.verdict) : '';
  const footer = m.footer ? `<footer>${inline(m.footer)}</footer>` : '';
  const sub = m.subtitle ? `<div class="sub">${inline(m.subtitle)}</div>` : '';
  return `<!DOCTYPE html>
<html lang="${escAttr(m.lang || 'en')}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(m.title || 'Report')}</title>
<style>
${themeCss(m.theme)}
</style>
</head>
<body>
<div class="wrap">
<header>
  <h1>${esc(m.title || 'Report')}</h1>
  ${sub}
</header>
${meta ? `<div class="meta">${meta}</div>` : ''}
${verdict}
${sections}
${footer}
</div>
</body>
</html>
`;
}

// ----------------------------------------------------------------------------
// portability: non-ASCII typographic chars -> HTML entities
// ----------------------------------------------------------------------------
function toEntities(html) {
  const map = {
    '\u00A7': '&sect;', '\u00B7': '&middot;', '\u2013': '&ndash;', '\u2014': '&mdash;',
    '\u2026': '&hellip;', '\u2018': '&lsquo;', '\u2019': '&rsquo;', '\u201C': '&ldquo;',
    '\u201D': '&rdquo;', '\u2192': '&rarr;', '\u2190': '&larr;', '\u00D7': '&times;',
    '\u2265': '&ge;', '\u2264': '&le;', '\u26A0': '&#9888;', '\u00A0': '&nbsp;',
  };
  return html.replace(/[\u00A7\u00B7\u2013\u2014\u2026\u2018\u2019\u201C\u201D\u2192\u2190\u00D7\u2265\u2264\u26A0\u00A0]/g,
    (c) => map[c] || c);
}

// ----------------------------------------------------------------------------
// link verification
// ----------------------------------------------------------------------------
function extractUrls(html) {
  const re = /https?:\/\/[^\s"'<>()]+/g;
  const set = new Set();
  let m;
  while ((m = re.exec(html))) set.add(m[0].replace(/[.,;:]+$/, ''));
  return [...set];
}
async function checkLinks(urls, timeoutMs) {
  const results = [];
  for (const url of urls) {
    let status = 0, ok = false, err = '';
    for (const method of ['HEAD', 'GET']) {
      try {
        const ac = new AbortController();
        const timer = setTimeout(() => ac.abort(), timeoutMs);
        const r = await fetch(url, { method, redirect: 'follow', signal: ac.signal });
        clearTimeout(timer);
        status = r.status; ok = r.ok;
        if (r.ok || method === 'GET') break;
      } catch (e) { err = e.message; }
    }
    results.push({ url, status, ok, err });
  }
  return results;
}

// ----------------------------------------------------------------------------
// main
// ----------------------------------------------------------------------------
function parseArgs(argv) {
  const o = { linkcheck: true, strict: false, timeout: 15000, quiet: false, out: null, manifest: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--version' || a === '-v') {
      try { console.log(require('../package.json').version); } catch (_) { console.log('unknown'); }
      process.exit(0);
    } else if (a === '--out') o.out = argv[++i];
    else if (a === '--no-linkcheck') o.linkcheck = false;
    else if (a === '--strict-links') o.strict = true;
    else if (a === '--link-timeout') o.timeout = parseInt(argv[++i], 10);
    else if (a === '--quiet') o.quiet = true;
    else if (!a.startsWith('--') && !o.manifest) o.manifest = a;
  }
  return o;
}

async function main() {
  const opt = parseArgs(process.argv.slice(2));
  if (!opt.manifest) {
    console.error('Usage: report-forge <manifest.json> [--out file] [--no-linkcheck] [--strict-links]');
    process.exit(2);
  }
  const manifestPath = path.resolve(opt.manifest);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const baseDir = manifest.assetsDir
    ? path.resolve(path.dirname(manifestPath), manifest.assetsDir)
    : path.dirname(manifestPath);

  let html = buildHtml(manifest, baseDir);
  html = toEntities(html);

  const outPath = opt.out
    ? path.resolve(opt.out)
    : manifestPath.replace(/\.json$/i, '') + '.html';

  let brokenCount = 0;
  if (opt.linkcheck) {
    const urls = extractUrls(html);
    if (urls.length) {
      if (!opt.quiet) console.log(`\nVerifying ${urls.length} external link(s)...`);
      const results = await checkLinks(urls, opt.timeout);
      for (const r of results) {
        const flag = r.ok ? 'OK ' : 'BAD';
        if (!r.ok) brokenCount++;
        if (!opt.quiet || !r.ok) {
          console.log(`  [${flag}] ${r.status || r.err || '---'}  ${r.url}`);
        }
      }
    } else if (!opt.quiet) {
      console.log('\nNo external links to verify.');
    }
  }

  fs.writeFileSync(outPath, html, 'utf8');
  const kb = (Buffer.byteLength(html, 'utf8') / 1024).toFixed(1);
  console.log(`\n✔ Wrote ${outPath} (${kb} KB, self-contained)`);
  if (brokenCount) {
    console.log(`⚠ ${brokenCount} link(s) did not return HTTP 200.`);
    if (opt.strict) { console.error('Failing build (--strict-links).'); process.exitCode = 1; }
  }
}

main().catch((e) => { console.error('report-forge error:', e.message); process.exitCode = 1; });
