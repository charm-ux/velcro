// Class-only entry: exports the component class and registers no custom element, changes no prefix and touches no shared map.
// Importing it still loads the core component modules (which set up core's own global scope), so it is not an SSR-ready import path.
// Import `./index.js` (or the package root / `./alert` export) to register `<sl-alert>`, `<sl-icon-button>` and `<sl-icon>`. As
// in Shoelace, constructing an alert defines Velcro's `<sl-icon-button>` (its close button) if that tag is not defined yet,
// and constructing that defines `<sl-icon>`. Loading the class sets the default `alert.show` and `alert.hide` animations,
// as Shoelace's module does.
export * from './alert.js';
export { VelcroAlert as SlAlert } from './alert.js';
