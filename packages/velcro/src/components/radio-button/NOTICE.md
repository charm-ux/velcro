- Also used in: `packages/velcro/src/components/radio-button/radio-button.ts` (API documentation wording, the rendered
  structure: a `base` wrapper around a `role="radio"` `<button>` with the `prefix`, `label` and `suffix` slots and the
  `button` / `button--checked` parts, the click and focus behavior and the host's `role` and `aria-disabled`, adapted
  from `src/components/radio-button/radio-button.component.ts`, with the restore of reflected properties' initial values
  from `src/internal/shoelace-element.ts`), `packages/velcro/src/components/radio-button/radio-button.styles.ts` (styles
  concatenated from `src/styles/component.styles.ts`, Velcro's adapted button styles and
  `src/components/radio-button/radio-button.styles.ts`, rules unchanged), the docs page and examples (examples and
  wording adapted from `docs/pages/components/radio-button.md`) and the React examples (copied from the same page's
  React examples; the import lines are changed to Velcro's React wrappers, with the fixes listed on the docs page).
  There is no core radio button, so it is built on the `@charm-ux/core` base element; no Shoelace runtime or source
  files are included.
