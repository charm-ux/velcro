// Class-only entry: exports the component class and registers no custom element, changes no prefix and touches no shared map.
// Importing it still loads the core component modules (which set up core's own global scope), so it is not an SSR-ready
// import path. Import `./index.js` (or the package root / `./input` export) to register `<sl-input>` (and `<sl-icon>`,
// which the clear and password toggle buttons render; the class-only entry defines it when the first input is constructed).
export * from './input.js';
export { VelcroInput as SlInput } from './input.js';
