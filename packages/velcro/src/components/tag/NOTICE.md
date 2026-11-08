- Also used in: `packages/velcro/src/components/tag/tag.ts` (API documentation wording, the rendered structure: a `base`
  `<span>` with the `tag` / `tag--*` class names around a `content` slot and, when `removable`, an `<sl-icon-button>` remove
  button that exports its `base` part, the remove button's `x-lg` system icon and localized `remove` label, and the
  `sl-remove` event, adapted from `src/components/tag/tag.component.ts`, and the restore of reflected properties' initial
  values adapted from `src/internal/shoelace-element.ts`), `packages/velcro/src/components/tag/tag.styles.ts` (styles
  concatenated from `src/styles/component.styles.ts` and `src/components/tag/tag.styles.ts`, rules unchanged), the docs
  page and examples `packages/docs/pages/components/tag.ts` and `packages/docs/examples/tag/*.html` (example markup and
  wording adapted from `docs/pages/components/tag.md`) and the React examples `packages/docs/examples/tag/react/*.jsx`
  (copied from the same page's React examples; the import lines are changed to Velcro's React wrapper). The tag is built
  on the `@charm-ux/core` base element, which has no tag of its own; no Shoelace runtime or source files are included.
