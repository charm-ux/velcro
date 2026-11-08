- Also used in: `packages/velcro/src/components/menu-item/menu-item.ts` (API documentation wording, the rendered
  structure: a `base` `<div>` with the `menu-item` / `menu-item--*` class names around the checked icon, the prefix,
  default and suffix slots, the submenu icon, the submenu popup and the loading spinner, the `role`, `aria-checked`,
  `aria-disabled`, `aria-haspopup` and `aria-expanded` handling, the host's click and mouseover handling, the label's
  `slotchange` event, `getTextLabel` and `isSubmenu`, adapted from `src/components/menu-item/menu-item.component.ts`,
  and the restore of reflected properties' initial values and the definition of dependencies adapted from
  `src/internal/shoelace-element.ts`), `packages/velcro/src/components/menu-item/submenu-controller.ts` (the submenu
  controller adapted from `src/components/menu-item/submenu-controller.ts`),
  `packages/velcro/src/components/menu-item/menu-item.styles.ts` (styles concatenated from
  `src/styles/component.styles.ts` and `src/components/menu-item/menu-item.styles.ts`, rules unchanged),
  and the docs page `packages/docs/pages/components/menu-item.ts` with its examples (wording and examples adapted from
  `docs/pages/components/menu-item.md`; the React examples change the import lines to Velcro's React wrappers and drop
  one line, as the page says). Its `getTextContent` helper is the shared one in the slot module, listed above. The menu item is built on the `@charm-ux/core` base element, not core's menu item.
  Shoelace's `src/components/menu-item/menu-item.test.ts` is vendored unchanged for the conformance run (see
  `tests/upstream/`). No Shoelace runtime or source files are included in the package.
