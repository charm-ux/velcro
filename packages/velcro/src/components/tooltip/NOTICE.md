- Also used in: `packages/velcro/src/components/tooltip/tooltip.ts` (API documentation wording, the rendered structure:
  an `<sl-popup>` `base` whose anchor is the default slot and whose `body` holds the `content` slot, the hover, focus,
  click and manual triggers with the `--show-delay` and `--hide-delay` timing, the `sl-show` / `sl-after-show` /
  `sl-hide` / `sl-after-hide` events, the show and hide animations and their registry defaults, and the Escape handling,
  adapted from `src/components/tooltip/tooltip.component.ts`; the restore of reflected properties' initial values
  adapted from `src/internal/shoelace-element.ts`; the order of the `@watch` handlers from `src/internal/watch.ts`),
  `packages/velcro/src/components/tooltip/tooltip.styles.ts` (styles concatenated from `src/styles/component.styles.ts`
  and `src/components/tooltip/tooltip.styles.ts`, rules unchanged) and the docs page and examples
  `packages/docs/pages/components/tooltip.ts` and `packages/docs/examples/tooltip/*.html` (example markup and wording
  adapted from `docs/pages/components/tooltip.md`) and the React examples `packages/docs/examples/tooltip/react/*.jsx`
  (copied from the same page's React examples; only the import lines are changed to Velcro's React wrappers). The
  tooltip is built on the `@charm-ux/core` tooltip; no Shoelace runtime is included.
