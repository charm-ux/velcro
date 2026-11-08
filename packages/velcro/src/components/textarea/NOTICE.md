- Also used in: `packages/velcro/src/components/textarea/textarea.ts` (API documentation wording, the rendered
  structure: a `form-control` wrapper around the label, a `base` box holding the native `<textarea>` and the size
  adjuster, and the help text, the events, the validation and form participation API, the auto-resize logic and the
  selection methods, adapted from `src/components/textarea/textarea.component.ts`, with the `defaultValue()` rule from
  `src/internal/default-value.ts`, the `@watch` handlers from `src/internal/watch.ts` and the restore of reflected
  properties' initial values from `src/internal/shoelace-element.ts`),
  `packages/velcro/src/components/textarea/textarea.styles.ts` (styles concatenated from
  `src/styles/component.styles.ts`, `src/styles/form-control.styles.ts` and
  `src/components/textarea/textarea.styles.ts`, rules unchanged) and the docs page and examples
  `packages/docs/pages/components/textarea.ts`, `packages/docs/examples/textarea/*.html` and `packages/docs/examples/textarea/react/*.jsx` (example markup, React
  snippets and wording adapted from `docs/pages/components/textarea.md`). The textarea is built on the `@charm-ux/core`
  text area; no Shoelace runtime or source files are included. Shoelace's own `textarea.test.ts` is vendored
  unmodified under `tests/upstream/shoelace-2.20.1/` (see `docs/conformance.md`).
