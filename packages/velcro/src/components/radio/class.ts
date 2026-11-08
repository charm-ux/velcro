// Class-only entry: exports the component class and registers no custom element, changes no prefix and touches no shared map.
// Importing it still loads the core component modules (which set up core's own global scope), so it is not an SSR-ready import path.
// Import `./index.js` (or the package root / `./radio` export) to register `<sl-radio>` (and `<sl-icon>`, which a checked
// radio renders; with the class-only entry, register an icon yourself).
export * from './radio.js';
export { VelcroRadio as SlRadio } from './radio.js';
