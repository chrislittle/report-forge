---
name: report-forge
description: >-
  Create a polished, self-contained HTML report through conversation — the user
  describes what they need in plain language and the agent asks a few guiding
  questions, captures any screenshots, assembles the report, and hands back one
  finished HTML file (PDF optional). Use this skill when the user says "create a
  report", "make a findings report", "build an HTML report", "write an RCA",
  "remediation runbook", "reproduction report", "comparison report", "turn this
  into a report", "document this for the team", "pricing estimate", "cost
  estimate", "what would this cost on Azure", or "price this workload".
---

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
"document this for the team", "pricing estimate", "cost estimate", "what would this
cost on Azure", "price this workload".

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
- **Pricing estimate** — priced options for a cloud workload, with a full itemization
- **Generic** — freeform sections

Map their choice to a skeleton in `templates/` and use it as the starting shape.

> **If they chose Pricing estimate, branch now.** Steps 2 and 3 below are for
> evidence-based reports. A pricing estimate gathers its content by **interview plus
> live price lookups** instead — go to **[Pricing estimates](#pricing-estimates)**,
> follow it through, then rejoin at step 4 to build. In particular, **skip step 3
> entirely** — do not ask a pricing user for screenshots, logs or config files.

### 2. Gather the content (guided, a few questions at a time)
Collect conversationally — don't dump one giant form:
- **Title** and a one-line subtitle.
- **Header facts** (date, author, environment/scope) — infer what you can.
- **The story**, section by section, in the report type's shape. Paraphrase their
  words into clean prose; confirm anything ambiguous.
- **A verdict/headline** if there's a clear conclusion (tone: ok / warn / danger).

### 3. Ask about evidence & files (ALWAYS ask — don't skip)

> Except for **pricing estimates**, which have no evidence-gathering step — see the
> branch note under step 1.

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

> **📁 Working-folder rule (do this first, avoid clutter).** Keep ALL working files
> — screenshots, pasted snippets, the JSON manifest — inside a single **temp working
> folder**, never the project root. Mint one at the start with
> `node scripts/capture.js tmpdir` (it prints a fresh `os.tmpdir()/report-forge-XXXX/`
> path with an `assets/` subfolder ready).
> Reference it as the manifest's `assetsDir`. Because the engine base64-**embeds**
> every image into the single output HTML, these source files are throwaway — **delete
> the temp folder after the build** (step 5). Nothing should ever be left in the
> project root.

- **A file they already have** (image, ARM template JSON, config, log) → they give
  you the **path** or **paste** it. **You copy/read it into the temp working folder's
  `assets/` yourself.** The user never manages a folder.
- **Pasted text** (a snippet, a stack trace) → you save it as a file in the temp
  `assets/`, or embed it inline via a `code` block with `"code": "..."`.
- **Screenshot the user already has** → they point you at the file/path; you embed it.
- **Screenshot of a web page they don't have** → offer to capture it for them.
  Two independent paths (use whichever is available):
  - **Preferred — Playwright MCP:** if a Playwright MCP server is connected to the
    agent, call `browser_navigate` then `browser_take_screenshot`, and save the PNG
    **directly into the temp working folder's `assets/`**. No local *library* install
    needed. (The MCP is configured in the agent by the user — it is NOT installed by
    report-forge.) **First-use gotcha:** the MCP defaults to the `chrome` channel; if
    it errors with `Chromium distribution 'chrome' is not found ... Run "npx playwright
    install chrome"`, run `npx playwright install chrome` (or `npx playwright install
    chromium`) once, then retry the navigate/screenshot. This is a one-time per-machine
    browser install.
    - ⚠️ **Cleanup:** some MCP configs write the screenshot to their own output dir (or
      the project root) first. If that happens, **move** (not copy) the PNG into the
      temp `assets/` immediately so no stray image is left behind. Verify the root is
      clean before delivering.
  - **Fallback — Playwright library:** if there's no MCP, run
    `node scripts/capture.js screenshot <url> <tmp>/assets/<name>.png` — point it
    straight at the temp `assets/` folder (capture.js creates the folder if needed, so
    nothing lands in the root). This needs the Playwright npm library locally (`npm i
    playwright && npx playwright install chromium`, or `report-forge init
    --with-playwright`). Handle this silently.
  - Note the distinction: *Playwright* is a browser-automation library; *Playwright
    MCP* is a server built on it that exposes browser tools to the agent.
- **Code / config / template / logs** → after taking the file or text, ask **which
  part to highlight** (a line range, or a marked block via `highlight.wrap`).

> Where do files "live"? Entirely on your side, inside the **temp working folder**
> (`capture.js tmpdir`) with its `assets/` subfolder — you drop everything the user
> gives you there and reference it from the manifest's `assetsDir`. The user only ever
> hands you content in chat — they never create folders or move files. **The temp
> folder is deleted after the build; the delivered HTML is fully self-contained.**

### 4. Build it (silently, on their behalf)

> **Pricing estimates take a different path at steps 2–3** — instead of asking for
> evidence files, you interview the user about the workload and then go and fetch
> real prices. See **[Pricing estimates](#pricing-estimates)** below, then rejoin here.

Behind the scenes:
1. Write the JSON manifest into the temp working folder (the user never sees it).
2. Run `node scripts/report-forge.js <tmp>/manifest.json --out <report>.html` — write
   the finished HTML to where the user wants it (or their cwd), NOT inside the temp folder.
3. The engine embeds images as base64, highlights the code region, verifies every
   external link, and normalises characters. Review the link report; fix any
   non-200 URL before delivering (broken links = incomplete deliverable).

### 5. Deliver + iterate
- Give them the finished `.html` (tell them where it is / attach it).
- Offer a **PDF**: `scripts/capture.js pdf <report>.html <report>.pdf`.
- **Clean up:** delete the temp working folder once the HTML (and any PDF) is produced
  — the output is self-contained, so nothing needs to persist. Confirm the project
  root has no leftover screenshots or manifests.
- Then refine on request — re-run the build after each change (recreate a temp folder
  if you already cleaned up). Keep it conversational ("Want the caching note as a
  callout instead?").

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

## Pricing estimates

When the user asks for a **pricing estimate**, **cost estimate**, **what would this
cost on Azure**, **price this workload**, or **compare these VM sizes on cost** —
use `templates/pricing.json` and follow this flow instead of the evidence-gathering
steps. Full detail, including every verified API recipe, is in
**`references/PRICING_GUIDE.md` — read it before building.**

### Golden rule for pricing

> **Every price comes from the live public
> [Azure Retail Prices API](https://learn.microsoft.com/rest/api/cost-management/retail-prices/azure-retail-prices).
> Never from memory.** No authentication and no subscription is needed. If you cannot
> reach the API, say so — do not estimate from recollection. Stale prices in a
> customer-facing document are worse than no document.

### Interview (two or three questions at a time, always offer a default)

1. **What and where** — workload in plain language, region, currency (default USD,
   queried natively — never converted), and, **for time-based meters only**, hours per
   month (default 730 = continuous).
2. **The discount** — does the customer have a percentage off list, and **what does it
   apply to** (first-party consumption only, or also licenses/storage/marketplace)?
   If there is no discount, show list only and say so.
3. **The shape** — one configuration or 2–3 options side by side? Any commitment
   appetite (1yr/3yr Reserved, Savings Plans)? Any existing licenses eligible for
   Azure Hybrid Benefit?
4. **Quantities** — **inspect the meters first, then ask the dimensions that actually
   bill.** Hours only for time-based meters; for serverless ask executions and
   memory-duration, RUs, input/output tokens, actions, operations or vCPU-seconds.
   Include benefit-unit counts (vCores, PTUs, RU/s blocks). Offer a sensible default
   for each; if the user still does not know, use it and record it in Assumptions in
   their own words.

### Fetch and verify

- **Build a meter inventory, not one query.** A bill is rarely one meter, and a region
  filter alone misses part of it — RHEL/SUSE licenses and some global products return
  `armRegionName` empty or `Global`. Query the region, `Global`, and regionless.
- **De-duplicate.** The same `meterId` is returned repeatedly under different `skuId`s
  and product aliases. Summing raw rows double-charges the customer.
- **Establish the billing unit before any arithmetic.** `unitOfMeasure` is only `1 Hour`
  for about two-thirds of meters — `10K`/`1M` are multipliers, `1/Month` is already
  monthly. And a unit is often not one instance: SQL Database is priced **per vCore**,
  so an 8-vCore database is 8x the meter rate.
- **Tiered meters:** normalize the quantity into billing units **first**, then apply
  the `tierMinimumUnits` bands — thresholds are in billing units, not raw events.
- Filter out **Spot / Low Priority** meters, and **Windows** meters when pricing Linux.
- **Read raw property values, never a formatted table** — PowerShell's `Format-Table`
  rounds for display, turning `0.217` into `0.22`.
- **Reservations:** `retailPrice` is the **whole-term total per reservation unit**,
  despite `unitOfMeasure` saying `1 Hour`. Parse `reservationTerm` into months
  (1 Month, 1/3/5/10 Years all exist), multiply by units required, divide by months.
- **Savings Plans:** only with `api-version=2023-01-01-preview`, and only where the
  meter actually has `savingsPlan` data (absent for Storage, Bandwidth, AKS control
  plane). The commitment is billed **every hour of the term**, not just while the
  workload runs — do not multiply by part-time runtime hours.
- **Azure Hybrid Benefit** is a different meter for **Windows Server on VMs only** —
  there the AHB price is the non-Windows meter. It does **not** generalize: SQL PaaS
  uses a license mode, and RHEL/SUSE bill a separate regionless license meter.
- **Free tiers cut both ways** — some are zero-price bands in the API, others (AKS
  Free) have no meter at all. Never default the AKS tier.
- **Currency:** query directly in the target currency; never convert from USD.
- **Ground the non-price claims in Microsoft Learn** — region availability, capacity
  restrictions, retirements, redundancy options. A correct price for a SKU the
  customer cannot deploy is still a bad estimate.

### Do the math the reader can check

- `cost = quantity / unitSize x retailPrice x unitsRequired`; monthly = hourly x hours
  (730 default) for time-based meters.
- Full precision on unit rates (`$0.115200`), **but round each line to 2dp and then
  sum the rounded values** — the column must add up to the printed total.
- Apply the discount per line, not to the grand total.
- Show **List and Your price side by side**, always.

### Deliver

Always carry the "**this is an estimate, not a quote**" verdict banner and the date
the rates were captured. **Replace every placeholder in the template** — `WORKLOAD`,
`REGION_NAME`, `REGION_CODE`, `YYYY-MM-DD`, `"spec"`, `"…"` — and **delete any section
that does not apply** (commonly "6. Commitment options" and "2. Before you compare")
rather than shipping it empty. Before handing it over, run the validation in the guide
(balanced tags, no leftover template tokens, American spelling, all links 200) **and
hand-add the itemization column to confirm it equals the total.**

### When the data isn't there

- **API unreachable or returns an error:** stop and tell the user. Do **not** fall back
  to remembered prices.
- **Empty result set:** your filter is probably wrong, or the SKU is not offered in that
  region. Widen the filter (drop `armRegionName`, try `serviceName` alone) before
  concluding it does not exist, then check regional availability on Microsoft Learn.
- **A component you cannot price** (custom agreement, marketplace item, unpublished
  SKU): list it in the itemization as an explicit **"not priced"** line with a note,
  and call it out under Assumptions. Never silently omit a cost, and never guess one.

---

## Report types → skeletons

| Type | Skeleton | Shape |
|------|----------|-------|
| Reproduction / findings | `templates/repro.json` | Objective · Result · Root Cause · Evidence · Steps · References |
| RCA | `templates/rca.json` | Summary · Timeline · Root Cause · Factors · Resolution · Corrective Actions |
| Runbook | `templates/runbook.json` | Prerequisites · Procedure · Validation · Rollback |
| Comparison | `templates/comparison.json` | Context · Comparison table · Recommendation |
| Pricing estimate | `templates/pricing.json` | Options at a glance · How to choose · Cost drivers · Commitments · Assumptions · Full itemization |
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
- **Pricing estimates:** `references/PRICING_GUIDE.md` — the interview script, verified
  Retail Prices API recipes (consumption, reservations, savings plans, AHB), the
  rounding rules, and the pre-issue validation. Read it whenever pricing is involved.
- **Theming:** neutral defaults; set `theme.accent` etc. if the user wants a colour.
  No organisation-specific branding or concepts — this skill is vendor-neutral.

> If a manifest field or highlight mode is unclear, consult `references/REPORT_SPEC.md`.
> But remember: all of this stays behind the curtain. The user just talks to you.
