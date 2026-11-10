- Also used in: `packages/velcro/src/components/carousel/carousel.ts` (API documentation wording, the rendered structure, the
  slide, clone and scroll-snap handling, the keyboard, mouse-dragging, pagination and navigation logic, the mutation and
  intersection observers and the `sl-slide-change` event, adapted from `src/components/carousel/carousel.component.ts`, and
  the dependency definition adapted from `src/internal/shoelace-element.ts`),
  `packages/velcro/src/components/carousel/autoplay-controller.ts` (adapted from
  `src/components/carousel/autoplay-controller.ts`), `packages/velcro/src/components/carousel/carousel.styles.ts` (styles
  concatenated from `src/styles/component.styles.ts` and `src/components/carousel/carousel.styles.ts`, rules unchanged),
  the docs page and examples `packages/docs/pages/components/carousel.ts` and `packages/docs/examples/carousel/*.html`
  (example markup and wording adapted from `docs/pages/components/carousel.md`; the photographs are replaced by inline
  placeholder images), and the React examples `packages/docs/examples/carousel/react/*.jsx` (copied from the same page's
  React examples; the import lines are changed to Velcro's React wrappers and the corrections listed on the docs page are
  made). The carousel extends the `@charm-ux/core` base element and applies the scrollend polyfill that the tab group keeps
  (adapted from `src/internal/scrollend-polyfill.ts`; see the tab group's notice).
  Shoelace's `src/components/carousel/carousel.test.ts` is vendored unchanged for the conformance run (see
  `tests/upstream/`). No Shoelace runtime or source files are included in the package.
