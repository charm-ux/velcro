// Class-only entry: exports the component class and registers no custom element, changes no prefix and touches no shared map.
// Importing it still loads the core base module (which sets up core's own global scope), so it is not an SSR-ready import path.
// Import `./index.js` (or the package root / `./tab-group` export) to register `<sl-tab-group>`, `<sl-icon-button>`,
// `<sl-icon>` and `<sl-resize-observer>`. As in Shoelace, constructing a tab group defines Velcro's `<sl-icon-button>` (its
// scroll buttons) and `<sl-resize-observer>` if those tags are not defined yet, and constructing the icon button defines
// `<sl-icon>`. The tabs and panels are separate components: register `<sl-tab>` and `<sl-tab-panel>` too.
// Like Shoelace's tab group, importing it applies Shoelace's scrollend polyfill (listed in the package's `sideEffects`, so
// bundlers keep it): where the browser has no native `scrollend` event it patches `EventTarget.prototype.addEventListener`
// and `removeEventListener` globally.
export * from './tab-group.js';
export { VelcroTabGroup as SlTabGroup } from './tab-group.js';
