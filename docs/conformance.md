# Shoelace conformance

Velcro runs Shoelace 2.20.1's own component test files, vendored unmodified in
`tests/upstream/shoelace-2.20.1/` (upstream commit `fb59fda70ed737c92611051b49bc7e3a5fed5dc5`, MIT), against
Velcro's components in Chromium. A resolver plugin points each test's Shoelace library import
(`dist/shoelace.js`) at Velcro's package root, which registers every component, and a test's own
`./<name>.js` at Velcro's registering entry for that component, and a test's `../../utilities/<name>.js` import (for
example the textarea test's `serialize`) at Velcro's export of the same utility, so the test runs against Velcro's
module. The vendored upstream copy of such a helper stays pinned in the record of the component that brings it. A test's
bare `lit` and `lit/decorators.js` imports resolve to the lit copy Velcro itself loads (the workspace root cannot resolve
them), so a test's `@customElement` fixtures extend the same `LitElement` as Velcro's components. No
test is edited, and Velcro skips none.
A test that upstream itself marks `it.skip` in its vendored file is reported as skipped, and the gate allows
only those. Run it with `pnpm test:upstream`; it prints each component's passed, failed and skipped counts and the
totals, and keeps a machine-readable scoreboard in the ignored `.airig/upstream/`.

Each vendored component has one record, `tests/upstream/components/<name>.json`, so a component is added without
editing a shared list:

- `files`: the SHA-256 of its vendored test file (the shared license and `src/internal/` helpers are pinned in
  `tests/upstream/shoelace-2.20.1/UPSTREAM.json`); any edited, missing or extra vendored file fails.
- `tests`: the complete pinned list of its expected tests (repeated titles carry a `[#n]` suffix); a run must report
  exactly those outcomes, with nothing missing or extra.
- `knownFailures`: every failing test, with a one-line reason.

The `verify:product` gate fails on any missing or extra outcome, on any load or session (infrastructure) failure,
which can never be recorded as known, on any failure that is not recorded and on any recorded failure that now
passes, so the known failures can only shrink. `pnpm test:upstream -- --write-inventory` and `--write-ledger` rewrite
the records of the components that reported results; `--write-inventory` refuses to remove a title from a record
unless `--allow-inventory-removal` is given (for a re-vendored test file).

When the gate fails in CI, the raw runner output stays private and the log shows a bounded summary instead
(`scripts/upstream-summary.mjs`): at most 20 lines, then a `+N more` count. Each finding is an outcome from a fixed list
(`failed`, `unexpected`, `missing`, `skipped-mismatch`), a component and a test title, plus fixed-word lines for a
component-level problem (`infrastructure`, `no-results`, `records`) or for why the run was blocked (`vendor-changed`,
`records-drift`, `results-differ` and the like). Every word comes from a constant table and is chosen by which row
matched, never copied from the output; a result line that matches no row is `blocked: internal`. A component is named
only if it is in the catalog and a title only if it is exactly a title pinned in that component's record, survives the
same redaction as the browser summary (with its own length bound, `MAX_TITLE`, 300 characters, instead of the browser
summary's 200, so a long pinned title such as some of sl-breadcrumb's is printed whole and never cut) and is not shaped
like a path (a backslash, a slash that starts a path, or two slashes); otherwise the line says `unlisted component` or
`unlisted title`. Counts, messages, values, stack traces and paths are never printed.

Many upstream titles are generated (template literals, loops, the shared form-control helper), so the literal-title
scan cannot see all of them. The records are therefore also held to their baseline, the merge base with `origin/main`
(`checkBaseline`, in the source tests and in `test:upstream`): while a component's pinned files and the shared pins
are unchanged, its inventory must equal the baseline's and its known failures may only shrink. A record changes them
only together with the vendored files it pins.

The gate covers Chromium only. The runner config takes a browser list (`VELCRO_UPSTREAM_BROWSERS`) so a
later Firefox and WebKit lane can reuse it.

Shoelace 2.20.1 ships no test file for resize-observer, so it has no record.

Harness notes: the runner page loads Velcro's light theme where upstream loads Shoelace's, uses upstream's
mocha settings (3 s timeout, one retry), and adds two guards so one failure cannot discard a whole file's
results: real form submission and navigation by `form.submit()` are suppressed, and an assertion that carries a
sinon spy is reported instead of crashing the runner. Neither guard can turn a failing assertion into a pass.
A third guard parks the pointer in the bottom-right corner before the first test starts: a page's pointer rests at
(0,0), which is a vertex of the clip-path triangle that `sl-menu-item` (Shoelace's and Velcro's alike) draws over the
viewport while a submenu is open, so Chrome's delayed hover update would send a `mouseover` to the item, and the item's
handler would take the focus back from a submenu that a key press had just opened. It moves no element and changes no
assertion, and it applies to every test file. `tests/product/upstream-harness.spec.mjs` checks that the pointer was
moved before the first test starts, and that the same check fails when the guard is cut out of the runner page; the
quirk itself is pinned in `tests/product/menu-item.spec.mjs` and listed on the menu item docs page.
Upstream's icon sprite sheet tests load `/docs/assets/images/sprite.svg`, which Shoelace's docs build generates
from Bootstrap Icons; the runner serves that one path from the same Bootstrap Icons sprite that Velcro's docs
site ships (`packages/docs/public/assets/images/sprite.svg`).

## Dependency note: inflation override

The test runner's dev server pulls in `inflation` through `co-body` (range `^2.0.0`). The root `package.json`
pins it to 2.0.0 with a pnpm override because the published integrity hash of 2.1.0 is falsely reported by
the repository privacy scanner (an opaque base64 hash, not workstation data; the same value appears in
Shoelace's own lockfile). This is an interim workaround: it affects development and test tooling only, not
Velcro's package dependencies, but it holds back normal updates of that package. The intended fix is a narrow
scanner change that recognizes validated lockfile integrity fields, which needs separate human review as a
protected change; remove the override once that lands.
