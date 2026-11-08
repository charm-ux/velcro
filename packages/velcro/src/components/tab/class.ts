// Class-only entry: exports the component class and registers no custom element, changes no prefix and touches no shared map.
// Importing it still loads the core component modules (which set up core's own global scope), so it is not an SSR-ready import path.
// Import `./index.js` (or the package root / `./tab` export) to register `<sl-tab>`, `<sl-icon-button>` and `<sl-icon>`. As in
// Shoelace, constructing a tab defines Velcro's `<sl-icon-button>` (its close button) if that tag is not defined yet, and
// constructing that defines `<sl-icon>`.
export * from './tab.js';
export { VelcroTab as SlTab } from './tab.js';
