// Class-only entry: exports the component class and registers no custom element, changes no prefix and touches no shared map.
// Importing it still loads the core component modules (which set up core's own global scope), so it is not an SSR-ready import path.
// Import `./index.js` (or the package root / `./button` export) to register `<sl-button>`.
export * from './button.js';
export { VelcroButton as SlButton } from './button.js';
