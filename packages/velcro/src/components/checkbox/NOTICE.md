- Also used in: `packages/velcro/src/components/checkbox/checkbox.ts` (API documentation wording, the rendered
  structure: a `form-control` wrapper around a `base` `<label>` holding a hidden native checkbox, the `control` square
  with its `checked-icon` or `indeterminate-icon` `<sl-icon>` and the `label` part, then the help text, the events, and
  the validation and form participation API, adapted from `src/components/checkbox/checkbox.component.ts`, with the
  `defaultValue('checked')` rule from `src/internal/default-value.ts`, the `@watch` handlers from
  `src/internal/watch.ts` and the restore of reflected properties' initial values from
  `src/internal/shoelace-element.ts`), `packages/velcro/src/components/checkbox/checkbox.styles.ts` (styles
  concatenated from `src/styles/component.styles.ts`, `src/styles/form-control.styles.ts` and
  `src/components/checkbox/checkbox.styles.ts`, rules unchanged) and the docs page and examples
  `packages/docs/pages/components/checkbox.ts`, `packages/docs/examples/checkbox/*.html` and
  `packages/docs/examples/checkbox/react/*.jsx` (example markup, React snippets and wording adapted from
  `docs/pages/components/checkbox.md`; the React import lines are changed to Velcro's React wrappers). The checkbox is
  built on the `@charm-ux/core` checkbox; no Shoelace runtime or source files are included. Shoelace's own
  `checkbox.test.ts` is vendored unmodified under `tests/upstream/shoelace-2.20.1/` (see `docs/conformance.md`).
