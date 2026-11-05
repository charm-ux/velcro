// Class-only entry: exports the component class and registers no custom element, changes no prefix and touches no shared map.
// Importing it still loads the core base module (which sets up core's own global scope), so it is not an SSR-ready import path.
// Import `./index.js` (or the package root / `./visually-hidden` export) to register `<sl-visually-hidden>`.
export * from './visually-hidden.js';
export { VelcroVisuallyHidden as SlVisuallyHidden } from './visually-hidden.js';
