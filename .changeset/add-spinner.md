---
'@charm-ux/velcro': minor
---

Add a prototype `VelcroSpinner`, registered as `sl-spinner` on top of the `@charm-ux/core` spinner: an indeterminate `svg` with the `base` part, `role="progressbar"` and an `aria-label` from the localized "loading" term ("Loading" in English), sized by `font-size`, and the `--track-width`, `--track-color`, `--indicator-color` and `--speed` custom properties. Not implemented or unverified: reduced-motion handling (neither Shoelace 2.20.1 nor Velcro changes the animation), visual parity beyond computed-style checks in Chromium, and a dark theme. The inherited core `label`/`label-position` properties and `spinner-*` core parts and properties are present but have no effect. Registration is browser-only. Adds the `@charm-ux/velcro/spinner` export and updates the third-party notices for adapted Shoelace (MIT) wording, structure and styles.
