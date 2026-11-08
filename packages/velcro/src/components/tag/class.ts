// Class-only entry: exports the component class and registers no custom element, changes no prefix and touches no shared map.
// Importing it still loads the core base module (which sets up core's own global scope), so it is not an SSR-ready import path.
// Import `./index.js` (or the package root / `./tag` export) to register `<sl-tag>`, `<sl-icon-button>` and `<sl-icon>`. As in
// Shoelace, constructing a tag defines Velcro's `<sl-icon-button>` (its remove button) if that tag is not defined yet, and
// constructing that defines `<sl-icon>`.
export * from './tag.js';
export { VelcroTag as SlTag } from './tag.js';
