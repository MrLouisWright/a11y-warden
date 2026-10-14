# a11y-warden

> WCAG 2.2 accessibility audit of static HTML for CI, with a baseline so you can adopt it on an existing site and only fail on new problems.

Most accessibility regressions are simple and machine-detectable: an image without alt text, an icon button with no name, a form field whose only label is its placeholder, grey-on-white text, a modal hidden with `aria-hidden` that still traps keyboard focus. `a11y-warden` reads every built HTML page, checks it against a focused set of WCAG 2.2 success criteria, and reports each problem with the file, line, severity, the criterion and a **concrete fix**. Record existing issues in a baseline file and CI fails only on new ones.

CLI, library and GitHub Action. Node.js 18+, **zero runtime dependencies**. Works on any static build output (Astro, Next.js `output: 'export'`, Eleventy, Hugo, Jekyll, Docusaurus, VitePress, plain HTML) and runs offline: point it at the folder your build writes. By Louis Wright.

## Features

- **Text alternatives (1.1.1):** missing alt, file-name or placeholder alt (`IMG_1234.png`, "image of…"), unnamed `<svg role="img">`, `<input type="image">`.
- **Names and labels (1.3.1, 2.4.4, 4.1.2):** form controls without label/aria-label/aria-labelledby/title (placeholders do not count), buttons and links without accessible names, generic link text, iframes without title.
- **Contrast (1.4.3):** inline `color` against the nearest inline `background-color` (or a configurable default), with the 3:1 large-text exception.
- **Structure (1.3.1, 2.4.1, 2.4.2, 3.1.1):** `<html lang>`, `<title>`, a single `<main>`, data tables without `<th>`.
- **ARIA and focus (2.4.3, 2.4.7, 4.1.2):** invalid roles, aria-labelledby/describedby/controls and `<label for>` pointing at missing ids, duplicate referenced ids, `aria-hidden` containing focusable elements, positive tabindex, inline `outline: none`.
- **Zoom and media (1.4.2, 1.4.4):** viewport that disables zoom, media that autoplays with sound and no controls.
- **Baseline:** `--update-baseline` records current findings; later runs ignore them and report only new ones. Hidden content (`hidden`, `aria-hidden`) is skipped.
- Text/JSON/SARIF/Markdown output, `--fail-on`, exit codes 0/1/2, allowlist with expiry, severity overrides, GitHub Action with job summary.

### Scope

a11y-warden is a static check of built HTML. It does not run a browser, so contrast is only checked for inline styles and dynamic states are not covered; pair it with manual and assistive-technology testing. Heading structure is covered in depth by heading-beacon.

## Rules

| Rule | Default severity | What it means |
|---|---|---|
| `img-alt-missing` | high | Image has no alt attribute (WCAG 1.1.1) |
| `img-alt-suspicious` | medium | Alt text is a file name, placeholder or redundant ("image of") (WCAG 1.1.1) |
| `input-label-missing` | high | Form control has no accessible name (label, aria-label, aria-labelledby, title) (WCAG 1.3.1, 4.1.2) |
| `button-name-missing` | high | Button has no accessible name (WCAG 4.1.2) |
| `link-name-missing` | high | Link has no accessible name (WCAG 2.4.4, 4.1.2) |
| `link-name-generic` | low | Link text is generic ("click here", "read more") without context (WCAG 2.4.4) |
| `html-lang-missing` | medium | <html> has no valid lang attribute (WCAG 3.1.1) |
| `page-title-missing` | medium | Page has no <title> (WCAG 2.4.2) |
| `landmark-main-missing` | low | Page has no <main> landmark (WCAG 1.3.1, 2.4.1) |
| `landmark-main-multiple` | low | Page has more than one visible <main> landmark |
| `contrast-insufficient` | high | Inline text colour contrast is below 4.5:1 (3:1 for large text) (WCAG 1.4.3) |
| `duplicate-id` | medium | id is used more than once and is referenced by ARIA or a label (WCAG 4.1.1/1.3.1) |
| `aria-role-invalid` | medium | role attribute is not a valid WAI-ARIA role (WCAG 4.1.2) |
| `aria-reference-missing` | medium | aria-labelledby / aria-describedby / for points at a missing id |
| `aria-hidden-focusable` | high | aria-hidden="true" element is or contains a focusable element (WCAG 4.1.2) |
| `tabindex-positive` | medium | tabindex greater than 0 disrupts focus order (WCAG 2.4.3) |
| `iframe-title-missing` | medium | <iframe> has no title (WCAG 4.1.2) |
| `viewport-zoom-disabled` | high | meta viewport disables zoom (user-scalable=no or maximum-scale < 2) (WCAG 1.4.4) |
| `media-autoplay` | medium | Audio/video autoplays with sound and no controls (WCAG 1.4.2) |
| `table-header-missing` | low | Data table has no <th> header cells (WCAG 1.3.1) |
| `svg-name-missing` | low | Standalone <svg role="img"> has no accessible name (WCAG 1.1.1) |
| `focus-outline-removed` | medium | Inline style removes the focus outline (outline: none/0) (WCAG 2.4.7) |
| `allowlist-expired` | medium | An allowlist entry is past its `expires` date |
| `allowlist-unused` | info | An allowlist entry matched nothing |

## Install and run

```bash
npx a11y-warden dist
npx a11y-warden dist --update-baseline   # record existing issues once
npx a11y-warden dist --baseline .a11y-baseline.json --fail-on medium
npx a11y-warden _site --format sarif > a11y.sarif
```

