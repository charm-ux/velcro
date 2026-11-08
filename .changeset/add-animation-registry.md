---
'@charm-ux/velcro': minor
---

Add the `@charm-ux/velcro/utilities/animation-registry` export, the counterpart of Shoelace 2.20.1's `dist/utilities/animation-registry.js`: `setDefaultAnimation`, `setAnimation`, `getAnimation` and the `ElementAnimation`, `ElementAnimationMap` and `GetAnimationOptions` types, with Shoelace's behavior (a custom animation set on an element wins over the default, `rtlKeyframes` are used when the direction is `rtl`, and a missing or `null` animation is an empty one with no duration). It registers no element. Shoelace's internal animation helpers (`animateTo`, which honors reduced motion, `stopAnimations`, `parseDuration`) come with it for the components that animate on show and hide; they are not exported. Adds the third-party notice for the adapted Shoelace (MIT) code.
