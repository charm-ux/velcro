- Also used in: `packages/velcro/src/components/menu/menu.ts` (API documentation wording, the rendered structure: one
  slot carrying the click, keydown, mousedown and slotchange handlers, the `role="menu"` host, the click routing, the
  `sl-select` event and its detail, the keyboard handling (Enter, Space, ArrowDown, ArrowUp, Home and End), the roving
  tabindex and the item helpers, adapted from `src/components/menu/menu.component.ts` and `src/events/sl-select.ts`, and
  the declaration of `dir` and `lang` adapted from `src/internal/shoelace-element.ts`),
  `packages/velcro/src/components/menu/menu.styles.ts` (styles concatenated from `src/styles/component.styles.ts` and
  `src/components/menu/menu.styles.ts`, rules unchanged) and the docs page `packages/docs/pages/components/menu.ts`
  with its examples (wording and examples adapted from `docs/pages/components/menu.md`; the React examples change the
  import lines to Velcro's React wrappers). The menu is built on the `@charm-ux/core` base element, not core's menu.
  Shoelace's `src/components/menu/menu.test.ts` is vendored unchanged for the conformance run (see `tests/upstream/`). No
  Shoelace runtime or source files are included in the package.
