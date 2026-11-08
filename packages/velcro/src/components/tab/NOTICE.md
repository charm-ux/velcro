- Also used in: `packages/velcro/src/components/tab/tab.ts` (API documentation wording, the rendered structure: a `base`
  `<div>` with the `tab` / `tab--*` class names around the default slot and, when `closable`, an `<sl-icon-button>` close
  button that exports its `base` part, the close button's `x-lg` system icon and localized `close` label, the generated
  `sl-tab-<n>` id, the `role`, `aria-selected`, `aria-disabled` and `tabindex` handling and the `sl-close` event, adapted
  from `src/components/tab/tab.component.ts`, and the restore of reflected properties' initial values adapted from
  `src/internal/shoelace-element.ts`), `packages/velcro/src/components/tab/tab.styles.ts` (styles concatenated from
  `src/styles/component.styles.ts` and `src/components/tab/tab.styles.ts`, rules unchanged) and the docs page
  `packages/docs/pages/components/tab.ts` (wording adapted from `docs/pages/components/tab.md`). The tab extends the
  `@charm-ux/core` tab. Shoelace's `src/components/tab/tab.test.ts` is vendored unchanged for the conformance run (see
  `tests/upstream/`). No Shoelace runtime or source files are included in the package.
