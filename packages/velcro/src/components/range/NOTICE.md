- Also used in: `packages/velcro/src/components/range/range.ts` (API documentation wording, the rendered structure: a
  `form-control` wrapper around the label, a `base` box holding the native `<input type="range">` and the tooltip
  `<output>`, and the help text; the `range` / `range--*` class names, the progress and tooltip placement
  calculations, the events, the validation and form participation API and `stepUp()` / `stepDown()`, adapted from
  `src/components/range/range.component.ts`, with the `defaultValue()` rule from `src/internal/default-value.ts`, the
  `@watch` timing from `src/internal/watch.ts` and the declaration of `dir` and `lang` and the restore of reflected
  properties' initial values from `src/internal/shoelace-element.ts`), `packages/velcro/src/components/range/range.styles.ts`
  (styles concatenated from `src/styles/component.styles.ts`, `src/styles/form-control.styles.ts` and
  `src/components/range/range.styles.ts`, rules unchanged), the docs page and examples
  `packages/docs/pages/components/range.ts`, `packages/docs/examples/range/*.html` (example markup and wording adapted
  from `docs/pages/components/range.md`) and the React examples `packages/docs/examples/range/react/*.jsx` (the same
  page's React examples, with the import lines changed to Velcro's React wrappers). The range is built on the
  `@charm-ux/core` base element (core has no range); no Shoelace runtime is included. Shoelace's
  `src/components/range/range.test.ts` is vendored unchanged for the conformance run (see `tests/upstream/`).
