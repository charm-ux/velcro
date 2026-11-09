- Also used in: `packages/velcro/src/components/tree/tree.ts` (API documentation wording, the rendered structure: a
  `base` wrapper around the default slot and the two hidden `expand-icon` and `collapse-icon` slots, the `role`,
  `tabindex` and `aria-multiselectable` attributes the tree sets on itself, the selection modes, the click, mouse down and
  keyboard handling (arrows, Home, End, Enter and Space), the roving tabindex, the cloning of the expand and collapse
  icons into each item, the synchronization of the checkboxes for multiple selection, the item helpers and the
  `sl-selection-change` event and its detail, adapted from `src/components/tree/tree.component.ts`; the order of the
  `@watch` handler from `src/internal/watch.ts`), `packages/velcro/src/components/tree/tree.styles.ts` (styles
  concatenated from `src/styles/component.styles.ts` and `src/components/tree/tree.styles.ts`, rules unchanged) and the
  docs page and examples `packages/docs/pages/components/tree.ts` and `packages/docs/examples/tree/*.html` (example markup
  and wording adapted from `docs/pages/components/tree.md`) and the React examples
  `packages/docs/examples/tree/react/*.jsx` (copied from the same page's React examples; the import lines are changed to
  Velcro's React wrappers). The tree is built on the `@charm-ux/core` base element, which has no tree of its own;
  Shoelace's `src/components/tree/tree.test.ts` is vendored unchanged for the conformance run (see `tests/upstream/`).
  No Shoelace runtime or source files are included in the package.
