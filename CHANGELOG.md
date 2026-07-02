# Changelog

All notable changes to `report-forge` are documented here. This project adheres to
[Semantic Versioning](https://semver.org/).

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
