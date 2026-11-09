// Class-only entry: exports the component class and registers no custom element, changes no prefix and touches no shared map.
// Importing it still loads the core base module (which sets up core's own global scope), so it is not an SSR-ready import path.
// Import `./index.js` (or the package root / `./option` export) to register `<sl-option>` and `<sl-icon>`. As in Shoelace,
// constructing an option defines Velcro's `<sl-icon>` (its check mark) if that tag is not defined yet.
export * from './option.js';
export { VelcroOption as SlOption } from './option.js';
