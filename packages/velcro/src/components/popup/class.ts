// Class-only entry: exports the component class and registers no custom element, changes no prefix and touches no shared map.
// Importing it still loads the core base and popup modules (which set up core's own global scope), so it is not an SSR-ready import
// path. Import `./index.js` (or the package root / `./popup` export) to register `<sl-popup>`.
export * from './popup.js';
export { VelcroPopup as SlPopup } from './popup.js';
