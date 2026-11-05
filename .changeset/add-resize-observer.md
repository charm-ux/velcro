---
'@charm-ux/velcro': minor
---

Add a prototype `VelcroResizeObserver`, registered as `sl-resize-observer` and built on the `@charm-ux/core` base element (core has no resize-observer component): a `display: contents` host with a default slot that observes the slotted elements with a `ResizeObserver` and emits the bubbling, composed `sl-resize` event with `detail.entries`, and a reflected `disabled` property that stops and restarts observation. Also dispatches core's inherited non-bubbling `ready` event, which Shoelace does not. Not implemented or unverified: the Shoelace React example, assistive-technology behavior (the element has no role), visual parity beyond computed-style checks in Chromium, and a dark theme. Registration is browser-only. Adds the `@charm-ux/velcro/resize-observer` and `@charm-ux/velcro/resize-observer/class` exports, the `--sl-input-border-color` light theme token, and updates the third-party notices for adapted Shoelace (MIT) wording, behavior and styles.
