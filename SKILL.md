# report-forge

Create a polished, self-contained HTML report **through conversation**. The user
describes what they need in plain language; **you (the agent) do everything else**
— ask a few guiding questions, capture any screenshots, assemble the report, and
hand back one finished HTML file.

**The user never runs a command, never sees JSON, never installs anything.** The
JSON manifest and the `report-forge.js` engine are internal plumbing that *you*
invoke silently in the background.

**Trigger phrases:** "create a report", "make a findings report", "build an HTML
report", "write an RCA", "remediation runbook", "turn this into a report",
"document this for the team".

---

## Golden rules

1. **Conversational, not command-line.** Never tell the user to run `node`, edit
   JSON, or install anything. You run the engine for them.
2. **Ask, don't assume.** Guide them with short questions. Offer a menu of report
   types. Fill in sensible defaults and confirm.
3. **Capture screenshots for them.** If evidence needs a web screenshot and they
   didn't supply one, offer to grab it (Playwright MCP if available; otherwise the
   local helper). If they already have images, just use them.
4. **Deliver one file.** The output is a single self-contained `.html`. Offer a
   PDF too. Then iterate on request ("change the verdict", "add a section").

---

## Conversational flow

### 1. Pick a report type (offer the menu)
Ask what kind of report they want and show the options:

- **Reproduction / findings** — reproduce a behaviour, show evidence, root cause
- **RCA** — incident root-cause analysis with timeline + corrective actions
- **Runbook** — step-by-step remediation procedure
- **Comparison** — evaluate options and recommend one
- **Generic** — freeform sections

Map their choice to a skeleton in `templates/` and use it as the starting shape.

### 2. Gather the content (guided, a few questions at a time)
Collect conversationally — don't dump one giant form:
- **Title** and a one-line subtitle.
- **Header facts** (date, author, environment/scope) — infer what you can.
- **The story**, section by section, in the report type's shape. Paraphrase their
  words into clean prose; confirm anything ambiguous.
- **A verdict/headline** if there's a clear conclusion (tone: ok / warn / danger).

### 3. Ask about evidence & files (ALWAYS ask — don't skip)
Explicitly ask the user: **"Do you have any files or evidence to include —
screenshots, code, an ARM/Bicep template, config, logs? Just paste the contents
here, or tell me the file path and I'll read it. Or I can capture a web screenshot
for you."** Never assume they have nothing; never make them find a folder.

> **How the user hands you a file depends on the surface.** In the **Copilot CLI**
> (terminal) there is **no drag-and-drop upload** — the user gives you a **file
> path** (you read it with your tools) or **pastes the content** into chat. In GUI
> surfaces (VS Code Copilot Chat, github.com) they may also attach/drag files. When
> in doubt, ask for the path or the pasted content.

Accept evidence in whatever way is easiest for the user — **you** place it:
- **A file they already have** (image, ARM template JSON, config, log) → they give
  you the **path** or **paste** it. **You copy/read it into the report's working
  assets folder yourself.** The user never manages a folder.
- **Pasted text** (a snippet, a stack trace) → you save it as a file in assets, or
  embed it inline via a `code` block with `"code": "..."`.
- **Screenshot the user already has** → they point you at the file/path; you embed it.
- **Screenshot of a web page they don't have** → offer to capture it for them.
  Two independent paths (use whichever is available):
  - **Preferred — Playwright MCP:** if a Playwright MCP server is connected to the
    agent, call `browser_navigate` then `browser_take_screenshot`, and save the PNG
    into the assets folder. No local install needed. (The MCP is configured in the
    agent by the user — it is NOT installed by report-forge.)
  - **Fallback — Playwright library:** if there's no MCP, run
    `node scripts/capture.js screenshot <url> <assets>/<name>.png`. This needs the
    Playwright npm library locally (`npm i playwright && npx playwright install
    chromium`, or `report-forge init --with-playwright`). Handle this silently.
  - Note the distinction: *Playwright* is a browser-automation library; *Playwright
    MCP* is a server built on it that exposes browser tools to the agent.
- **Code / config / template / logs** → after taking the file or text, ask **which
  part to highlight** (a line range, or a marked block via `highlight.wrap`).

> Where do files "live"? Entirely on your side. You maintain a working folder
> (e.g. a temp dir) with an `assets/` subfolder, drop everything the user gives you
> there, and reference it from the manifest's `assetsDir`. The user only ever
> hands you content in chat — they never create folders or move files.

### 4. Build it (silently, on their behalf)
Behind the scenes:
1. Write the JSON manifest to a temp/working location (the user never sees it).
2. Run `node scripts/report-forge.js <manifest.json> --out <report>.html`.
3. The engine embeds images as base64, highlights the code region, verifies every
   external link, and normalises characters. Review the link report; fix any
   non-200 URL before delivering (broken links = incomplete deliverable).

### 5. Deliver + iterate
- Give them the finished `.html` (tell them where it is / attach it).
- Offer a **PDF**: `scripts/capture.js pdf <report>.html <report>.pdf`.
- Then refine on request — re-run the build after each change. Keep it
  conversational ("Want the caching note as a callout instead?").

---

## Example interaction (what the user experiences)

> **User:** Make a report on that login bug — here are two screenshots and the
> exported config; highlight the retry block.
>
> **Agent:** Got it. Reproduction-style report? I'll title it *"Login Retry —
> Reproduction & Root Cause."* Quick check: what's the one-line verdict, and which
> environment should I note? …*(gathers, builds silently)*… Here's your report
> (one self-contained HTML file). Want a PDF, or any edits?

The user typed two sentences. No commands, no JSON, no installs.

---

## Report types → skeletons

| Type | Skeleton | Shape |
|------|----------|-------|
| Reproduction / findings | `templates/repro.json` | Objective · Result · Root Cause · Evidence · Steps · References |
| RCA | `templates/rca.json` | Summary · Timeline · Root Cause · Factors · Resolution · Corrective Actions |
| Runbook | `templates/runbook.json` | Prerequisites · Procedure · Validation · Rollback |
| Comparison | `templates/comparison.json` | Context · Comparison table · Recommendation |
| Generic | `templates/generic.json` | Freeform sections |

---

## Internals (for the agent only — never surfaced to the user)

- **Install / update (one-time setup, not per-report):** the skill is added to a
  project or agent via `npx github:chrislittle/report-forge init` (project — cd into
  the repo first), `... init --global`, or `... init --dir <path>`; update with
  `npx github:chrislittle/report-forge update`; check state with `... status` /
  `... doctor`. See `README.md`. This is setup a human does once — it is *not* part
  of the per-report conversation.
- **Engine:** `scripts/report-forge.js <manifest> [--out file] [--strict-links]`.
  Zero deps, Node 18+. Embeds images (base64), highlights code, verifies links,
  converts non-ASCII to entities, writes one self-contained HTML file.
- **Screenshots/PDF:** `scripts/capture.js` (needs Playwright) — only used as the
  fallback when no Playwright MCP is available.
- **Manifest schema:** `references/REPORT_SPEC.md`. You author this; the user does not.
- **Theming:** neutral defaults; set `theme.accent` etc. if the user wants a colour.
  No organisation-specific branding or concepts — this skill is vendor-neutral.

> If a manifest field or highlight mode is unclear, consult `references/REPORT_SPEC.md`.
> But remember: all of this stays behind the curtain. The user just talks to you.
