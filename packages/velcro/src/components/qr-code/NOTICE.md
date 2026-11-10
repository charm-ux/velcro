- Also used in: `packages/velcro/src/components/qr-code/qr-code.ts` (API documentation wording, the rendered structure: a
  `base` `<canvas>` with the `qr-code` class, `role="img"`, the label or else the value as its `aria-label` and its size
  as inline width and height; the public `canvas` query and `generate()` method, and the drawing call to qr-creator at
  twice the size with the same options, adapted from `src/components/qr-code/qr-code.component.ts`; the `@watch` timing
  adapted from `src/internal/watch.ts`; the declaration of `dir` and `lang` adapted from
  `src/internal/shoelace-element.ts`), `packages/velcro/src/components/qr-code/qr-code.styles.ts` (styles concatenated
  from `src/styles/component.styles.ts` and `src/components/qr-code/qr-code.styles.ts`, rules unchanged), the docs page
  and examples `packages/docs/pages/components/qr-code.ts` and `packages/docs/examples/qr-code/*.html` (example markup
  and wording adapted from `docs/pages/components/qr-code.md`) and the React examples
  `packages/docs/examples/qr-code/react/*.jsx` (the same page's React examples, with the import lines changed to
  Velcro's React wrappers). The QR code is built on the `@charm-ux/core` base element (core has no QR code); no Shoelace
  runtime is included. The code itself is drawn by the `qr-creator` package (see its section below), as in Shoelace.
  Shoelace's `src/components/qr-code/qr-code.test.ts` is vendored unchanged for the conformance run (see
  `tests/upstream/`).
