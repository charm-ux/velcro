- Also used in: `packages/velcro/src/components/copy-button/copy-button.ts` (API documentation wording, the rendered
  structure: an `<sl-tooltip>` around a `<button part="button">` holding the `copy-icon`, `success-icon` and
  `error-icon` slots with their default `<sl-icon>` fallbacks and the tooltip's exported parts, the `from` lookup of an
  element's text content, attribute or property, the Clipboard API call, the `sl-copy` and `sl-error` events and the
  feedback animations with their registry defaults, adapted from
  `src/components/copy-button/copy-button.component.ts`; the restore of reflected properties' initial values adapted
  from `src/internal/shoelace-element.ts`), `packages/velcro/src/components/copy-button/copy-button.styles.ts` (styles
  concatenated from `src/styles/component.styles.ts` and `src/components/copy-button/copy-button.styles.ts`, rules
  unchanged), the docs page and examples `packages/docs/pages/components/copy-button.ts` and
  `packages/docs/examples/copy-button/*.html` (example markup and wording adapted from
  `docs/pages/components/copy-button.md`) and the React examples `packages/docs/examples/copy-button/react/*.jsx`
  (copied from the same page's React examples; the import lines are changed to Velcro's React wrappers, the
  hyphenated attribute names are the wrapper's property names, and the `sl-input` example has the value its HTML
  example has). In both the HTML and the React examples the opening and feedback-duration examples say "Velcro
  rocks!" where Shoelace's say "Shoelace rocks!", and the "from" example's link points at example.com with the text
  "Example Website" instead of Shoelace's website; the opening HTML example also has an id (`demo-default`). The copy button is built on the `@charm-ux/core` base element, which has no copy button of its own;
  no Shoelace runtime or source files are included.
