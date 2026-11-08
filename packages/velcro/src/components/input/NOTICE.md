- Also used in: `packages/velcro/src/components/input/input.ts` (API documentation wording, the rendered structure: a
  `form-control` wrapper around the label, a `base` box holding the `prefix`, the native `<input>`, the clear and
  password toggle buttons (each with an `<sl-icon>` from the `system` library) and the `suffix`, and the help text, the
  events, the keyboard behavior, the in-memory `valueAsDate` and `valueAsNumber` conversions, the selection, step and
  picker methods, and the validation and form participation API, adapted from `src/components/input/input.component.ts`,
  with the `defaultValue()` rule from `src/internal/default-value.ts`, the `@watch` handlers from `src/internal/watch.ts`
  and the restore of reflected properties' initial values from `src/internal/shoelace-element.ts`),
  `packages/velcro/src/components/input/input.styles.ts` (styles concatenated from `src/styles/component.styles.ts`,
  `src/styles/form-control.styles.ts` and `src/components/input/input.styles.ts`, rules unchanged) and the docs page and
  examples `packages/docs/pages/components/input.ts`, `packages/docs/examples/input/*.html` and
  `packages/docs/examples/input/react/*.jsx` (example markup, React snippets and wording adapted from
  `docs/pages/components/input.md`; the React import lines are changed to Velcro's React wrappers).
  The input is built on the `@charm-ux/core` input; no Shoelace runtime or source files are included. Shoelace's own
  `input.test.ts` is vendored unmodified under `tests/upstream/shoelace-2.20.1/` (see `docs/conformance.md`).
