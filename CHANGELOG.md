# Changelog

All notable changes to `report-forge` are documented here. This project adheres to
[Semantic Versioning](https://semver.org/).

## [1.2.1] — 2026-09-29

Fixes found by testing the pricing type cold, in a clean environment.

### Fixed
- **Markdown pipe tables in `body` rendered as literal text.** The body renderer
  handled paragraphs, bullets, inline markup and raw HTML, but not tables — so an
  agent writing a perfectly ordinary Markdown table into a section body produced
  `<p>| Disk configuration | List / mo |</p>` in the output. `mdBlock()` now parses
  GitHub-style pipe tables, honoring `---:` and `:---:` for right and center
  alignment. A lone `|` in prose is untouched; the alignment row is what makes a table.

### Added
- **`wide: true` on a table** — lets a dense itemization (7+ columns) break out of the
  1040px text column instead of wrapping every figure. Reverts to normal width below
  1220px and when printing. Applied to the pricing template's full itemization.
- Numeric columns (`ta-right`) no longer wrap mid-figure.

### Changed
- **Requirement-first interview.** The skill previously asked users to choose VM sizes
  and disk tiers by name, which assumes catalog knowledge the reader of an estimate
  rarely has. It now asks what the workload *needs* — CPU and memory, workload shape,
  processor constraints, capacity and performance — then derives the candidate SKUs
  itself and explains each in plain language for confirmation. A user who already
  knows the SKU can still just name it.
- **Guide additions:** turning requirements into a SKU shortlist (match, discard what
  cannot be deployed, one per processor family, explain, confirm); turning storage
  requirements into a tier; and the warning that a newer generation is not
  automatically cheaper — verified in Central US, `D4s_v6` prices above `D4s_v5`.
- **Skill description rewritten to compete honestly.** Adopts the `WHEN:` /
  `DO NOT USE FOR:` convention, and draws an explicit boundary: historical spend and
  bill forecasting belong to `azure-cost`, SKU recommendation with no document to
  produce belongs to `azure-compute`, quota belongs to `azure-quotas`. This skill owns
  the deliverable, not the lookup. Previously the pricing triggers sat behind nine
  report-centric ones and the skill was never selected for pricing work.

## [1.2.0] — 2026-09-29

### Added
- **Pricing estimate report type** (`templates/pricing.json`) — a guided flow that
  interviews the user about a cloud workload, pulls live rates from the public Azure
  Retail Prices API, applies a customer discount, and emits option cards plus a full
  itemization. Front half for the decision maker, back half for whoever checks the math.
- **`references/PRICING_GUIDE.md`** — the interview script (what to ask, in what order,
  with a sensible default for every question), verified Retail Prices API recipes for
  consumption / reservations / savings plans / Azure Hybrid Benefit, the rounding and
  presentation rules, and the pre-issue validation checklist. Hardened against the
  traps that produce materially wrong numbers across Azure's service catalog:
  - `unitOfMeasure` is only `1 Hour` for ~66% of meters — `10K`/`1M` are multipliers
    and `1/Month` is already monthly, so the general rule is
    `cost = quantity / unitSize x retailPrice x unitsRequired`
  - graduated pricing via `tierMinimumUnits`, applied **after** normalizing the
    quantity into billing units (thresholds are in billing units, not raw events)
  - a meter's unit is often not one instance — SQL Database is priced **per vCore**
  - regionless and `Global` meters (RHEL/SUSE licenses) are missed by a region filter
  - duplicate catalog rows sharing a `meterId` must be de-duplicated, not summed
  - reservation terms include 1 Month and 5/10 Years, priced per reservation unit
  - savings plan commitments bill every hour of the term, not just workload runtime
  - the "AHB = non-Windows meter" shortcut is Windows-Server-on-VMs only
  - free allowances may be zero-price API bands *or* absent entirely (AKS Free)
  - currencies are queried natively, never converted
- **`cards` block type** — option cards laid out side by side, with `win` (green) and
  `muted` (dashed) variants, an optional badge, and spec lists that render ticks for
  features and dashes for trade-offs. Kept whole when printing.
- **`divider` block type** — a horizontal rule for splitting a document into a summary
  half and a detail half.
- **Table `align`** — per-column alignment; numeric columns render with tabular figures.
- **Table `rowClasses`** — `grp` (group header), `sub` (subtotal), `tot` (total),
  `win`, `muted`, keyed by 1-based row number.

### Changed
- `SKILL.md` — pricing added to the report-type menu and trigger phrases, plus a
  dedicated pricing flow section.
- `references/REPORT_SPEC.md` — documents `cards`, `divider`, `align` and `rowClasses`.
- `README.md` — new "Azure pricing estimates" section.

## [1.1.1] — 2026-07-02

### Added
- **Project icon** (`icon.svg`) — a document + forge-spark mark. Added to the README
  header, shipped with npm/npx installs (`files`) and the CLI install payload so it
  travels with the skill. Usable as a docs favicon or (rendered to PNG) a GitHub
  social-preview image.

## [1.1.0] — 2026-07-02

### Added
- **`doctor` / `status` now check for a browser binary.** Beyond Node and the
  Playwright library, the prerequisite check detects (a) bundled **Chromium** in the
  Playwright cache (used by the local `capture.js` helper) and (b) system **Google
  Chrome** (the `chrome` channel the Playwright MCP uses by default), and prints the
  exact remediation (`npx playwright install chromium` or `npx playwright install
  chrome`) when neither is present.
- **`capture.js tmpdir` helper** — prints a fresh temp working directory (with an
  `assets/` subfolder) so captures target a clean, disposable location instead of the
  project root. `capture.js` also now creates the output directory if it doesn't exist,
  so screenshots/PDFs can be written straight into the temp folder.

### Fixed
- **No more stray screenshots in the project root.** The capture workflow now mandates
  a disposable **temp working folder** (`os.tmpdir()/report-forge-XXXX/` with an
  `assets/` subfolder) for all screenshots, snippets, and the manifest. Since the
  engine base64-embeds every image into the self-contained HTML, the temp folder is
  deleted after the build — nothing is left behind. When an MCP writes a screenshot to
  its own output dir/root, the agent now **moves** (not copies) it into the temp
  `assets/` and verifies the root is clean before delivering.

## [1.0.1] — 2026-07-02

### Fixed
- **`SKILL.md` now loads as a skill.** Added the required YAML frontmatter block
  (`name` + `description` with trigger phrases). Previously the file started at the
  `# report-forge` heading, so agents rejected it with
  *"missing or malformed YAML frontmatter"* and the skill would not load.

### Docs
- **Playwright MCP browser-binary step documented.** The MCP defaults to the
  `chrome` channel, so first-time capture can fail with
  *"Chromium distribution 'chrome' is not found ... Run npx playwright install chrome"*.
  README Path 1 and `SKILL.md` now call this out and instruct running
  `npx playwright install chrome` (or `chromium`) once per machine, plus the
  `--browser chromium` MCP option. Corrected the misleading "Nothing to install
  locally" wording.

## [1.0.0] — 2026-07-01

Initial release.

### Added
- **Conversational agent skill** (`SKILL.md`) — the user describes a report in plain
  language; the agent captures evidence, builds the document, and delivers one file.
- **Core engine** (`scripts/report-forge.js`, zero dependencies, Node 18+):
  - Single self-contained HTML output — images embedded as base64.
  - Code / config / template embedding with a highlightable region
    (`highlight.lines` or `highlight.wrap`).
  - Automatic external link verification (HEAD/GET) with optional `--strict-links`
    build gate.
  - Non-ASCII typographic characters normalised to HTML entities for portability.
  - Themeable palette (set `theme.accent` etc.); neutral, no branding.
  - Tables (with row highlighting), verdict banners, callouts, and markdown-lite
    section bodies.
- **Report types** (`templates/`): reproduction, RCA, runbook, comparison, generic.
- **Optional Playwright helper** (`scripts/capture.js`) — capture web screenshots and
  export the finished report to PDF. Falls back gracefully when Playwright is absent.
- **Helper CLI** (`scripts/cli.js`) — `init`, `update`, `status`, `doctor`,
  `uninstall`, `--version`, with prerequisite detection and optional
  `--with-playwright` install.
- **Manifest specification** (`references/REPORT_SPEC.md`) with a complete worked
  example, plus ready-to-fill report skeletons in `templates/`.
