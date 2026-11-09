- Also used in: `packages/velcro/src/components/select/select.ts` (API documentation wording, the rendered structure: the
  `form-control` wrapper around the label, an `<sl-popup>` whose anchor is the `combobox` box holding the prefix slot,
  the read-only `display-input`, the `tags` with their `<sl-tag>` parts, the hidden value input, the `clear-button`, the
  suffix slot and the `expand-icon`, and whose panel is the `listbox` around the options, and the help text; the
  `sl-change`, `sl-clear`, `sl-input`, `sl-focus`, `sl-blur`, `sl-show`, `sl-after-show`, `sl-hide`, `sl-after-hide`
  and `sl-invalid` events, the `select.show` and `select.hide` animations with their registry defaults, the keyboard,
  pointer and type to select handling, the value and `defaultValue` handling, the validation and form participation API
  and `getTag`, adapted from `src/components/select/select.component.ts`; the restore of reflected properties' initial
  values adapted from `src/internal/shoelace-element.ts`), `packages/velcro/src/components/select/select.styles.ts`
  (styles concatenated from `src/styles/component.styles.ts`, `src/styles/form-control.styles.ts` and
  `src/components/select/select.styles.ts`, rules unchanged), the docs page and examples
  `packages/docs/pages/components/select.ts` and `packages/docs/examples/select/*.html` (example markup and wording
  adapted from `docs/pages/components/select.md`) and the React examples `packages/docs/examples/select/react/*.jsx`
  (copied from the same page's React examples; the import lines are changed to Velcro's React wrappers, and the Placement example's closing tag, `</SlDropdown>` in Shoelace's,
  is `</SlSelect>`). The opening
  HTML example also has an id (`demo-default`). The select is built on the `@charm-ux/core` select, whose native
  `<select>` template it replaces; no Shoelace runtime or source files are included.
