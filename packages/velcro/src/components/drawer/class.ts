// Class-only entry: exports the component class and registers no custom element, changes no prefix and touches no shared map.
// Importing it still loads the core base module (which sets up core's own global scope), so it is not an SSR-ready import path.
// Import `./index.js` (or the package root / `./drawer` export) to register `<sl-drawer>`, `<sl-icon-button>` and `<sl-icon>`.
// As in Shoelace, constructing a drawer defines Velcro's `<sl-icon-button>` (its close button) if that tag is not defined yet.
// Loading the class sets the default `drawer.showTop`, `drawer.showEnd`, `drawer.showBottom`, `drawer.showStart`, their
// `drawer.hide*` counterparts, `drawer.denyClose`, `drawer.overlay.show` and `drawer.overlay.hide` animations, as
// Shoelace's module does.
export * from './drawer.js';
export { VelcroDrawer as SlDrawer } from './drawer.js';
