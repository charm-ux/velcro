---
'@charm-ux/velcro': patch
---

Parse and format the colors of `sl-color-picker` with `@ctrl/tinycolor` 4.1.0, the library Shoelace 2.20.1 uses, instead of Velcro's own implementation, and add it as an exact-pinned runtime dependency of `@charm-ux/velcro` (MIT; its notice is added to the third-party notices). The internal color module (`internal/color.ts`) now re-exports `TinyColor` from the library and keeps the same exports, so the color picker's code is unchanged. CSS color names, `transparent` and the `rgb[a]`, `hsl[a]`, `hsv[a]` and hex syntaxes are now read by Shoelace's own parser. One accepted input changes: a name the browser's canvas parser knows but TinyColor does not (a CSS system color such as `canvas`, or `currentcolor`) is no longer parsed, as in Shoelace; it is treated like any other unparsable value.
