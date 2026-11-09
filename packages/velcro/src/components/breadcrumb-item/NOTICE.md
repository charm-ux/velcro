- Also used in: `packages/velcro/src/components/breadcrumb-item/breadcrumb-item.ts` (API documentation wording, the
  rendered structure: a `base` `<div>` with the `breadcrumb-item` / `breadcrumb-item--has-*` class names around the
  `prefix` container, a `label` that is a `<button>`, an `<a>` or a `<div>`, the `suffix` container and the `aria-hidden`
  `separator` container; the choice of the label element, the link's `href`, `target` and `rel` attributes,
  `hrefChanged` and `handleSlotChange`, adapted from `src/components/breadcrumb-item/breadcrumb-item.component.ts`; the
  declaration of `dir` and `lang` adapted from `src/internal/shoelace-element.ts`; and the timing of the `@watch`
  handler from `src/internal/watch.ts`), `packages/velcro/src/components/breadcrumb-item/breadcrumb-item.styles.ts`
  (styles concatenated from `src/styles/component.styles.ts` and
  `src/components/breadcrumb-item/breadcrumb-item.styles.ts`, rules unchanged), the docs page and example
  `packages/docs/pages/components/breadcrumb-item.ts` and `packages/docs/examples/breadcrumb-item/*.html` (example markup
  and wording adapted from `docs/pages/components/breadcrumb-item.md`) and the React example
  `packages/docs/examples/breadcrumb-item/react/*.jsx` (the same page's React example, with the import lines changed to
  Velcro's React wrappers). Its `HasSlotController` is the shared one in the slot module, recorded above. The breadcrumb
  item is built on the `@charm-ux/core` base element, not core's breadcrumb item; no Shoelace runtime is included.
  Shoelace's `src/components/breadcrumb-item/breadcrumb-item.test.ts` is vendored unchanged for the conformance run (see
  `tests/upstream/`).
