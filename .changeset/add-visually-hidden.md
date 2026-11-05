---
'@charm-ux/velcro': minor
---

Add a prototype `VelcroVisuallyHidden`, registered as `sl-visually-hidden` and built on the `@charm-ux/core` base element (core has no visually-hidden component): a default slot whose host is clipped to 1px and hidden from sight, but stays in the accessibility tree and is revealed while something inside has focus. No properties, parts, custom properties or events beyond core's inherited `ready` event. Not implemented or unverified: assistive-technology announcements, the Shoelace docs examples that need `sl-icon`, `sl-card` and `sl-input`, visual parity beyond computed-style checks in Chromium, and a dark theme. Registration is browser-only. Adds the `@charm-ux/velcro/visually-hidden` and `@charm-ux/velcro/visually-hidden/class` exports and updates the third-party notices for adapted Shoelace (MIT) wording, structure and styles.
