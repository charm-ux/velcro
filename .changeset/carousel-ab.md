---
'@charm-ux/velcro': patch
---

Carousel docs: two more Shoelace 2.20.1 behaviors are listed under "Upstream quirks matched", each checked against Shoelace's own carousel built from its source in the same fixture and covered by a product test. A go-to that lands before the intersection observer's first report (a click right after the carousel renders) makes the active slide go to the target, back to the first slide, then to the target again. In a looping carousel, a move made after a wrap's scroll has ended, but before the observer has reported the clone it reached, is replaced by the jump to the real slide. The known gaps now say that in Firefox the opening example's initial aria-busy is not pinned: after its frame is reloaded it stays busy, as Shoelace's own carousel does there.