Pages are mapped to URLs the way static hosts serve them: `index.html` → `/`, `blog/index.html` → `/blog/`, `about.html` → `/about.html` (or `/about` with `--clean-urls`). Pass `--base-url` with your public URL, or let it be inferred from canonical / `og:url` tags. Meta-refresh redirect stubs and `404.html` are skipped. `X-Robots-Tag` and `Link` headers are read from Netlify/Cloudflare `_headers` and `vercel.json`.

### Sample output

```text
a11y-warden — /workspace/a11y-warden/test/fixtures/bad
2 page(s) audited

HIGH     index.html:1 meta viewport "width=device-width, user-scalable=no" blocks zooming [viewport-zoom-disabled]
         ↳ fix: Remove user-scalable=no and maximum-scale.
HIGH     index.html:2 <img src="hero.jpg"> has no alt [img-alt-missing]
         ↳ fix: Add alt text describing the image, or alt="" if it is decorative.
HIGH     index.html:3 <input name="q"> has no label (placeholder is not a label) [input-label-missing]
         ↳ fix: Add <label for="id">, wrap it in <label>, or use aria-label.
HIGH     index.html:3 <select name="s"> has no label [input-label-missing]
```

## Options

```text
a11y-warden 1.0.0 — WCAG 2.2 audit of static HTML with baseline support

Usage: a11y-warden [site-dir] [options]

Site
      --base-url <url>        Public URL of the site, e.g. https://example.com (default: inferred from canonical/og:url)
      --include <globs>       Only check these pages (file or URL path globs, comma-separated)
      --exclude <globs>       Skip these pages
      --clean-urls            Pages are served without .html (about.html -> /about)
Baseline
      --baseline <file>        Ignore findings recorded in this baseline file (default: .a11y-baseline.json if present)
      --update-baseline        Write all current findings to the baseline file and exit 0
      --strict-ids             Report every duplicate id, not only referenced ones

Common
  -c, --config <file>     JSON config (default: .a11y-warden.json or "a11yWarden" in package.json)
  -f, --format <fmt>      text (default) | json | sarif | markdown
      --json <file>       Also write a JSON report
      --sarif <file>      Also write SARIF 2.1.0
      --markdown <file>   Also write Markdown (e.g. for a job summary)
      --fail-on <sev>     critical | high | medium | low | info | none (default: high)
      --list-rules        Print rules and default severities
      --no-fixes          Hide fix suggestions in text output
      --no-color          Disable colours
  -v, --version / -h, --help

Exit codes: 0 = passed, 1 = findings at or above --fail-on, 2 = usage, config or read error.
```

## Configuration and allowlist

Options can live in `.a11y-warden.json` (or a `"a11yWarden"` key in `package.json`, or `--config <file>`):

```json
{
  "failOn": "medium",
  "severity": {
    "img-alt-missing": "low"
  },
  "allowlist": [
    {
      "rule": "contrast-insufficient",
      "subject": "/legacy/*",
      "reason": "Legacy brand colours, redesign due Q1",
      "expires": "2027-03-31"
    }
  ],
  "baseline": ".a11y-baseline.json",
  "defaultBackground": "#ffffff"
}
```

- **`severity`** changes a rule's severity, or turns it `"off"`.
- **`allowlist`** entries suppress matching findings. Each needs a `reason` and matches on any combination of `rule`, `file`, `subject` (globs with `*`) and `match` (a substring of the message). Add `expires` (`YYYY-MM-DD`) so the exception is time-boxed: once it lapses the finding comes back along with an `allowlist-expired` finding (medium). Entries that no longer match anything are reported as `allowlist-unused` (info).

Config can also set `baseUrl`, `include`, `exclude` and `cleanUrls`. The config file is looked up in the site directory first, then in the current directory, so `.a11y-warden.json` can live at your repository root. Other keys: `baseline` (file path), `defaultBackground` (colour used when no inline background is found, default `#ffffff`) and `strictIds`.

## Output and exit codes

- `--format text` (default), `json`, `sarif` (SARIF 2.1.0 for GitHub code scanning) or `markdown` (for job summaries and PR comments). `--json`, `--sarif` and `--markdown` write extra report files in the same run.
- `--fail-on <severity>` sets the threshold (`critical`, `high`, `medium`, `low`, `info`, `none`; default `high`).
- Exit codes: **0** passed, **1** findings at or above `--fail-on`, **2** usage, config or read error.

## GitHub Action

```yaml
permissions:
  contents: read
  security-events: write   # only needed for the SARIF upload
jobs:
  a11y-warden:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4
        with: { persist-credentials: false }
      - run: npm ci && npm run build   # produce the static site first
      - uses: MrLouisWright/a11y-warden@v1
        with:
          path: dist
          fail-on: high
          sarif: a11y-warden.sarif
      - uses: github/codeql-action/upload-sarif@v3
        if: always()
        with: { sarif_file: a11y-warden.sarif }
```

| Input | Description | Default |
|---|---|---|
| `path` | Built site directory (e.g. dist, public, _site) | `.` |
| `base-url` | Public URL of the site, e.g. https://example.com | |
| `fail-on` | Failure threshold | `high` |
| `config` | Config file path | |
| `sarif` / `json` | Write SARIF / JSON report to this path | |
| `job-summary` | Add the Markdown report to the job summary | `true` |
| `args` | Extra CLI arguments | |

The action runs the bundled CLI with Node 20; it has no dependencies to install. Pin it to a commit SHA if your policy requires it.

## Library

```js
import { check, contrastRatio, parseColor } from "a11y-warden";
const report = check("dist");
contrastRatio(parseColor("#767676"), parseColor("#fff")); // 4.54
```

Types are included.

## Requirements

Node.js 18 or newer. Zero runtime dependencies.

## Licence

MIT © Louis Wright. See [LICENSE](LICENSE).
