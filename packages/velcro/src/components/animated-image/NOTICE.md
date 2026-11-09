- Also used in: `packages/velcro/src/components/animated-image/animated-image.ts` (API documentation wording, the
  rendered structure: an animated `img`, once it has loaded a frozen frame drawn on a canvas and a `control-box` part
  with the `play-icon` and `pause-icon` slots whose fallbacks are the system library's `play-fill` and `pause-fill`
  `<sl-icon>`s, the click handling, the restart of the animation when it is played, the `sl-load` and `sl-error` events
  and the public `animatedImage`, `frozenFrame` and `isLoaded` fields, adapted from
  `src/components/animated-image/animated-image.component.ts`; the `@watch` timing adapted from
  `src/internal/watch.ts`; the definition of dependencies, the restore of reflected properties' initial values and the
  declaration of `dir` and `lang` adapted from `src/internal/shoelace-element.ts`),
  `packages/velcro/src/components/animated-image/animated-image.styles.ts` (styles concatenated from
  `src/styles/component.styles.ts` and `src/components/animated-image/animated-image.styles.ts`, rules unchanged), the
  docs page and examples `packages/docs/pages/components/animated-image.ts` and
  `packages/docs/examples/animated-image/*.html` (example markup and wording adapted from
  `docs/pages/components/animated-image.md`; the images are not Shoelace's: they are two small synthetic images written
  for Velcro) and the React examples `packages/docs/examples/animated-image/react/*.jsx` (the same page's React
  examples, with the import lines changed to Velcro's React wrappers). The animated image is built on the
  `@charm-ux/core` base element (core has no animated image); no Shoelace runtime is included. Shoelace's
  `src/components/animated-image/animated-image.test.ts` is vendored unchanged for the conformance run (see
  `tests/upstream/`); the runner serves Velcro's synthetic images in place of Shoelace's `walk.gif` and `tie.webp`.
