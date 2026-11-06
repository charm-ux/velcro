---
'@charm-ux/velcro': patch
---

Close the last upstream conformance failures. `sl-spinner` now renders Shoelace's markup, `svg.spinner` around `circle.spinner__track` and `circle.spinner__indicator`, with Shoelace's `spin` keyframes name; the core spinner styles are no longer applied to it, so core's `.spinner` flex rules, label-position rules and `--spinner-*` host properties cannot reach the svg. `sl-format-bytes` and `sl-format-date` start with `lang` undefined (as `sl-format-number` and `sl-relative-time` already did) instead of an empty string; the shared localization controller already treated an unset `lang` as "use the document language", so formatting is unchanged. Removes the three corresponding entries from the Shoelace conformance ledger (75 to 72 known failures, 185 to 188 passing of 260).
