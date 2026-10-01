# Manifest Specification

A report is described by a single JSON file. All fields are optional unless
noted. Paths for images and code files are resolved relative to `assetsDir`.

> **Note:** you normally never write this by hand — an AI agent authors it from
> your conversation. This spec is for the agent (and the curious).

## Complete worked example

A small but complete manifest showing metadata, a verdict banner, a highlighted
table row, an embedded+highlighted code block, an image, and verified links:

```json
{
  "title": "Widget Sync — Reproduction & Root Cause",
  "subtitle": "Findings for the platform team",
  "theme": { "accent": "#2563eb" },
  "meta": [
    { "label": "Date", "value": "2026-01-15" },
    { "label": "Author", "value": "A. Engineer" }
  ],
  "assetsDir": "assets",
  "verdict": {
    "tone": "warn",
    "body": "**Root cause confirmed:** the wizard emits a DNS zone even when integration is disabled."
  },
  "sections": [
    { "heading": "1. Objective", "body": "Verify that DNS integration = off creates no zone." },
    { "heading": "2. Result",
      "table": {
        "headers": ["Method", "Result", "Status"],
        "rows": [ ["UI wizard", "zone created", "REPRODUCED"] ],
        "highlightRows": [1]
      } },
    { "heading": "3. Evidence",
      "blocks": [
        { "type": "image", "src": "step1.png", "caption": "Toggle set to off." },
        { "type": "code", "src": "template.json", "language": "json",
          "highlight": { "wrap": ["\"type\": \"PrivateDnsZone\"", "]" ] },
          "caption": "This block is emitted despite the off setting." }
      ] },
    { "heading": "4. References",
      "links": [ { "text": "Docs", "url": "https://example.com/docs" } ] }
  ],
  "footer": "Generated 2026-01-15 · report-forge"
}
```

Build it: `node scripts/report-forge.js report.json --out report.html`.

## Top-level

| Field       | Type   | Notes |
|-------------|--------|-------|
| `title`     | string | Report title (H1). **Recommended.** |
| `subtitle`  | string | Small line under the title. Inline markdown allowed. |
| `lang`      | string | HTML `lang` attribute (default `en`). |
| `theme`     | object | Colour tokens — see **Theme**. |
| `meta`      | array  | Header key/value chips — `[{ "label", "value" }]`. `value` allows inline markdown. |
| `assetsDir` | string | Folder (relative to the manifest) holding images/code. Default: manifest's own folder. |
| `verdict`   | object | Banner at the top — `{ "tone", "body" }`. |
| `sections`  | array  | Ordered content sections — see **Section**. |
| `footer`    | string | Footer line. Inline markdown allowed. |

## Theme

All optional; sensible neutral defaults are used. Override any subset.

```json
"theme": {
  "accent": "#4f46e5", "accentDark": "#4338ca",
  "ink": "#1f2328", "muted": "#57606a", "line": "#e5e7eb", "bg": "#f8fafc",
  "ok": "#15803d", "warn": "#b45309", "danger": "#b91c1c", "info": "#4f46e5",
  "hlBg": "#5a2323", "hlInk": "#ffd9d4"
}
```

`hlBg` / `hlInk` control the code highlight colours.

## Verdict / callout tone

`tone` is one of: `info` (default), `ok`, `warn`, `danger`. `warn` and `danger`
render red-accented.

```json
"verdict": { "tone": "warn", "body": "**Root cause confirmed:** ..." }
```

## Section

A section renders in this order: heading → body → callout → table → blocks → links.
Include only what you need.

```json
{
  "heading": "3. Evidence",
  "body": "Optional intro paragraph(s). Supports **bold**, *italic*, `code`, [links](https://x), and - bullet lists.",
  "callout": { "tone": "warn", "body": "A highlighted note." },
  "table": { "headers": ["A","B"], "rows": [["1","2"]], "highlightRows": [1] },
  "blocks": [ ... ],
  "links": [ { "text": "Docs", "url": "https://example.com" } ]
}
```

### Body markdown-lite

Section `body` (and any `text` block) supports: paragraphs, `-`/`*` bullet lists,
`**bold**`, `*italic*`, `` `code` ``, and `[text](https://url)`. Lines that start
with `<` are passed through as raw HTML.

### Table

```json
"table": {
  "headers": ["Method", "Result", "Status"],
  "rows": [
    ["UI wizard", "zone created", "REPRODUCED"],
    ["API call", "no zone", "clean"]
  ],
  "highlightRows": [1]
}
```
`highlightRows` is 1-based; listed rows get a highlighted background.

### Blocks

`blocks` is an ordered array. Supported block types:

**subheading**
```json
{ "type": "subheading", "text": "Screenshot 1 — the toggle" }
```

**image** — embedded as base64 (portable).
```json
{ "type": "image", "src": "step1.png", "alt": "…", "caption": "Toggle set to No" }
```

**code** — embedded from a file (`src`) or inline (`code`), HTML-escaped, optional highlight.
```json
{
  "type": "code",
  "src": "template.json",
  "language": "json",
  "highlight": { "wrap": ["\"name\": \"PrivateDns", "\n    ]"] },
  "caption": "This block is emitted despite the No setting"
}
```
Highlight modes (choose one):
- `"highlight": { "lines": [from, to] }` — 1-based inclusive line range.
- `"highlight": { "wrap": ["<startMarker>", "<endMarkerExclusive>"] }` — wrap the
  text from the first occurrence of `startMarker` up to (not including) the next
  occurrence of `endMarkerExclusive`. Pick markers that bound the region.

**text** — a markdown-lite block (same as section `body`).
```json
{ "type": "text", "body": "Some **notes** here." }
```

**html** — raw HTML passthrough (escape hatch).
```json
{ "type": "html", "html": "<div class=\"callout ok\">Custom.</div>" }
```

### Links

```json
"links": [
  { "text": "Reference doc", "url": "https://example.com/docs" }
]
```
All `https?://` URLs anywhere in the final document are verified at build time.

## CLI

```
node scripts/report-forge.js <manifest.json> [options]

--out <file>          Output path (default: <manifest>.html)
--no-linkcheck        Skip link verification
--strict-links        Exit non-zero if any external link is not HTTP 200
--link-timeout <ms>   Per-link timeout (default 15000)
--quiet               Reduce console output
```

## Portability guarantees

- Images are inlined as base64 → no external files travel with the report.
- Typographic characters (`§ · — … " " → ⚠` etc.) are converted to HTML entities
  → correct rendering regardless of editor/encoding.
- Only `http(s)` links are checked; `data:` URIs and relative anchors are ignored.
