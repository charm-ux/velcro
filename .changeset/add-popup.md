---
'@charm-ux/velcro': minor
---

Add a prototype `VelcroPopup`, registered as `sl-popup` on the `@charm-ux/core` base element. It has Shoelace 2.20.1's popup API:
- `anchor` as an id, element, `anchor` slot or virtual element;
- `active`, the twelve `placement` values, `strategy`, `distance` and `skidding`;
- `arrow`, `arrow-placement` and `arrow-padding`;
- `flip` with its fallback placements, strategy, boundary and padding;
- `shift`, `auto-size`, `sync` and `hover-bridge`;
- the `reposition()` method, the `sl-reposition` event, the `popup`, `arrow` and `hover-bridge` parts and the arrow and auto-size custom properties;
- `dir` and `lang` as Shoelace's plain reactive properties (undefined by default, not reflected; the arrow's start and end follow the `dir` property).

It does not extend the core popup, a dismissible surface whose `anchor`, `placement` and `reposition()` types cannot be replaced with Shoelace's in a subclass. It positions through the core popup's own Floating UI calls, so no Floating UI dependency is added. For the `absolute` strategy it uses Shoelace's composed offset-parent lookup, adapted from composed-offset-position 0.0.6 and @floating-ui/utils 0.2.12 (MIT), so a popup slotted into a shadow tree is positioned against the positioned element around the slot. The popup's direction is read where Shoelace reads it, although core starts the computation one microtask later.

Shoelace's quirks are matched:
- `sl-reposition` fires before the new position is applied.
- The arrow's default color differs from its documented default.
- A string `flipFallbackPlacements` property is not split.
- Removing `placement` or `strategy` restores the recorded value.
- Toggling `active` off and on before an update starts a second auto-update.

Not implemented or unverified:
- other browsers, and transformed or zoomed containers;
- the Shoelace examples' `sl-select`, `sl-input` and `sl-range` controls (ported with native controls);
- the per-example React variants (React usage is shown once).

The generated React wrappers now set camelCase props whose attribute name is hyphenated (for example `arrowPadding`, and the card's `mediaPosition` or the format-number digit options) as element properties, like their other props, instead of as attributes.

Inherits the core `ready` event. Adds the `@charm-ux/velcro/popup` and `@charm-ux/velcro/popup/class` exports (with the `SlPopup` alias), and updates the third-party notices.
