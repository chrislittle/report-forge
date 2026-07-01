#!/usr/bin/env node
'use strict';
/*
 * report-forge CLI — install / update / status / uninstall the skill.
 *
 *   npx github:chrislittle/report-forge init                 Install into ./.github/skills/report-forge (project)
 *   npx github:chrislittle/report-forge init --global        Install into ~/.copilot/skills/report-forge
 *   npx github:chrislittle/report-forge init --dir <path>    Install into an explicit path
 *   npx github:chrislittle/report-forge update               Re-install latest over an existing install
 *   npx github:chrislittle/report-forge status               Show install locations + versions
 *   npx github:chrislittle/report-forge uninstall            Remove an install (--global / --dir as needed)
 *   npx github:chrislittle/report-forge --version            Print version
 *   npx github:chrislittle/report-forge doctor               Check prerequisites (Node, Playwright)
 *
 * Flags:
 *   --with-playwright   During init, also install Playwright + Chromium (for screenshots/PDF)
 *   --force             Overwrite an existing install
 *
 * Node 18+. No runtime dependencies.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const cp = require('child_process');

const PKG_ROOT = path.resolve(__dirname, '..');
const PAYLOAD = ['SKILL.md', 'README.md', 'LICENSE', 'package.json', 'scripts', 'references', 'templates'];
const MIN_NODE = 18;

function version() {
  try { return require(path.join(PKG_ROOT, 'package.json')).version; } catch (_) { return 'unknown'; }
}
function projectDest(base) { return path.join(base || process.cwd(), '.github', 'skills', 'report-forge'); }
function globalDest() { return path.join(os.homedir(), '.copilot', 'skills', 'report-forge'); }

function parse(argv) {
  const o = { cmd: 'help', global: false, dir: null, force: false, withPlaywright: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (['init', 'update', 'status', 'uninstall', 'doctor', 'help'].includes(a)) o.cmd = a;
    else if (a === '--version' || a === '-v') o.cmd = 'version';
    else if (a === '--help' || a === '-h') o.cmd = 'help';
    else if (a === '--global') o.global = true;
    else if (a === '--project') o.global = false;
    else if (a === '--dir') o.dir = argv[++i];
    else if (a === '--force') o.force = true;
    else if (a === '--with-playwright') o.withPlaywright = true;
  }
  return o;
}

// ---- prerequisites --------------------------------------------------------
function nodeMajor() { return parseInt(process.versions.node.split('.')[0], 10); }
function hasPlaywright(fromDir) {
  try { require.resolve('playwright', { paths: [fromDir || process.cwd(), PKG_ROOT] }); return true; }
  catch (_) { return false; }
}
function checkPrereqs(destForPlaywright) {
  const nodeOk = nodeMajor() >= MIN_NODE;
  const pw = hasPlaywright(destForPlaywright);
  return { nodeOk, nodeVersion: process.versions.node, playwright: pw };
}
function printPrereqs(p) {
  console.log('\nPrerequisites:');
  console.log(`  ${p.nodeOk ? 'OK ' : 'X  '} Node.js ${p.nodeVersion} ${p.nodeOk ? '(>=' + MIN_NODE + ')' : '(need >= ' + MIN_NODE + ')'}`);
  console.log(`  ${p.playwright ? 'OK ' : '-- '} Playwright ${p.playwright ? 'available' : 'not installed (optional — only for screenshots/PDF)'}`);
}

function installPlaywright(cwd) {
  console.log('\nInstalling Playwright + Chromium (optional dependency)...');
  try {
    cp.execSync('npm i playwright', { cwd, stdio: 'inherit' });
    cp.execSync('npx playwright install chromium', { cwd, stdio: 'inherit' });
    console.log('OK  Playwright installed.');
  } catch (e) {
    console.error('X   Playwright install failed. You can run it later:');
    console.error('    npm i -D playwright && npx playwright install chromium');
  }
}

// ---- copy -----------------------------------------------------------------
function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const e of fs.readdirSync(src)) {
      if (e === 'node_modules') continue;
      copyRecursive(path.join(src, e), path.join(dest, e));
    }
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

function writeMeta(dest) {
  fs.writeFileSync(path.join(dest, '.install-meta.json'),
    JSON.stringify({ version: version(), installedAt: new Date().toISOString() }, null, 2));
}
function readMeta(dest) {
  try { return JSON.parse(fs.readFileSync(path.join(dest, '.install-meta.json'), 'utf8')); }
  catch (_) { return null; }
}

// ---- commands -------------------------------------------------------------
function doInit(o) {
  const dest = o.dir ? path.resolve(o.dir) : (o.global ? globalDest() : projectDest());

  // project install sanity: warn if not in a git repo
  if (!o.dir && !o.global) {
    if (!fs.existsSync(path.join(process.cwd(), '.git'))) {
      console.log('Note: no .git found in the current directory.');
      console.log('      Project install targets the CURRENT folder. cd into your repo first');
      console.log('      (run `git init` if you don\'t have one), then re-run `report-forge init`.\n');
    }
  }

  const prereq = checkPrereqs(dest);
  printPrereqs(prereq);
  if (!prereq.nodeOk) {
    console.error(`\nX  Node ${MIN_NODE}+ is required. Install it from https://nodejs.org/ and re-run.`);
    process.exitCode = 1;
    return;
  }

  if (fs.existsSync(dest) && fs.readdirSync(dest).length > 0 && !o.force) {
    console.error(`\nDestination already exists: ${dest}`);
    console.error('Re-run with --force to overwrite, or use `report-forge update`.');
    process.exitCode = 1;
    return;
  }

  for (const item of PAYLOAD) {
    const src = path.join(PKG_ROOT, item);
    if (fs.existsSync(src)) copyRecursive(src, path.join(dest, item));
  }
  writeMeta(dest);

  console.log(`\nOK  Installed report-forge v${version()} -> ${dest}`);
  console.log('    Your agent can now discover the skill. Just ask it to "create a report".');

  if (o.withPlaywright) installPlaywright(dest);
  else if (!prereq.playwright) {
    console.log('\nOptional: for auto web-screenshots and PDF export, install Playwright:');
    console.log('    npm i -D playwright && npx playwright install chromium');
    console.log('    (or re-run with `report-forge init --with-playwright`)');
  }
}

function doUpdate(o) {
  const targets = [];
  if (o.dir) targets.push(path.resolve(o.dir));
  else {
    if (fs.existsSync(projectDest())) targets.push(projectDest());
    if (fs.existsSync(globalDest())) targets.push(globalDest());
  }
  if (targets.length === 0) {
    console.log('No existing install found (project or global). Run `report-forge init` first.');
    return;
  }
  for (const dest of targets) {
    const prev = readMeta(dest);
    for (const item of PAYLOAD) {
      const src = path.join(PKG_ROOT, item);
      if (fs.existsSync(src)) copyRecursive(src, path.join(dest, item));
    }
    writeMeta(dest);
    console.log(`OK  Updated ${dest} (${prev ? prev.version : '?'} -> ${version()})`);
  }
}

function doStatus() {
  console.log(`report-forge v${version()}`);
  const spots = [['project', projectDest()], ['global', globalDest()]];
  let found = false;
  for (const [label, dest] of spots) {
    if (fs.existsSync(dest)) {
      found = true;
      const meta = readMeta(dest);
      console.log(`  [${label}] ${dest}`);
      console.log(`           version ${meta ? meta.version : '?'}, installed ${meta ? meta.installedAt : '?'}`);
    }
  }
  if (!found) console.log('  (no installs found — run `report-forge init`)');
  printPrereqs(checkPrereqs());
}

function doUninstall(o) {
  const dest = o.dir ? path.resolve(o.dir) : (o.global ? globalDest() : projectDest());
  if (!fs.existsSync(dest)) { console.log(`Nothing to remove at ${dest}`); return; }
  fs.rmSync(dest, { recursive: true, force: true });
  console.log(`OK  Removed ${dest}`);
}

function doDoctor() {
  console.log(`report-forge v${version()} — environment check`);
  printPrereqs(checkPrereqs());
  console.log('\nCore report generation needs only Node ' + MIN_NODE + '+.');
  console.log('Playwright is optional (screenshots + PDF).');
}

function help() {
  console.log(`report-forge v${version()}

Usage:
  npx github:chrislittle/report-forge init [--global|--dir <path>] [--with-playwright] [--force]
  npx github:chrislittle/report-forge update
  npx github:chrislittle/report-forge status
  npx github:chrislittle/report-forge uninstall [--global|--dir <path>]
  npx github:chrislittle/report-forge doctor
  npx github:chrislittle/report-forge --version

Install targets:
  (default) project  ->  ./.github/skills/report-forge   (cd into your repo first)
  --global           ->  ~/.copilot/skills/report-forge
  --dir <path>       ->  an explicit path

After install, just talk to your agent: "create a findings report about X".`);
}

function main() {
  const o = parse(process.argv.slice(2));
  switch (o.cmd) {
    case 'init': doInit(o); break;
    case 'update': doUpdate(o); break;
    case 'status': doStatus(); break;
    case 'uninstall': doUninstall(o); break;
    case 'doctor': doDoctor(); break;
    case 'version': console.log(version()); break;
    default: help();
  }
}

main();
