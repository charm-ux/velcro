---
'@charm-ux/velcro': minor
---

Add a prototype `VelcroButton`, registered as `sl-button` on top of the `@charm-ux/core` button: `variant`, `size`, `caret`, `loading`, `outline`, `pill`, `circle`, `disabled`, the `prefix` and `suffix` slots, the `base`, `prefix`, `label`, `suffix`, `caret` and `spinner` parts, `sl-focus` and `sl-blur` events, and a light theme (`@charm-ux/velcro/themes/light.css`). Not implemented or unverified: `download` (the core button never applies it), form attributes and validity, correct `submit`/`reset` behavior and `name`/`value` submission, a dark theme and full Shoelace parity. Registration is browser-only and sets the page-wide core prefix to `sl`, so it cannot share a page with other Charm components. Includes third-party notices for adapted Shoelace (MIT) documentation wording and tokens.
