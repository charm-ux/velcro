---
'@charm-ux/velcro': minor
---

Add a prototype `VelcroProgressRing`, registered as `sl-progress-ring` directly on the `@charm-ux/core` base element (core has no progress ring): an SVG ring in a `base` part with `role="progressbar"`, `aria-valuemin`/`aria-valuemax`/`aria-valuenow`, a default slot in the `label` part, the reflected `value` property, the `label` property, and the `--size`, `--track-width`, `--track-color`, `--indicator-width`, `--indicator-color` and `--indicator-transition-duration` custom properties. Not implemented or unverified: reduced-motion handling, the React examples, `sl-icon` in the values example, Firefox/WebKit behavior and a dark theme. Registration is browser-only. Adds the `@charm-ux/velcro/progress-ring` and `@charm-ux/velcro/progress-ring/class` exports and updates the third-party notices for adapted Shoelace (MIT) wording, structure and styles.
