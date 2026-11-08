- Also used in: `packages/velcro/src/components/icon-button/icon-button.ts` (API documentation wording, the rendered
  structure: a `base` part that is a `<button>`, or an `<a>` when `href` is set, with the `icon-button` /
  `icon-button--*` class names around an `<sl-icon>`, the link and ARIA attributes, the `sl-focus` and `sl-blur`
  events and the `click()`, `focus()` and `blur()` methods, adapted from `src/components/icon-button/icon-button.component.ts`,
  and the restore of reflected properties' initial values adapted from `src/internal/shoelace-element.ts`),
  `packages/velcro/src/components/icon-button/icon-button.styles.ts` (styles concatenated from
  `src/styles/component.styles.ts` and `src/components/icon-button/icon-button.styles.ts`, rules unchanged), the docs page
  and examples `packages/docs/pages/components/icon-button.ts` and `packages/docs/examples/icon-button/*.html` (example
  markup and wording adapted from `docs/pages/components/icon-button.md`) and the React examples
  `packages/docs/examples/icon-button/react/*.jsx` (copied from the same page's React examples; the import lines are
  changed to Velcro's React wrapper). The icon button is built on the `@charm-ux/core` base element, which has no icon
  button of its own; no Shoelace runtime or source files are included.
