- Also used in: `packages/velcro/src/components/image-comparer/image-comparer.ts` (API documentation wording, the
  rendered structure: a `base` element with the `image-comparer` / `image-comparer--rtl` class names around the `before`
  and `after` containers, the `after` container clipped to the position, and a `divider` holding a `role="scrollbar"`
  `handle` with `aria-valuenow` / `aria-valuemin` / `aria-valuemax` / `aria-controls` and a default `grip-vertical`
  system icon; the drag, keyboard and right-to-left handling, the `sl-change` event and the public `base` / `handle`
  queries, adapted from `src/components/image-comparer/image-comparer.component.ts`; the `@watch` timing adapted from
  `src/internal/watch.ts`; the definition of dependencies and the declaration of `dir` and `lang` adapted from
  `src/internal/shoelace-element.ts`), `packages/velcro/src/components/image-comparer/image-comparer.styles.ts` (styles
  concatenated from `src/styles/component.styles.ts` and `src/components/image-comparer/image-comparer.styles.ts`, rules
  unchanged), the docs page and examples `packages/docs/pages/components/image-comparer.ts` and
  `packages/docs/examples/image-comparer/*.html` (example markup and wording adapted from
  `docs/pages/components/image-comparer.md`) and the React examples `packages/docs/examples/image-comparer/react/*.jsx`
  (the same page's React examples, with the import lines changed to Velcro's React wrappers). The image comparer also
  uses the shared `internal/drag.ts`, `internal/localize.ts` and `internal/math.ts` helpers, which are recorded with the
  other shared helpers above. The image comparer is built on the `@charm-ux/core` base element (core has no image
  comparer); no Shoelace runtime is included. Shoelace's `src/components/image-comparer/image-comparer.test.ts` is
  vendored unchanged for the conformance run (see `tests/upstream/`).
