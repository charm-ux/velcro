// Class-only entry: exports the component class and registers no custom element, changes no prefix and touches no shared map.
// Importing it still loads the core base module (which sets up core's own global scope), so it is not an SSR-ready import path.
// Import `./index.js` (or the package root / `./image-comparer` export) to register `<sl-image-comparer>` and `<sl-icon>`.
// Constructing an image comparer defines Velcro's `<sl-icon>` (its default handle icon) if that tag is not defined yet.
export * from './image-comparer.js';
export { VelcroImageComparer as SlImageComparer } from './image-comparer.js';
