- Also used in: `packages/velcro/src/components/alert/alert.ts` (API documentation wording, the rendered structure: a
  `base` `<div role="alert">` with the `alert` / `alert--*` class names around the `icon` and `message` parts, an
  optional `<sl-icon-button>` close button that exports its `base` part, the hidden timer and the optional countdown
  bar; the auto-hide timer, the countdown animation, the toast stack, the `sl-show` / `sl-after-show` / `sl-hide` /
  `sl-after-hide` events and the show and hide animations with their registry defaults, adapted from
  `src/components/alert/alert.component.ts`; the restore of reflected properties' initial values adapted from
  `src/internal/shoelace-element.ts`; the order of the `@watch` handlers from `src/internal/watch.ts`; and
  `blurActiveElement`, copied from `src/internal/closeActiveElement.ts`),
  `packages/velcro/src/components/alert/alert.styles.ts` (styles concatenated from `src/styles/component.styles.ts`
  and `src/components/alert/alert.styles.ts`, rules unchanged), the docs page and examples
  `packages/docs/pages/components/alert.ts` and `packages/docs/examples/alert/*.html` (example markup and wording
  adapted from `docs/pages/components/alert.md`) and the React examples `packages/docs/examples/alert/react/*.jsx`
  (copied from the same page's React examples; only the import lines are changed to Velcro's React wrappers). The alert is built on the `@charm-ux/core` alert; no Shoelace runtime is
  included.
