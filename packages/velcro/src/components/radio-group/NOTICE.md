- Also used in: `packages/velcro/src/components/radio-group/radio-group.ts` (API documentation wording, the rendered
  structure: a `form-control` `<fieldset role="radiogroup">` with the label, a visually hidden error message and
  validation input, the default slot wrapped in an `<sl-button-group>` when it holds radio buttons, and the help text;
  the selection, keyboard, focus and radio synchronisation behavior and the form validation API, adapted from
  `src/components/radio-group/radio-group.component.ts`, with the validity states from `src/internal/form.ts` and the
  restore of reflected properties' initial values from `src/internal/shoelace-element.ts`),
  `packages/velcro/src/components/radio-group/radio-group.styles.ts` (styles concatenated from
  `src/styles/component.styles.ts`, `src/styles/form-control.styles.ts` and
  `src/components/radio-group/radio-group.styles.ts`, rules unchanged), the docs page and examples (examples and wording
  adapted from `docs/pages/components/radio-group.md`) and the React examples (copied from the same page's React
  examples; the import lines are changed to Velcro's React wrappers). The radio group is built on the `@charm-ux/core`
  radio group; no Shoelace runtime or source files are included.
