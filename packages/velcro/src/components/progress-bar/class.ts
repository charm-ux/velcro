// Class-only entry: exports the component class and registers no custom element, changes no prefix and touches no shared map.
// Importing it still loads the core component modules (which set up core's own global scope), so it is not an SSR-ready import path.
// Import `./index.js` (or the package root / `./progress-bar` export) to register `<sl-progress-bar>`.
export * from './progress-bar.js';
export { VelcroProgressBar as SlProgressBar } from './progress-bar.js';
