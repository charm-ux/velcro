# Third-party notices

Velcro itself is private and UNLICENSED (an owner release decision, unchanged by this file). This file retains
the notices that upstream licenses require for material adapted or copied into this repository. Nothing here
relicenses Velcro code.

**Scope: this file covers only material copied or adapted into this repository's source.** It is NOT a complete
inventory of third-party code bundled into built artifacts (for example Lit, `@charm-ux/core`, its `@floating-ui`
dependency and `@beatzball/litro-router`, which minified bundles can contain without their license comments).

**Release gate (mandatory):** before any package, CDN or site artifact is published, uploaded or deployed, a complete
license inventory and the required notices for every dependency bundled into that artifact must be produced and
shipped with it. This file alone never certifies an artifact: where a built artifact carries generated runtime notices
(for example `THIRD_PARTY_RUNTIME_NOTICES.md` in the documentation site), those notices are the inventory for it.

## Shoelace v2.20.1 (MIT)

- Source: the `@shoelace-style/shoelace` 2.20.1 release (https://github.com/shoelace-style/shoelace).
- Also used in: `docs/api/shoelace-2.20.1.custom-elements.json`, a subset of the Custom Elements Manifest that Shoelace's
  own analyzer configuration (`custom-elements-manifest.config.js`, without its IDE-integration output plugins) generates
  from the `v2.20.1` tag, commit `fb59fda70ed737c92611051b49bc7e3a5fed5dc5`: API names, types, defaults and descriptions
  of every Shoelace 2.20.1 component, read by the API parity check (`scripts/api/parity.mjs`) for the components Velcro
  implements and summarized per component in `docs/api/parity/<name>.md`. No Shoelace runtime or source files are
  included.
- Used in: `packages/velcro/src/components/button/button.ts` (API documentation wording, the rendered structure: a
  `base` `<button>` or `<a>` with `button` / `button--*` class names around the prefix, label and suffix slots, caret
  and spinner, the click, focus, validation and form-submission behavior, adapted from
  `src/components/button/button.component.ts`, and the restore of reflected properties' initial values adapted from
  `src/internal/shoelace-element.ts`), `packages/velcro/src/components/button/button.styles.ts` (styles adapted from
  `src/components/button/button.styles.ts`, with sl-icon sizing rules from `src/components/icon/icon.styles.ts` added
  for the inline caret), `packages/velcro/src/internal/form.ts` (the form control controller adapted from
  `src/internal/form.ts`),
  `packages/velcro/src/components/spinner/spinner.ts` (API documentation wording, and the rendered structure: an svg
  `base` part with `role="progressbar"` and a track and an indicator circle, adapted from
  `src/components/spinner/spinner.component.ts`), `packages/velcro/src/components/spinner/spinner.styles.ts`
  (styles adapted from `src/components/spinner/spinner.styles.ts` with the changes listed in its header) and
  `packages/velcro/themes/light.css` and `packages/velcro/themes/dark.css` (copied from `src/themes/light.css`
  and `src/themes/dark.css` with a provenance header added; a product spec pins their content). The button implementation and styles are original and built on `@charm-ux/core`, and the
  spinner is built on the `@charm-ux/core` spinner; no Shoelace runtime or source files are included.
- Also used in: `packages/velcro/src/components/badge/badge.ts` (API documentation wording, and the rendered structure:
  a `span` with the `base` part, `role="status"` and `badge` / `badge--*` class names around a default slot, adapted
  from `src/components/badge/badge.component.ts`), `packages/velcro/src/components/badge/badge.styles.ts` (styles
  adapted from `src/components/badge/badge.styles.ts`, with the keyframes renamed),
  `packages/velcro/src/components/divider/divider.ts` (API documentation wording and the host `role="separator"` /
  `aria-orientation` behavior, adapted from `src/components/divider/divider.component.ts`) and
  `packages/velcro/src/components/divider/divider.styles.ts` (styles adapted from
  `src/components/divider/divider.styles.ts`, with the core host-rule resets added),
  `packages/velcro/src/components/progress-ring/progress-ring.ts` (API documentation wording, and the rendered
  structure: a `div` `base` part with `role="progressbar"`, an svg track and indicator circle, and a default slot with
  the `label` part, adapted from `src/components/progress-ring/progress-ring.component.ts`) and
  `packages/velcro/src/components/progress-ring/progress-ring.styles.ts` (styles adapted from
  `src/components/progress-ring/progress-ring.styles.ts`, with token fallbacks and a forced-colors rule added; no
  tokens beyond those already in the light theme are needed). The badge and divider are built
  on the `@charm-ux/core` badge and divider; no Shoelace runtime or source files are included. Source retrieved for
  inspection: files of the `v2.20.1` tag (`src/components/{badge,divider,progress-ring}/*`, `src/themes/light.css`); the added light
  theme tokens (`--sl-color-neutral-200`, `--sl-border-radius-small`, `--sl-letter-spacing-normal`,
  `--sl-panel-border-color`, `--sl-panel-border-width`) follow that file's names and values.
- Also used in: `packages/velcro/src/components/card/card.ts` (API documentation wording, and the rendered structure:
  a `div` with the `base` part around `image`, `header`, `body` and `footer` slots with `card` / `card--has-*` class
  names, adapted from `src/components/card/card.component.ts`) and `packages/velcro/src/components/card/card.styles.ts`
  (styles adapted from `src/components/card/card.styles.ts`). The card is built on the `@charm-ux/core` card; no
  Shoelace runtime or source files are included. The added light theme tokens (`--sl-border-radius-medium`,
  `--sl-shadow-x-small`, `--sl-panel-background-color`) follow `src/themes/light.css` names and values.
- Also used in: `packages/velcro/src/components/progress-bar/progress-bar.ts` (API documentation wording, and the
  rendered structure: a `base` part with `role="progressbar"` and an `indicator` part sized by a width style around
  the default slot with the `label` part, adapted from `src/components/progress-bar/progress-bar.component.ts`),
  `packages/velcro/src/components/progress-bar/progress-bar.styles.ts` (styles adapted from
  `src/components/progress-bar/progress-bar.styles.ts`, with the keyframes renamed and a host width reset added) and
  the docs example and page `packages/docs/examples/progress-bar/basic.html` and
  `packages/docs/pages/components/progress-bar.ts` (examples and wording adapted from
  `docs/pages/components/progress-bar.md`). The progress bar is built on the `@charm-ux/core` progress bar; no
  Shoelace runtime or source files are included. Source retrieved for inspection: files of the `v2.20.1` tag
  (`src/components/progress-bar/*`, `docs/pages/components/progress-bar.md`, `src/themes/light.css`); the added light
  theme tokens (`--sl-font-weight-normal`, `--sl-shadow-small`) follow that file's names and values.
- Also used in: `packages/velcro/src/components/relative-time/relative-time.ts` (API documentation wording, the unit
  thresholds, the rendered `time` element with a `datetime` attribute and the sync scheduling, adapted from
  `src/components/relative-time/relative-time.component.ts`), `packages/velcro/src/components/relative-time/relative-time.styles.ts`
  (written for Velcro; upstream has no styles file) and the docs page examples adapted from
  `docs/pages/components/relative-time.md`. Built on the `@charm-ux/core` base element and the shared localization
  controller; no Shoelace runtime or source files are included.
- Also used in: `packages/velcro/src/components/resize-observer/resize-observer.ts` (API documentation wording and
  behavior: a `ResizeObserver` over the elements assigned to the default slot, started and stopped by `disabled` and
  reporting through `sl-resize`, adapted from `src/components/resize-observer/resize-observer.component.ts`) and
  `packages/velcro/src/components/resize-observer/resize-observer.styles.ts` (styles adapted from
  `src/components/resize-observer/resize-observer.styles.ts`, declarations unchanged), plus the docs page example
  adapted from `docs/pages/components/resize-observer.md` and the added light theme token `--sl-input-border-color`
  (name and value following `src/themes/light.css`). The component extends the `@charm-ux/core` base element; no
  Shoelace runtime or source files are included.
- Also used in: `packages/velcro/src/components/split-panel/split-panel.ts` (API documentation wording and behavior: the
  position, snapping, keyboard, drag and resize logic and the rendered structure, adapted from
  `src/components/split-panel/split-panel.component.ts`), `packages/velcro/src/components/split-panel/split-panel.styles.ts`
  (styles adapted from `src/components/split-panel/split-panel.styles.ts` and `src/styles/component.styles.ts`, declarations unchanged),
  `packages/velcro/src/internal/drag.ts` (adapted from `src/internal/drag.ts`) and `packages/velcro/src/internal/math.ts`
  (the `clamp` helper, adapted from `src/internal/math.ts`), plus the docs page examples adapted from
  `docs/pages/components/split-panel.md` (the icon handle is replaced by an inline svg and the select by a native one).
  Shoelace's `src/components/split-panel/split-panel.test.ts` and the two helpers it imports
  (`src/internal/test.ts`, `src/internal/test/data-testid-helpers.ts`) are vendored unchanged for the conformance run
  (see `tests/upstream/`). The component extends the `@charm-ux/core` base element and uses the localization controller
  listed above; no Shoelace runtime or source files are included in the package.
- Also used in: `packages/velcro/src/components/mutation-observer/mutation-observer.ts` (API documentation wording and
  behavior: a `MutationObserver` over the element and its subtree, configured by `attr`, `attr-old-value`, `char-data`,
  `char-data-old-value` and `child-list`, started and stopped by `disabled` and reporting through `sl-mutation`, adapted
  from `src/components/mutation-observer/mutation-observer.component.ts`, and the restore of reflected properties'
  initial values, adapted from `src/internal/shoelace-element.ts`) and
  `packages/velcro/src/components/mutation-observer/mutation-observer.styles.ts` (styles adapted from
  `src/components/mutation-observer/mutation-observer.styles.ts` and `src/styles/component.styles.ts`, declarations
  unchanged), plus the docs page examples
  adapted from `docs/pages/components/mutation-observer.md`. The component extends the `@charm-ux/core` base element;
  no Shoelace runtime or source files are included.
- Also used in: `packages/velcro/src/components/popup/popup.ts` (API documentation wording and behavior: anchoring by
  slot, id, element or virtual element, `active`, placement, distance, skidding, arrow, flip, shift, auto-size, sync,
  the hover bridge, the rendered `popup` / `popup__arrow` / `popup-hover-bridge` structure and `sl-reposition`, adapted
  from `src/components/popup/popup.component.ts`, and the restore of reflected properties' initial values, adapted from
  `src/internal/shoelace-element.ts`) and `packages/velcro/src/components/popup/popup.styles.ts` (styles adapted from
  `src/components/popup/popup.styles.ts` and `src/styles/component.styles.ts`, declarations unchanged), plus the docs
  page examples adapted from `docs/pages/components/popup.md`. The component extends the `@charm-ux/core` base element
  and positions through the Floating UI calls of the `@charm-ux/core` popup; no Shoelace runtime or source files are
  included. Its offset-parent lookup is adapted from composed-offset-position and @floating-ui/utils (listed below).
- Also used in: `packages/velcro/src/components/visually-hidden/visually-hidden.ts` (API documentation wording and the
  rendered structure, a default slot only, adapted from `src/components/visually-hidden/visually-hidden.component.ts`)
  and `packages/velcro/src/components/visually-hidden/visually-hidden.styles.ts` (styles adapted from
  `src/components/visually-hidden/visually-hidden.styles.ts`, declarations unchanged), plus two example snippets in the
  docs page examples adapted from `docs/pages/components/visually-hidden.md`. The component extends the `@charm-ux/core`
  base element; no Shoelace runtime or source files are included.
- Also used in: `packages/velcro/src/components/switch/switch.ts` (API documentation wording, the rendered structure: a
  `base` `<label>` around a hidden checkbox with `role="switch"`, the `control` / `thumb` track, the `label` part with
  the default slot and the `form-control-help-text` part, and the click, keyboard, focus, validation and form behavior,
  adapted from `src/components/switch/switch.component.ts`, with the `defaultValue('checked')` rule from
  `src/internal/default-value.ts` and the restore of reflected properties' initial values from
  `src/internal/shoelace-element.ts`), `packages/velcro/src/components/switch/switch.styles.ts` (styles concatenated
  from `src/styles/component.styles.ts`, `src/styles/form-control.styles.ts` and
  `src/components/switch/switch.styles.ts`, rules unchanged) and the docs page and examples
  `packages/docs/pages/components/switch.ts` and `packages/docs/examples/switch/*.html` (examples and wording adapted
  from `docs/pages/components/switch.md`). The switch is built on the `@charm-ux/core` switch; no Shoelace runtime or
  source files are included.
- Also used in: `packages/velcro/src/components/format-bytes/format-bytes.ts` (API documentation wording and the
  formatting algorithm, adapted from `src/components/format-bytes/format-bytes.component.ts`),
  `packages/velcro/src/components/format-bytes/format-bytes.styles.ts` (written for Velcro; upstream has no styles file)
  and the localization controller listed below. Built on the `@charm-ux/core` base element; no Shoelace runtime or
  source files are included.
- Also used in: the localization module. `packages/velcro/src/internal/localize.ts` is adapted from
  `@shoelace-style/localize` 3.2.1 (A Beautiful Site, LLC, MIT License), the version Shoelace 2.20.1 pins and bundles
  in its published package: the translation registry (`registerTranslation`, with the first registered translation as
  the fallback), the document-locale snapshot, and the `term`, `exists`, `lang`, `dir`, `number`, `date` and
  `relativeTime` behavior, with TypeScript types added and the host's `dir` read from its attribute.
  `packages/velcro/src/utilities/localize.ts`
  (the `Translation` term list, the English registration and the re-export of `registerTranslation`) is adapted from
  `src/utilities/localize.ts`. The 29 translation modules `packages/velcro/src/translations/*.ts` are copied from
  `src/translations/*.ts` at commit `fb59fda70ed737c92611051b49bc7e3a5fed5dc5` and are shipped in the package: 21 are
  unmodified, and in 8 (ar, cs, en, fi, hr, id, it and sl) the one import of `registerTranslation` from
  `@shoelace-style/localize` is changed to Velcro's `../internal/localize.js`. Their hash manifest is
  `packages/velcro/src/translations/UPSTREAM.json`. The docs page `packages/docs/pages/localization.ts` adapts the
  wording and examples of `docs/pages/getting-started/localization.md`.
- Also used in: `packages/velcro/src/components/format-date/format-date.ts` (API documentation wording and the
  rendering algorithm, a `time` element with an ISO `datetime` around an `Intl.DateTimeFormat` result with `hour-format`
  mapped to `hour12`, adapted from `src/components/format-date/format-date.component.ts`),
  `packages/velcro/src/components/format-date/format-date.styles.ts` (written for Velcro; upstream has no styles file)
  and `packages/docs/examples/format-date/*.html` with `packages/docs/pages/components/format-date.ts` (example markup
  and explanatory wording adapted from `docs/pages/components/format-date.md`). Built on the `@charm-ux/core` base
  element; no Shoelace runtime or source files are included.
- Also used in: `packages/velcro/src/components/format-number/format-number.ts` (API documentation wording and the
  `Intl.NumberFormat` option mapping, adapted from `src/components/format-number/format-number.component.ts`) and
  `packages/velcro/src/components/format-number/format-number.styles.ts` (written for Velcro; upstream has no styles
  file). Uses the localization controller listed above. Built on the `@charm-ux/core` base element; no Shoelace runtime
  or source files are included.
- Also used in: `packages/velcro/src/components/include/include.ts` (API documentation wording, the request and
  response handling, the replacement of the element's content, the re-creation of scripts and the `sl-load` and
  `sl-error` events, adapted from `src/components/include/include.component.ts`, and the `@watch` timing of the `src`
  change from `src/internal/watch.ts`), `packages/velcro/src/components/include/request.ts` (the request function and
  its cache, adapted from `src/components/include/request.ts`),
  `packages/velcro/src/components/include/include.styles.ts` (styles concatenated from
  `src/styles/component.styles.ts` and `src/components/include/include.styles.ts`, rules unchanged) and the docs page
  and examples `packages/docs/pages/components/include.ts` and `packages/docs/examples/include/*.html` (example markup
  and explanatory wording adapted from `docs/pages/components/include.md`; the included fixture file
  `packages/docs/public/include-fixtures/hello/index.html` is original, not Shoelace's `include.html`). The include is
  built on the `@charm-ux/core` base element; no Shoelace runtime or source files are included.
- Also used in: `packages/velcro/src/components/skeleton/skeleton.ts` (API documentation wording, and the rendered
  structure: a `div` with the `base` part and `skeleton` / `skeleton--*` class names around a `div` with the
  `indicator` part, adapted from `src/components/skeleton/skeleton.component.ts`),
  `packages/velcro/src/components/skeleton/skeleton.styles.ts` (styles adapted from
  `src/components/skeleton/skeleton.styles.ts`, with the keyframes renamed and token fallbacks added) and
  `packages/docs/examples/skeleton/*.html` with `packages/docs/pages/components/skeleton.ts` (example markup and
  explanatory wording adapted from `docs/pages/components/skeleton.md`). The skeleton is built on the
  `@charm-ux/core` skeleton; no Shoelace runtime or source files are included. The added light theme tokens
  (`--sl-border-radius-medium`, `--sl-border-radius-circle`) follow `src/themes/light.css` names and values.
- Also used in: `packages/velcro/src/components/icon/icon.ts` (API documentation wording, and the icon resolution and
  rendering behavior: library or `src` lookup, the shared request cache with cacheable and retryable errors, sprite
  sheets, mutators, `sl-load` / `sl-error` and the label-driven host ARIA, adapted from
  `src/components/icon/icon.component.ts`), `packages/velcro/src/components/icon/icon.styles.ts` (adapted from
  `src/components/icon/icon.styles.ts`), `packages/velcro/src/components/icon/library.ts`,
  `packages/velcro/src/components/icon/library.default.ts` and `packages/velcro/src/utilities/base-path.ts` (the icon
  library registry and base path contract, adapted from `src/components/icon/library.ts`,
  `src/components/icon/library.default.ts` and `src/utilities/base-path.ts`),
  `packages/velcro/src/components/icon/library.system.ts` (the system icon set and resolver, copied from
  `src/components/icon/library.system.ts`; the icons themselves are Bootstrap Icons, see below) and
  `packages/docs/pages/components/icon.ts` with `packages/docs/examples/icon/` (example sections and wording adapted from
  `docs/pages/components/icon.md`). No Shoelace runtime or source files are included.
- Also used in: `packages/velcro/src/components/tab-panel/tab-panel.ts` (API documentation wording, the rendered
  structure: one slot with the `base` part and the `tab-panel` / `tab-panel--active` class names, the generated
  `sl-tab-panel-<n>` id, the `role` and `aria-hidden` handling, adapted from
  `src/components/tab-panel/tab-panel.component.ts`, and the restore of reflected properties' initial values from
  `src/internal/shoelace-element.ts`), `packages/velcro/src/components/tab-panel/tab-panel.styles.ts` (styles
  concatenated from `src/styles/component.styles.ts` and `src/components/tab-panel/tab-panel.styles.ts`, rules
  unchanged) and the docs page and examples `packages/docs/pages/components/tab-panel.ts` and
  `packages/docs/examples/tab-panel/*.html` (example markup and wording adapted from
  `docs/pages/components/tab-panel.md`). The tab panel is built on the `@charm-ux/core` tab panel; no Shoelace runtime
  or source files are included.
- Also used in: `packages/velcro/src/components/animation/animation.ts` (API documentation wording, the rendered
  structure: one default slot, the Web Animations API calls, the preset and easing lookup, the `sl-start`, `sl-finish`
  and `sl-cancel` events, adapted from `src/components/animation/animation.component.ts`, the order of its `@watch`
  handlers from `src/internal/watch.ts`, and the restore of reflected properties' initial values from
  `src/internal/shoelace-element.ts`), `packages/velcro/src/components/animation/animations.ts` (`getAnimationNames`
  and `getEasingNames`, adapted from `src/components/animation/animations.ts`),
  `packages/velcro/src/utilities/animation.ts` (adapted from `src/utilities/animation.ts`),
  `packages/velcro/src/components/animation/animation.styles.ts` (styles concatenated from
  `src/styles/component.styles.ts` and `src/components/animation/animation.styles.ts`, rules unchanged) and the docs
  page and examples `packages/docs/pages/components/animation.ts` and `packages/docs/examples/animation/*.html`
  (example markup and wording adapted from `docs/pages/components/animation.md`) and the React examples
  `packages/docs/examples/animation/react/*.jsx` (copied from the same page's React examples; only the import lines
  are changed to Velcro's React wrappers). The animation is built on the
  `@charm-ux/core` base element; no Shoelace runtime is included. The animation presets come from
  `@shoelace-style/animations` (next section).
- Also used in: `packages/velcro/src/utilities/form.ts` (`serialize` and `getFormControls`, adapted from
  `src/utilities/form.ts`; the form control collection it reads is Velcro's own, in `internal/form.ts`). It is shared by
  the form controls, so it has no component folder. No Shoelace runtime is included.
- Components added later record their Shoelace use in their own `packages/velcro/src/components/<name>/NOTICE.md`
  (one list entry like those above); the package and site copies of this file include those entries here.
<!-- component notices: packages/velcro/src/components/<name>/NOTICE.md -->
- Also used in: `tests/upstream/shoelace-2.20.1/` (test files only, never shipped): the upstream test files
  `src/components/<name>/<name>.test.ts` for each implemented component and the helpers under `src/internal/` and
  `src/utilities/`,
  copied unmodified from commit `fb59fda70ed737c92611051b49bc7e3a5fed5dc5` with the upstream `LICENSE.md` and hash
  manifests (`UPSTREAM.json` for the shared files, `tests/upstream/components/<name>.json` for each test file).
  They run against Velcro as a conformance check; nothing from them is included in any package or site.
- The 2.20.1 release carries no NOTICE file. Its license text, verbatim:

```text
Copyright (c) 2020 A Beautiful Site, LLC

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

## Bootstrap Icons v1.11.3 (MIT)

- Source: the GitHub `v1.11.3` release archive of Bootstrap Icons (https://github.com/twbs/icons), the source Shoelace
  2.20.1's `scripts/make-icons.js` downloads for its default icon library. Its 2,050 icon files, sprite sheet and
  LICENSE also have the same SHA-256 hashes as those jsDelivr's file index lists for the `bootstrap-icons` 1.11.3 npm
  package.
- Used in: `packages/velcro/assets/bootstrap-icons/bootstrap-icons.svg` and
  `packages/docs/public/assets/images/sprite.svg` (the release's sprite, copied unmodified; the package build generates
  the 2,050 icon files in `dist/assets/icons/` from it for the default icon library and checks each against the
  release's own files with `SHA256SUMS`, so they are byte-identical), `packages/velcro/assets/bootstrap-icons/LICENSE`
  (the license, copied unmodified), `packages/velcro/assets/bootstrap-icons/icons.json` (an index of icon names,
  titles, categories and tags, generated from the front matter of the release's `docs/content/icons/*.md`) and the
  system icons in
  `packages/velcro/src/components/icon/library.system.ts` (via Shoelace).
- The release carries no NOTICE file. Its license text, verbatim:

```text
The MIT License (MIT)

Copyright (c) 2019-2024 The Bootstrap Authors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```

## composed-offset-position 0.0.6 (MIT)

- Source: https://github.com/jcfranco/composed-offset-position (npm `composed-offset-position` 0.0.6).
- Used in: `packages/velcro/src/internal/composed-offset-parent.ts` (the `offsetParent` ponyfill and its flat-tree
  parent walk, adapted with type annotations; used by `packages/velcro/src/components/popup/popup.ts`, as Shoelace's
  popup uses the package). No package or runtime of composed-offset-position is a dependency.
- License text, verbatim:

```text
MIT License

Copyright (c) 2023 composed-offset-position contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```

## @floating-ui/utils 0.2.12 (MIT)

- Source: https://github.com/floating-ui/floating-ui (npm `@floating-ui/utils` 0.2.12, `dom` entry).
- Used in: `packages/velcro/src/internal/composed-offset-parent.ts` (`isContainingBlock` and `isWebKit`, adapted with
  type annotations). Velcro has no direct dependency on Floating UI; the copy `@charm-ux/core` depends on is used at
  runtime.
- License text, verbatim:

```text
MIT License

Copyright (c) 2021-present Floating UI contributors

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

## @shoelace-style/animations 1.2.0 (MIT), with animate.css (MIT)

- Source: the published `@shoelace-style/animations` 1.2.0 npm package (https://github.com/shoelace-style/animations),
  the version Shoelace 2.20.1's `package-lock.json` resolves, with npm integrity
  `sha512-avvo1xxkLbv2dgtabdewBbqcJfV0e0zCwFqkPMnHFGbJbBHorRFfMAHh1NG9ymmXn0jW95ibUVH03E1NYXD6Gw==`. The record
  `packages/velcro/src/components/animation/presets/SOURCE.json` pins that integrity, the sha256 of every file in the
  tarball and a digest of its data; a test fails if the vendored data differs from the package's. Copyright (c) 2020
  A Beautiful Site, LLC. The package generates its
  keyframes from animate.css (https://github.com/animate-css/animate.css; its build declares animate.css ^4.1.1) and
  ships animate.css's license as `dist/LICENSE`, Copyright (c) 2020 Daniel Eden.
- Copied into: `packages/velcro/src/components/animation/presets/presets.ts`. The package's 98 animation modules
  (`dist/<group>/<name>.js`) and its easings module (`dist/easings/easings.js`) are concatenated into one module in the
  order of `dist/index.js`, with a group comment per group and TypeScript type annotations added; the keyframe and
  easing values are unchanged. A change-notice header comment is at the top of the file.
- License text of `@shoelace-style/animations`, verbatim from its `LICENSE.md`:

```text
Copyright (c) 2020 A Beautiful Site, LLC

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

- License text of animate.css, verbatim from the package's `dist/LICENSE`:

```text
The MIT License (MIT)

Copyright (c) 2020 Daniel Eden

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Litro scaffold, @beatzball/create-litro 0.15.3 (Apache-2.0)

- Source: the published `@beatzball/create-litro` 0.15.3 package (https://github.com/beatzball/litro,
  `packages/create-litro`), fullstack recipe template under `dist/recipes/fullstack/template/`.
- The published package declares `Apache-2.0`, ships a LICENSE file ("Copyright 2026 beatzball", reproduced below)
  and no NOTICE file, so there is no NOTICE text to carry. The documentation site also depends on
  `@beatzball/litro` 0.17.4 (Apache-2.0, no NOTICE file); it is installed, not copied. Its runtime code is
  bundled into the built site, which falls under the release gate above (this file alone does not satisfy it).
- Copied byte-for-byte (a change-notice header comment was then added at the top of each .ts file; `tsconfig.json`
  is JSON and carries no header, it is unmodified):
  - `app.ts` and `app-main.ts` -> `packages/docs/app.ts`, `packages/docs/app-main.ts`
  - `server/middleware/vite-dev.ts` -> `packages/docs/server/middleware/vite-dev.ts`
  - `server/routes/[...].ts` -> relocated to `packages/docs/server/handlers/pages.ts`
  - `tsconfig.json` -> `packages/docs/tsconfig.json`
- Modified: `app.ts` (a comment that referred to the scaffold's verification script, which does not exist here, was
  corrected). Adapted derivatives: `packages/docs/nitro.config.ts` and `packages/docs/vite.config.ts` (server actions
  removed, explicit catch-all handler registration, second Vite entry and CSS asset naming added). The page and
  layout files are original.
- License text, verbatim from that package's LICENSE:

```text
                                 Apache License
                           Version 2.0, January 2004
                        http://www.apache.org/licenses/

   TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION

   1. Definitions.

      "License" shall mean the terms and conditions for use, reproduction,
      and distribution as defined by Sections 1 through 9 of this document.

      "Licensor" shall mean the copyright owner or entity authorized by
      the copyright owner that is granting the License.

      "Legal Entity" shall mean the union of the acting entity and all
      other entities that control, are controlled by, or are under common
      control with that entity. For the purposes of this definition,
      "control" means (i) the power, direct or indirect, to cause the
      direction or management of such entity, whether by contract or
      otherwise, or (ii) ownership of fifty percent (50%) or more of the
      outstanding shares, or (iii) beneficial ownership of such entity.

      "You" (or "Your") shall mean an individual or Legal Entity
      exercising permissions granted by this License.

      "Source" form shall mean the preferred form for making modifications,
      including but not limited to software source code, documentation
      source, and configuration files.

      "Object" form shall mean any form resulting from mechanical
      transformation or translation of a Source form, including but
      not limited to compiled object code, generated documentation,
      and conversions to other media types.

      "Work" shall mean the work of authorship, whether in Source or
      Object form, made available under the License, as indicated by a
      copyright notice that is included in or attached to the work
      (an example is provided in the Appendix below).

      "Derivative Works" shall mean any work, whether in Source or Object
      form, that is based on (or derived from) the Work and for which the
      editorial revisions, annotations, elaborations, or other modifications
      represent, as a whole, an original work of authorship. For the purposes
      of this License, Derivative Works shall not include works that remain
      separable from, or merely link (or bind by name) to the interfaces of,
      the Work and Derivative Works thereof.

      "Contribution" shall mean any work of authorship, including
      the original version of the Work and any modifications or additions
      to that Work or Derivative Works thereof, that is intentionally
      submitted to Licensor for inclusion in the Work by the copyright owner
      or by an individual or Legal Entity authorized to submit on behalf of
      the copyright owner. For the purposes of this definition, "submitted"
      means any form of electronic, verbal, or written communication sent
      to the Licensor or its representatives, including but not limited to
      communication on electronic mailing lists, source code control systems,
      and issue tracking systems that are managed by, or on behalf of, the
      Licensor for the purpose of discussing and improving the Work, but
      excluding communication that is conspicuously marked or otherwise
      designated in writing by the copyright owner as "Not a Contribution."

      "Contributor" shall mean Licensor and any individual or Legal Entity
      on behalf of whom a Contribution has been received by Licensor and
      subsequently incorporated within the Work.

   2. Grant of Copyright License. Subject to the terms and conditions of
      this License, each Contributor hereby grants to You a perpetual,
      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
      copyright license to reproduce, prepare Derivative Works of,
      publicly display, publicly perform, sublicense, and distribute the
      Work and such Derivative Works in Source or Object form.

   3. Grant of Patent License. Subject to the terms and conditions of
      this License, each Contributor hereby grants to You a perpetual,
      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
      (except as stated in this section) patent license to make, have made,
      use, offer to sell, sell, import, and otherwise transfer the Work,
      where such license applies only to those patent claims licensable
      by such Contributor that are necessarily infringed by their
      Contribution(s) alone or by combination of their Contribution(s)
      with the Work to which such Contribution(s) was submitted. If You
      institute patent litigation against any entity (including a
      cross-claim or counterclaim in a lawsuit) alleging that the Work
      or a Contribution incorporated within the Work constitutes direct
      or contributory patent infringement, then any patent licenses
      granted to You under this License for that Work shall terminate
      as of the date such litigation is filed.

   4. Redistribution. You may reproduce and distribute copies of the
      Work or Derivative Works thereof in any medium, with or without
      modifications, and in Source or Object form, provided that You
      meet the following conditions:

      (a) You must give any other recipients of the Work or
          Derivative Works a copy of this License; and

      (b) You must cause any modified files to carry prominent notices
          stating that You changed the files; and

      (c) You must retain, in the Source form of any Derivative Works
          that You distribute, all copyright, patent, trademark, and
          attribution notices from the Source form of the Work,
          excluding those notices that do not pertain to any part of
          the Derivative Works; and

      (d) If the Work includes a "NOTICE" text file as part of its
          distribution, then any Derivative Works that You distribute must
          include a readable copy of the attribution notices contained
          within such NOTICE file, excluding those notices that do not
          pertain to any part of the Derivative Works, in at least one
          of the following places: within a NOTICE text file distributed
          as part of the Derivative Works; within the Source form or
          documentation, if provided along with the Derivative Works; or,
          within a display generated by the Derivative Works, if and
          wherever such third-party notices normally appear. The contents
          of the NOTICE file are for informational purposes only and
          do not modify the License. You may add Your own attribution
          notices within Derivative Works that You distribute, alongside
          or as an addendum to the NOTICE text from the Work, provided
          that such additional attribution notices cannot be construed
          as modifying the License.

      You may add Your own copyright statement to Your modifications and
      may provide additional or different license terms and conditions
      for use, reproduction, or distribution of Your modifications, or
      for any such Derivative Works as a whole, provided Your use,
      reproduction, and distribution of the Work otherwise complies with
      the conditions stated in this License.

   5. Submission of Contributions. Unless You explicitly state otherwise,
      any Contribution intentionally submitted for inclusion in the Work
      by You to the Licensor shall be under the terms and conditions of
      this License, without any additional terms or conditions.
      Notwithstanding the above, nothing herein shall supersede or modify
      the terms of any separate license agreement you may have executed
      with Licensor regarding such Contributions.

   6. Trademarks. This License does not grant permission to use the trade
      names, trademarks, service marks, or product names of the Licensor,
      except as required for reasonable and customary use in describing the
      origin of the Work and reproducing the content of the NOTICE file.

   7. Disclaimer of Warranty. Unless required by applicable law or
      agreed to in writing, Licensor provides the Work (and each
      Contributor provides its Contributions) on an "AS IS" BASIS,
      WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or
      implied, including, without limitation, any warranties or conditions
      of TITLE, NON-INFRINGEMENT, MERCHANTABILITY, or FITNESS FOR A
      PARTICULAR PURPOSE. You are solely responsible for determining the
      appropriateness of using or redistributing the Work and assume any
      risks associated with Your exercise of permissions under this License.

   8. Limitation of Liability. In no event and under no legal theory,
      whether in tort (including negligence), contract, or otherwise,
      unless required by applicable law (such as deliberate and grossly
      negligent acts) or agreed to in writing, shall any Contributor be
      liable to You for damages, including any direct, indirect, special,
      incidental, or consequential damages of any character arising as a
      result of this License or out of the use or inability to use the
      Work (including but not limited to damages for loss of goodwill,
      work stoppage, computer failure or malfunction, or any and all
      other commercial damages or losses), even if such Contributor
      has been advised of the possibility of such damages.

   9. Accepting Warranty or Additional Liability. While redistributing
      the Work or Derivative Works thereof, You may choose to offer,
      and charge a fee for, acceptance of support, warranty, indemnity,
      or other liability obligations and/or rights consistent with this
      License. However, in accepting such obligations, You may act only
      on Your own behalf and on Your sole responsibility, not on behalf
      of any other Contributor, and only if You agree to indemnify,
      defend, and hold each Contributor harmless for any liability
      incurred by, or claims asserted against, such Contributor by reason
      of your accepting any such warranty or additional liability.

   END OF TERMS AND CONDITIONS

   APPENDIX: How to apply the Apache License to your work.

      To apply the Apache License to your work, attach the following
      boilerplate notice, with the fields enclosed by brackets "[]"
      replaced with your own identifying information. (Don't include
      the brackets!)  The text should be enclosed in the appropriate
      comment syntax for the file format. We also recommend that a
      file or class name and description of purpose be included on the
      same "printed page" as the copyright notice for easier
      identification within third-party archives.

   Copyright 2026 beatzball

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
```

## Litro Starlight and Supernova recipes, @beatzball/create-litro 0.15.5 source (Apache-2.0)

- Source: the Litro repository (https://github.com/beatzball/litro), `packages/create-litro/recipes/starlight/template/`
  and `packages/create-litro/recipes/supernova/template/` at create-litro 0.15.5. Copyright 2026 beatzball. Licensed
  under the Apache License, Version 2.0; the repository's LICENSE is identical to the license text reproduced in the
  section above, which applies to these files too. No NOTICE file is shipped with the recipes.
- Adapted (not copied byte-for-byte), each with a change-notice header comment:
  - `src/components/starlight-{page,header,sidebar,toc}.ts` and the theme head script in `src/route-meta.ts`
    -> `packages/docs/src/shell.ts` and `packages/docs/src/theme.ts` (layout folded into template functions; Litro
    branding, drawer and footer credit removed; catalog-driven sidebar, generated table of contents, previous/next
    links, a light/dark/system control and docs-scoped `--velcro-docs-*` colors added).
  - `pages/index.ts` and `src/components/litro-{hero-nova,feature-row,install-command}.ts` (Supernova)
    -> `packages/docs/pages/index.ts` (rewritten as plain sections; logos, stats, video, terminal windows, status
    line, social links and branding removed; a live showcase of every catalog component added).
- No Shoelace runtime, fonts, images or other recipe assets were copied.
