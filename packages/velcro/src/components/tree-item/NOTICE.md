- Also used in: `packages/velcro/src/components/tree-item/tree-item.ts` (API documentation wording, the rendered structure:
  a `base` wrapper around an item row (`item` part with its state parts) holding the indentation, the expand button with
  its `spinner` and the `expand-icon` and `collapse-icon` slots (which fall back to the system library's chevron
  `<sl-icon>`), the multiple-selection `<sl-checkbox>` with its exported parts and the label, and a `children` group
  around the nested items, the `role`, `tabindex` and `aria-*` attributes the item sets on itself, the loading,
  selection, expansion and lazy handling, the expand and collapse animations and their registry defaults, and the
  `sl-expand` / `sl-after-expand` / `sl-collapse` / `sl-after-collapse` / `sl-lazy-change` / `sl-lazy-load` events,
  adapted from `src/components/tree-item/tree-item.component.ts`; the order of the `@watch` handlers from
  `src/internal/watch.ts`), `packages/velcro/src/components/tree-item/tree-item.styles.ts` (styles concatenated from
  `src/styles/component.styles.ts` and `src/components/tree-item/tree-item.styles.ts`, rules unchanged) and the docs
  page and examples `packages/docs/pages/components/tree-item.ts` and `packages/docs/examples/tree-item/*.html` (example
  markup and wording adapted from `docs/pages/components/tree-item.md`) and the React examples
  `packages/docs/examples/tree-item/react/*.jsx` (copied from the same page's React examples; only the import lines are
  changed to Velcro's React wrappers). The tree item extends the `@charm-ux/core` base element, which has no tree item
  of its own; Shoelace's `src/components/tree-item/tree-item.test.ts` is vendored unchanged for the conformance run (see
  `tests/upstream/`). No Shoelace runtime or source files are included in the package.
