<p align="center">
  <img src="icon.svg" alt="report-forge logo" width="128" height="128">
</p>

# report-forge

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js >= 18](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org/)

> **Turn a conversation into a polished, self-contained HTML report.** You describe
> what you need to an AI agent in plain language; it captures any screenshots,
> assembles the document, verifies the links, and hands you one portable file.

`report-forge` is a vendor-neutral **agent skill**. It teaches your AI assistant
(e.g. GitHub Copilot) how to build clean technical reports — reproduction
write-ups, root-cause analyses, remediation runbooks, comparisons — with embedded
images, highlighted code, and link-checked references, all in a single `.html`.

## Contents

| | Section | |
|---|---------|---|
| 🚀 | [Quick start](#quick-start) | Install + first report in two steps |
| 📦 | [Installation](#installation) | Prerequisites and 6 install options |
| 💬 | [How it works](#how-it-works) | The conversational experience |
| ✨ | [Features](#features) | What it produces |
| 🖼️ | [Screenshots & PDF (Playwright)](#screenshots--pdf-playwright) | MCP vs. local capture, and setup |
| 🛠️ | [CLI reference](#cli-reference) | Setup commands (init, update, status…) |
| ⚙️ | [Advanced](#advanced-running-the-engine-directly) | Running the engine directly |
| 📁 | [Repository structure](#repository-structure) | File tree |
| 🔒 | [Privacy & data](#privacy--data) | How it handles your data |
| 📄 | [License](#license) | MIT |

---

## Quick start

**1. Add the skill** (one command — no npm publish needed, runs straight from GitHub):

```bash
npx github:chrislittle/report-forge init
```

> The `npx` commands in this README are identical in **bash**, **zsh**, and
> **PowerShell** — run them as-is on macOS, Linux, or Windows.

**2. Just talk to your agent.** No files, no commands, no JSON:

> **You:** *"Make a findings report about the login bug — grab a screenshot of
> our staging page, embed this config, and highlight the retry block."*
>
> **Agent:** *…asks a couple of quick questions, captures the screenshot, builds
> the report…* → hands you **one self-contained HTML file.**

That's it. See **[Installation](#installation)** for other install options, or
**[How it works](#how-it-works)** for what the conversation feels like.

---

## Installation

### Prerequisites

- **[Node.js 18+](https://nodejs.org/)** — the only hard requirement. Check with `node --version`.
- **An AI agent** that reads skills from `.github/skills/` or `~/.copilot/skills/`
  (e.g. GitHub Copilot CLI).
- **[Playwright](https://playwright.dev/)** *(optional)* — only for capturing web
  screenshots or exporting PDF, via **either** a Playwright MCP in your agent **or**
  the bundled local helper. See [Screenshots & PDF](#screenshots--pdf-playwright).
  Skip it entirely if you supply your own images.

`init` checks these for you and tells you what's missing.

### Option A — Project install (recommended)

Adds the skill to the **current** repo under `.github/skills/report-forge`.
**cd into your repo first:**

```bash
cd my-repo
npx github:chrislittle/report-forge init
```

> Each developer runs `init` themselves — the installed folder is git-ignored, so
> it isn't committed to the repo.

### Option B — Global install (personal agent)

```bash
npx github:chrislittle/report-forge init --global      # -> ~/.copilot/skills/report-forge
```

### Option C — Explicit path

```bash
npx github:chrislittle/report-forge init --dir /any/path/report-forge
```

### Option D — With Playwright (screenshots + PDF)

```bash
npx github:chrislittle/report-forge init --with-playwright
```

### Option E — Global command via npm

Prefer a persistent command instead of `npx`?

```bash
npm install -g github:chrislittle/report-forge

report-forge init            # project
report-forge init --global   # global
report-forge status
report-forge --version
```

### Option F — Manual install (offline / no npx)

Clone the repo and copy the folder into your agent's skills directory.

**bash / zsh (macOS, Linux):**

```bash
git clone https://github.com/chrislittle/report-forge.git
mkdir -p ~/.copilot/skills/report-forge
cp -r report-forge/* ~/.copilot/skills/report-forge/
```

**PowerShell (Windows):**

```powershell
git clone https://github.com/chrislittle/report-forge.git
$dest = "$env:USERPROFILE\.copilot\skills\report-forge"
New-Item -ItemType Directory -Force -Path $dest | Out-Null
Copy-Item -Path "report-forge\*" -Destination $dest -Recurse -Force
```

### Verify

```bash
npx github:chrislittle/report-forge status     # install locations, versions, prereq check
```

---

## How it works

You **never** run a command, edit JSON, or manage a folder to make a report. In
conversation you:

1. Say what the report is about.
2. Answer a few short questions (title, the story, the headline).
3. Hand over evidence however is easiest — **paste** code/config, give a **file
   path**, or just give a **URL** and the agent screenshots it for you.
4. Get back a single `.html` (and a PDF if you want). Ask for edits in plain words.

The agent does the rest behind the scenes: authoring the manifest, embedding
images as base64, highlighting the code you care about, verifying every external
link, and normalising text so the file renders identically everywhere.

## Features

- 📦 **Single self-contained file** — images embedded, nothing external to attach
- 🔦 **Code / config / template embedding** with an optional highlighted region
- 🔗 **Automatic link verification** — broken URLs are flagged before you send
- 🎨 **Themeable, no branding** — neutral by default; set your own accent colour
- 🔤 **Portable text** — smart quotes / dashes / arrows normalised to entities
- 🧩 **Report types** — reproduction, RCA, runbook, comparison, generic
- 🖼️ **Auto screenshots + PDF** — via a Playwright MCP or the bundled helper

## Screenshots & PDF (Playwright)

report-forge can embed screenshots you already have, or capture web pages for you.
Capturing uses **Playwright** — and there are two independent paths. You need
**either one**, not both:

### Path 1 — Playwright MCP (preferred, zero local setup)

If your agent has the **[Playwright MCP](https://github.com/microsoft/playwright-mcp)**
connected, the agent drives a browser directly through MCP tools
(`browser_navigate`, `browser_take_screenshot`) and drops the PNG into the assets
folder. No local *library* install is needed — but the MCP still needs a **browser
binary** the first time (see note below).

> **⚠️ First-use browser install (common gotcha).** The Playwright MCP defaults to
> the **`chrome`** channel. If the browser binary isn't present you'll see an error
> like:
> ```
> Chromium distribution 'chrome' is not found at C:\...\chrome.exe
> Run "npx playwright install chrome"
> ```
> Fix it once with:
> ```bash
> npx playwright install chrome
> # (or, to use the bundled Chromium instead of channel chrome:)
> npx playwright install chromium
> ```
> This is a one-time, per-machine step — the MCP reuses the binary afterward. If you
> prefer Chromium over Chrome, launch the MCP with `--browser chromium` in its args.


> **This MCP is configured in your agent, not by report-forge.** It is intentionally
> out of scope for this package's installer so the skill stays agent-agnostic.
> Add it once to your agent's MCP configuration — the standard config is:
>
> ```json
> {
>   "mcpServers": {
>     "playwright": { "command": "npx", "args": ["@playwright/mcp@latest"] }
>   }
> }
> ```
>
> **GitHub Copilot CLI** — add it interactively with the slash command:
>
> ```
> /mcp add
> ```
>
> …or create/edit `~/.copilot/mcp-config.json`:
>
> ```json
> {
>   "mcpServers": {
>     "playwright": {
>       "type": "local",
>       "command": "npx",
>       "tools": ["*"],
>       "args": ["@playwright/mcp@latest"]
>     }
>   }
> }
> ```
>
> Then **restart Copilot CLI** (MCP servers load at startup) and confirm with `/mcp`
> — you should see `playwright` with tools like `browser_navigate` and
> `browser_take_screenshot`. See the
> [Playwright MCP repo](https://github.com/microsoft/playwright-mcp) for other
> clients (VS Code, Cursor, Claude, etc.).

### Path 2 — Playwright library (local fallback)

No MCP? The bundled `scripts/capture.js` uses the **Playwright npm library**
locally. Install it once:

```bash
npm i -D playwright && npx playwright install chromium
```

…or let `init` do it: `... init --with-playwright`. Then report-forge falls back to
`capture.js` automatically.

### Don't need web capture at all?

Skip Playwright entirely — just hand the agent screenshots you already have, and it
embeds them. Playwright is **only** for capturing pages you *don't* already have an
image of, and for PDF export.

> **Playwright vs. Playwright MCP:** *Playwright* is a browser-automation library
> (an npm package). *Playwright MCP* is a separate MCP **server** built on top of it
> that lets an agent drive the browser through tool calls. report-forge prefers the
> MCP when present and falls back to the library.

## CLI reference

The bundled CLI is only for **setup** — you never use it to make reports.

| Command | What it does |
|---------|--------------|
| `init [--global\|--dir <path>] [--with-playwright] [--force]` | Install the skill |
| `update` | Re-install latest over existing installs (auto-detects project + global) |
| `status` | Show install locations, versions, and prerequisite check |
| `doctor` | Check prerequisites (Node, Playwright library, **and browser binary** — bundled Chromium and/or the Chrome channel used by the Playwright MCP), with the exact install command if a browser is missing |
| `uninstall [--global\|--dir <path>]` | Remove an install |
| `--version` | Print version |

Run any of them as `npx github:chrislittle/report-forge <command>` (or, if you did
the global npm install in Option E, just `report-forge <command>`).

### Updating

```bash
npx github:chrislittle/report-forge update    # refresh project and/or global installs in place
```

### Uninstalling

```bash
npx github:chrislittle/report-forge uninstall           # project
npx github:chrislittle/report-forge uninstall --global  # global
```

Or remove the folder manually:

```bash
# bash / zsh
rm -rf .github/skills/report-forge          # project
rm -rf ~/.copilot/skills/report-forge       # global
```

```powershell
# PowerShell
Remove-Item -Recurse -Force .github\skills\report-forge                       # project
Remove-Item -Recurse -Force "$env:USERPROFILE\.copilot\skills\report-forge"   # global
```

---

## Advanced: running the engine directly

You almost never need this — the agent runs it for you. But the engine is a plain
Node script with zero dependencies, so you *can* drive it by hand (identical in
bash and PowerShell):

```bash
# build a report from a manifest
node scripts/report-forge.js report.json --out report.html

# fail the build if any external link is broken
node scripts/report-forge.js report.json --strict-links

# optional screenshot / PDF (needs Playwright)
node scripts/capture.js screenshot https://example.com assets/home.png --full
node scripts/capture.js pdf report.html report.pdf
```

The manifest schema and a complete worked example live in
[`references/REPORT_SPEC.md`](references/REPORT_SPEC.md); ready-to-fill skeletons are
in [`templates/`](templates/). To build one by hand, point the engine at a manifest:

```bash
node scripts/report-forge.js my-report.json --out my-report.html
```

## Repository structure

```
report-forge/
├── SKILL.md                 # the skill your agent reads (how to drive it)
├── README.md                # this file
├── LICENSE                  # MIT
├── CHANGELOG.md             # release notes
├── package.json             # npm/npx metadata + CLI bin entries
├── icon.svg                 # project logo (README header, favicon, social preview)
├── .gitignore               # ignores node_modules + local build output
├── scripts/
│   ├── cli.js               # `report-forge` install/update/status CLI
│   ├── report-forge.js      # core engine (zero deps)
│   └── capture.js           # optional Playwright screenshot/PDF helper
├── references/
│   └── REPORT_SPEC.md       # manifest schema + worked example
└── templates/               # repro · rca · runbook · comparison · generic
```

## Privacy & data

`report-forge` runs entirely locally. It reads only the files you point it at,
writes a single HTML/PDF where you ask, and makes outbound requests **only** to
verify the external links in your report (and, if you use it, to fetch pages you
ask it to screenshot). It is fully vendor-neutral — no telemetry, no accounts, no
organisation-specific concepts.

## License

MIT — see [LICENSE](LICENSE). Use it, fork it, ship it.
