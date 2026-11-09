- Also used in: `packages/velcro/src/components/breadcrumb/breadcrumb.ts` (API documentation wording, the rendered
  structure: a `base` `<nav>` with the `breadcrumb` class around the default slot and a hidden, `aria-hidden` wrapper
  around the `separator` slot whose fallback is a system chevron `<sl-icon>`; the separator cloning into each item's
  `separator` slot, `aria-current="page"` on the last item and the regeneration of the default separators when the
  direction changes, adapted from `src/components/breadcrumb/breadcrumb.component.ts`; the definition of dependencies and
  the declaration of `dir` and `lang` adapted from `src/internal/shoelace-element.ts`),
  `packages/velcro/src/components/breadcrumb/breadcrumb.styles.ts` (styles concatenated from
  `src/styles/component.styles.ts` and `src/components/breadcrumb/breadcrumb.styles.ts`, rules unchanged), the docs page
  and examples `packages/docs/pages/components/breadcrumb.ts` and `packages/docs/examples/breadcrumb/*.html` (example
  markup and wording adapted from `docs/pages/components/breadcrumb.md`) and the React examples
  `packages/docs/examples/breadcrumb/react/*.jsx` (the same page's React examples, with the import lines changed to
  Velcro's React wrappers). The breadcrumb also uses the shared `internal/localize.ts` helpers, which are recorded with
  the other shared helpers above. The breadcrumb is built on the `@charm-ux/core` base element, not core's breadcrumb; no
  Shoelace runtime is included. Shoelace's `src/components/breadcrumb/breadcrumb.test.ts` is vendored unchanged for the
  conformance run (see `tests/upstream/`).
