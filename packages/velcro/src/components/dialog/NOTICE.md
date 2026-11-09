- Also used in: `packages/velcro/src/components/dialog/dialog.ts` (API documentation wording, the rendered structure:
  a fixed `base` wrapper around an `overlay` and a `panel` with `role="dialog"`, an optional `header` with the `title`
  (the `label` slot or attribute), the `header-actions` slot and an `<sl-icon-button>` close button that exports its
  `base` part, a `body` and a `footer`; the open handling, the focus trap and initial focus, the body scroll lock, the
  Escape handling through `CloseWatcher` or a document keydown listener, the cancelable `sl-request-close` with its
  deny-close animation, the `sl-show` / `sl-after-show` / `sl-hide` / `sl-after-hide` / `sl-initial-focus` events and
  the five animations with their registry defaults, adapted from `src/components/dialog/dialog.component.ts`; the
  restore of reflected properties' initial values adapted from `src/internal/shoelace-element.ts`; the order of the
  `@watch` handler from `src/internal/watch.ts`), `packages/velcro/src/components/dialog/dialog.styles.ts` (styles
  concatenated from `src/styles/component.styles.ts` and `src/components/dialog/dialog.styles.ts`, rules unchanged)
  and the docs page and examples `packages/docs/pages/components/dialog.ts` and `packages/docs/examples/dialog/*.html`
  (example markup and wording adapted from `docs/pages/components/dialog.md`) and the React examples
  `packages/docs/examples/dialog/react/*.jsx` (copied from the same page's React examples; only the import lines are
  changed to Velcro's React wrappers). The dialog extends the `@charm-ux/core` base element; the focus trap, the scroll
  lock and their helpers are Velcro's shared ports of Shoelace's internal modules (see the modal entry above).
  Shoelace's `src/components/dialog/dialog.test.ts` is vendored unchanged for the conformance run (see
  `tests/upstream/`). No Shoelace runtime or source files are included in the package.
