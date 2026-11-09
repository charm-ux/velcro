// Class-only entry: exports the component class and registers no custom element, changes no prefix and touches no shared map.
// Importing it still loads the core base module (which sets up core's own global scope), so it is not an SSR-ready import path.
// Import `./index.js` (or the package root / `./rating` export) to register `<sl-rating>` and `<sl-icon>`. As in Shoelace,
// constructing a rating defines Velcro's `<sl-icon>` (its default symbol) if that tag is not defined yet.
export * from './rating.js';
export { VelcroRating as SlRating } from './rating.js';
