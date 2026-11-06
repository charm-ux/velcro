// Class-only entry: exports the component class and registers no custom element, changes no prefix and touches no shared map.
// Importing it still loads the core base module (which sets up core's own global scope), so it is not an SSR-ready import path.
// Import `./index.js` (or the package root / `./mutation-observer` export) to register `<sl-mutation-observer>`.
export * from './mutation-observer.js';
export { VelcroMutationObserver as SlMutationObserver } from './mutation-observer.js';
