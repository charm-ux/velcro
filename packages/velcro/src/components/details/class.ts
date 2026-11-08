// Class-only entry: exports the component class and registers no custom element, changes no prefix and touches no shared map.
// Importing it still loads the core base module (which sets up core's own global scope), so it is not an SSR-ready import path.
// Import `./index.js` (or the package root / `./details` export) to register `<sl-details>` and `<sl-icon>`. As in Shoelace,
// constructing a details defines Velcro's `<sl-icon>` (its default expand and collapse icon) if that tag is not defined yet.
// Loading the class sets the default `details.show` and `details.hide` animations, as Shoelace's module does.
export * from './details.js';
export { VelcroDetails as SlDetails } from './details.js';
