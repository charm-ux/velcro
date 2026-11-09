- Also used in: `packages/velcro/src/components/rating/rating.ts` (API documentation wording, the rendered structure: a
  `base` element with `role="slider"`, the label as `aria-label`, `aria-valuenow` / `aria-valuemin` / `aria-valuemax`,
  the `rating` / `rating--*` class names and a row of `rating__symbol` spans whose partial symbol is drawn as two
  clipped layers; the pointer, touch and keyboard handling, the precision rounding, the `sl-change` and `sl-hover`
  events and `focus()` / `blur()`, adapted from `src/components/rating/rating.component.ts`; the `@watch` timing adapted
  from `src/internal/watch.ts`; the definition of dependencies and the declaration of `dir` and `lang` adapted from
  `src/internal/shoelace-element.ts`), `packages/velcro/src/components/rating/rating.styles.ts` (styles concatenated
  from `src/styles/component.styles.ts` and `src/components/rating/rating.styles.ts`, rules unchanged), the docs page
  and examples `packages/docs/pages/components/rating.ts` and `packages/docs/examples/rating/*.html` (example markup and
  wording adapted from `docs/pages/components/rating.md`) and the React examples `packages/docs/examples/rating/react/*.jsx`
  (the same page's React examples, with the import lines changed to Velcro's React wrappers). The rating also uses the
  shared `internal/localize.ts` and `internal/math.ts` helpers, which are recorded with the other shared helpers above.
  The rating is built on the `@charm-ux/core` base element (core has no rating); no Shoelace runtime is included.
  Shoelace's `src/components/rating/rating.test.ts` is vendored unchanged for the conformance run (see `tests/upstream/`).
