- Also used in: `packages/velcro/src/components/option/option.ts` (API documentation wording, the rendered structure: a
  `base` `<div>` with the `option` / `option--*` class names around the `check` system `<sl-icon>` (`checked-icon` part)
  and the `prefix`, label and `suffix` slots, the `role`, `aria-selected` and `aria-disabled` attributes the option sets
  on itself, the value normalization with its console error, the label change notification to the containing select
  and `getTextLabel()`, adapted from `src/components/option/option.component.ts`; the restore of reflected properties'
  initial values adapted from `src/internal/shoelace-element.ts`), `packages/velcro/src/components/option/option.styles.ts`
  (styles concatenated from `src/styles/component.styles.ts` and `src/components/option/option.styles.ts`, rules
  unchanged), the docs page and examples `packages/docs/pages/components/option.ts` and
  `packages/docs/examples/option/*.html` (example markup and wording adapted from `docs/pages/components/option.md`) and
  the React examples `packages/docs/examples/option/react/*.jsx` (copied from the same page's React examples; the import
  lines are changed to Velcro's React wrappers). The opening HTML example's select also has an id (`demo-default`). The option is
  built on the `@charm-ux/core` base element, which has no option of its own; no Shoelace runtime or source files are
  included.
