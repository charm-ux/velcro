- Also used in: `packages/velcro/src/components/color-picker/color-picker.ts` (API documentation wording, the rendered
  structure: an `<sl-dropdown>` whose trigger is the round `trigger` button and whose panel is the picker, or the picker
  alone when `inline`, with the saturation and brightness grid, the hue and opacity sliders, the copy preview, the
  `<sl-input>` with the format and eye dropper buttons in an `<sl-button-group>`, and the swatches; the `color-picker__*`
  and `color-dropdown__*` class names; the pointer, touch and keyboard handling, the color parsing and formatting, the
  `sl-change`, `sl-input`, `sl-focus`, `sl-blur` and `sl-invalid` events and the validation and form participation API,
  adapted from `src/components/color-picker/color-picker.component.ts`; the `@watch` timing adapted from
  `src/internal/watch.ts`; the `defaultValue` tracking adapted from `src/internal/default-value.ts`; the definition of
  dependencies, the reflected-property restore and the declaration of `dir` and `lang` adapted from
  `src/internal/shoelace-element.ts`), `packages/velcro/src/components/color-picker/color-picker.styles.ts` (styles
  concatenated from `src/styles/component.styles.ts` and `src/components/color-picker/color-picker.styles.ts`, rules
  unchanged), the docs page and examples `packages/docs/pages/components/color-picker.ts` and
  `packages/docs/examples/color-picker/*.html` (example markup and wording adapted from
  `docs/pages/components/color-picker.md`) and the React examples `packages/docs/examples/color-picker/react/*.jsx` (the
  same page's React examples, with the import lines changed to Velcro's React wrappers). The color picker also uses the
  shared `internal/drag.ts`, `internal/form.ts`, `internal/localize.ts` and `internal/math.ts` helpers, which are
  recorded with the other shared helpers above, and Velcro's own color adapter (`internal/color.ts`, which includes no
  Shoelace source). The color picker is built on the `@charm-ux/core` base element
  (core has no color picker); no Shoelace runtime is included. Shoelace's
  `src/components/color-picker/color-picker.test.ts` is vendored unchanged for the conformance run (see `tests/upstream/`).
