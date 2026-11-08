- Also used in: `packages/velcro/src/components/avatar/avatar.ts` (API documentation wording, the rendered structure:
  a `base` part with `role="img"` and the label as `aria-label`, `avatar` / `avatar--*` class names around an `image`,
  `initials` or `icon` part whose `icon` slot falls back to the system library's `person-fill` `<sl-icon>`, and the
  image error state with the `sl-error` event, adapted from `src/components/avatar/avatar.component.ts`, and the
  restore of reflected properties' initial values adapted from `src/internal/shoelace-element.ts`),
  `packages/velcro/src/components/avatar/avatar.styles.ts` (styles concatenated from `src/styles/component.styles.ts`
  and `src/components/avatar/avatar.styles.ts`, rules unchanged), the docs page and examples
  `packages/docs/pages/components/avatar.ts` and `packages/docs/examples/avatar/*.html` (example markup and wording
  adapted from `docs/pages/components/avatar.md`) and the React examples `packages/docs/examples/avatar/react/*.jsx`
  (copied from the same page's React examples; the import lines are changed to Velcro's React wrappers). The avatar is
  built on the `@charm-ux/core` avatar; no Shoelace runtime or source files are included.
