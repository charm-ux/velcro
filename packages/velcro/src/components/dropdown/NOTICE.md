- Also used in: `packages/velcro/src/components/dropdown/dropdown.ts` (API documentation wording, the rendered structure:
  an `<sl-popup part="base">` around the `trigger` slot and an `aria-hidden` panel wrapper around the default slot; the
  open and close handling with the `sl-show` / `sl-after-show` / `sl-hide` / `sl-after-hide` events and the
  `dropdown.show` and `dropdown.hide` animations with their registry defaults, the trigger's keyboard handling, the
  document listeners that close the panel, the accessible-trigger bookkeeping, the focus handling and the public
  methods, adapted from `src/components/dropdown/dropdown.component.ts`; the restore of reflected properties' initial
  values and the declaration of `dir` and `lang` adapted from `src/internal/shoelace-element.ts`; and the order of the
  `@watch` handler from `src/internal/watch.ts`),
  `packages/velcro/src/components/dropdown/dropdown.styles.ts` (styles concatenated from
  `src/styles/component.styles.ts` and `src/components/dropdown/dropdown.styles.ts`, rules unchanged), the docs page and
  examples `packages/docs/pages/components/dropdown.ts` and `packages/docs/examples/dropdown/*.html` (example markup and
  wording adapted from `docs/pages/components/dropdown.md`) and the React examples
  `packages/docs/examples/dropdown/react/*.jsx` (the same page's React examples, with the import lines changed to
  Velcro's React wrappers and two further adaptations: `hoisting.jsx` adds `position: relative` to its class, as the
  page's HTML example has; `submenus.jsx` drops the unused `css` constant and the fragment that the page's snippet
  carries and passes `style={{ maxWidth: '200px' }}` where the snippet has the string `style="max-width: 200px;"`,
  which React rejects). The dropdown also uses the shared `internal/tabbable.ts` and
  `internal/active-elements.ts` helpers, which are recorded with the other shared helpers above. The dropdown is built on
  the `@charm-ux/core` base element; no Shoelace runtime is included. Shoelace's `src/components/dropdown/dropdown.test.ts`
  is vendored unchanged for the conformance run (see `tests/upstream/`).
