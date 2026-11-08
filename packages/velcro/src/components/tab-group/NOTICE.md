- Also used in: `packages/velcro/src/components/tab-group/tab-group.ts` (API documentation wording, the rendered
  structure, the tab and panel syncing, the keyboard handling, the activation, placement, indicator and scroll-control
  logic, the mutation, resize and intersection observers and the `sl-tab-show` / `sl-tab-hide` events, adapted from
  `src/components/tab-group/tab-group.component.ts`, and the restore of reflected properties' initial values adapted from
  `src/internal/shoelace-element.ts`), `packages/velcro/src/components/tab-group/tab-group.styles.ts` (styles
  concatenated from `src/styles/component.styles.ts` and `src/components/tab-group/tab-group.styles.ts`, rules
  unchanged), `packages/velcro/src/components/tab-group/scroll.ts` (the `scrollIntoView` and `getOffset` helpers, adapted
  from `src/internal/scroll.ts` and `src/internal/offset.ts`), `packages/velcro/src/components/tab-group/scrollend-polyfill.ts`
  (adapted from `src/internal/scrollend-polyfill.ts`), the docs page and examples
  `packages/docs/pages/components/tab-group.ts` and `packages/docs/examples/tab-group/*.html` (example markup and wording
  adapted from `docs/pages/components/tab-group.md`), the React examples `packages/docs/examples/tab-group/react/*.jsx`
  (copied from the same page's React examples; the import lines are changed to Velcro's React wrappers), and the tab
  panel overview example `packages/docs/examples/tab-panel/basic.html` (adapted from `docs/pages/components/tab-panel.md`).
  The tab group extends the `@charm-ux/core` base element. Shoelace's `src/components/tab-group/tab-group.test.ts` and the
  two helpers it adds (`src/internal/test/element-visible-overflow.ts`, `src/internal/test/wait-for-scrolling.ts`) are
  vendored unchanged for the conformance run (see `tests/upstream/`). No Shoelace runtime or source files are included in
  the package.
