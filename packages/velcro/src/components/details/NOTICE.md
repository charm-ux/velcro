- Also used in: `packages/velcro/src/components/details/details.ts` (API documentation wording, the rendered structure:
  a native `<details>` `base` with a `<summary>` `header` (the `summary` slot or attribute and the `summary-icon` part
  holding the `expand-icon` and `collapse-icon` slots, which fall back to the system library's chevron `<sl-icon>`) and
  a `region` body around the `content` slot, the open and disabled handling, the click and keyboard handling, the
  expand and collapse animations and their registry defaults, and the `sl-show` / `sl-after-show` / `sl-hide` /
  `sl-after-hide` events, adapted from `src/components/details/details.component.ts`; the restore of reflected
  properties' initial values adapted from `src/internal/shoelace-element.ts`; the order of the `@watch` handler from
  `src/internal/watch.ts`), `packages/velcro/src/components/details/details.styles.ts` (styles concatenated from
  `src/styles/component.styles.ts` and `src/components/details/details.styles.ts`, rules unchanged) and the docs page
  and examples `packages/docs/pages/components/details.ts` and `packages/docs/examples/details/*.html` (example markup
  and wording adapted from `docs/pages/components/details.md`) and the React examples
  `packages/docs/examples/details/react/*.jsx` (copied from the same page's React examples; only the import lines are
  changed to Velcro's React wrappers). The details extends the `@charm-ux/core` base element; Shoelace's
  `src/components/details/details.test.ts` is vendored unchanged for the conformance run (see `tests/upstream/`). No
  Shoelace runtime or source files are included in the package.
