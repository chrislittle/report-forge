# Changelog

All notable changes to `report-forge` are documented here. This project adheres to
[Semantic Versioning](https://semver.org/).

## [1.0.1] — 2026-07-02

### Fixed
- **`SKILL.md` now loads as a skill.** Added the required YAML frontmatter block
  (`name` + `description` with trigger phrases). Previously the file started at the
  `# report-forge` heading, so agents rejected it with
  *"missing or malformed YAML frontmatter"* and the skill would not load.

### Added / Docs
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
