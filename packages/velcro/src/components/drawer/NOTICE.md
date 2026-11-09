- Also used in: `packages/velcro/src/components/drawer/drawer.ts` (API documentation wording, the rendered structure:
  a `base` wrapper (fixed, or absolute when `contained`) around an `overlay` and a `panel` with `role="dialog"`, an
  optional `header` with the `title` (the `label` slot or attribute), the `header-actions` slot and an
  `<sl-icon-button>` close button that exports its `base` part, a `body` slot and a `footer`; the `placement` and
  `contained` handling, the open handling, the focus trap and initial focus, the body scroll lock, the Escape handling
  through `CloseWatcher` or a document keydown listener, the cancelable `sl-request-close` with its deny-close
  animation, the `sl-show` / `sl-after-show` / `sl-hide` / `sl-after-hide` / `sl-initial-focus` events and the eleven
  animations with their registry defaults, adapted from `src/components/drawer/drawer.component.ts`; the
  `uppercaseFirstLetter` helper from `src/internal/string.ts`; the restore of reflected properties' initial values
  adapted from `src/internal/shoelace-element.ts`; the order of the `@watch` handlers from `src/internal/watch.ts`),
  `packages/velcro/src/components/drawer/drawer.styles.ts` (styles concatenated from `src/styles/component.styles.ts`
  and `src/components/drawer/drawer.styles.ts`, rules unchanged) and the docs page and examples
  `packages/docs/pages/components/drawer.ts` and `packages/docs/examples/drawer/*.html` (example markup and wording
  adapted from `docs/pages/components/drawer.md`) and the React examples `packages/docs/examples/drawer/react/*.jsx`
  (copied from the same page's React examples; only the import lines are changed to Velcro's React wrappers). The
  drawer extends the `@charm-ux/core` base element; the focus trap, the scroll lock and their helpers are Velcro's shared
  ports of Shoelace's internal modules (see the modal entry above). Shoelace's `src/components/drawer/drawer.test.ts` is
  vendored unchanged for the conformance run (see `tests/upstream/`). No Shoelace runtime or source files are included
  in the package.
