// Class-only entry: exports the component class and registers no custom element, changes no prefix and touches no shared map.
// Importing it still loads the core base module (which sets up core's own global scope), so it is not an SSR-ready import path.
// Import `./index.js` (or the package root / `./range` export) to register `<sl-range>`.
export * from './range.js';
export { VelcroRange as SlRange } from './range.js';
