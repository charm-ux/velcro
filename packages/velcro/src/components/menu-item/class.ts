// Class-only entry: exports the component class and registers no custom element, changes no prefix and touches no shared map.
// Importing it still loads the core base module (which sets up core's own global scope), so it is not an SSR-ready import path.
// Import `./index.js` (or the package root / `./menu-item` export) to register `<sl-menu-item>`, `<sl-popup>`, `<sl-icon>`
// and `<sl-spinner>`. As in Shoelace, constructing a menu item defines Velcro's `<sl-icon>`, `<sl-popup>` and `<sl-spinner>`
// if those tags are not defined yet. A menu item works inside an `<sl-menu>`, which is a separate component: register it too.
export * from './menu-item.js';
export { VelcroMenuItem as SlMenuItem } from './menu-item.js';
