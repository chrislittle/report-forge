#!/usr/bin/env node
'use strict';
/*
 * capture — optional Playwright helper for report-forge.
 *
 *   node capture.js screenshot <url> <out.png> [--selector <css>] [--full] [--width 1280] [--height 900]
 *   node capture.js pdf <htmlFileOrUrl> <out.pdf> [--landscape]
 *
 * Requires Playwright (optional peer dependency):
 *   npm i -D playwright && npx playwright install chromium
 *
 * This is a convenience for capturing web screenshots to embed as evidence, or
 * exporting a generated report to PDF. It is NOT required for core report-forge.
 *
 * Note: when running inside an agent that has a Playwright MCP server, prefer the
 * MCP browser tools (navigate + screenshot) and just drop the PNG into your
 * assets folder — no local Playwright install needed. See SKILL.md.
 */

const path = require('path');

function parse(argv) {
  const o = { cmd: argv[0], a: argv[1], b: argv[2], selector: null, full: false,
    width: 1280, height: 900, landscape: false };
  for (let i = 3; i < argv.length; i++) {
    const x = argv[i];
    if (x === '--selector') o.selector = argv[++i];
    else if (x === '--full') o.full = true;
    else if (x === '--landscape') o.landscape = true;
    else if (x === '--width') o.width = parseInt(argv[++i], 10);
    else if (x === '--height') o.height = parseInt(argv[++i], 10);
  }
  return o;
}

async function main() {
  const o = parse(process.argv.slice(2));
  if (!o.cmd || !o.a || !o.b) {
    console.error('Usage:\n  capture screenshot <url> <out.png> [--selector css] [--full]\n  capture pdf <htmlFileOrUrl> <out.pdf> [--landscape]');
    process.exit(2);
  }

  let chromium;
  try {
    ({ chromium } = require('playwright'));
  } catch (e) {
    console.error('Playwright not installed. Run:  npm i -D playwright && npx playwright install chromium');
    console.error('(Or use your agent\'s Playwright MCP browser tools instead — see SKILL.md.)');
    process.exit(3);
  }

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: o.width, height: o.height } });

    if (o.cmd === 'screenshot') {
      await page.goto(o.a, { waitUntil: 'networkidle' });
      if (o.selector) {
        const el = await page.$(o.selector);
        if (!el) throw new Error(`selector not found: ${o.selector}`);
        await el.screenshot({ path: o.b });
      } else {
        await page.screenshot({ path: o.b, fullPage: o.full });
      }
      console.log(`✔ screenshot -> ${o.b}`);
    } else if (o.cmd === 'pdf') {
      const target = /^https?:\/\//.test(o.a) ? o.a : 'file://' + path.resolve(o.a);
      await page.goto(target, { waitUntil: 'networkidle' });
      await page.pdf({ path: o.b, printBackground: true, format: 'A4', landscape: o.landscape,
        margin: { top: '14mm', bottom: '16mm', left: '12mm', right: '12mm' } });
      console.log(`✔ pdf -> ${o.b}`);
    } else {
      throw new Error(`unknown command: ${o.cmd}`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((e) => { console.error('capture error:', e.message); process.exit(1); });
