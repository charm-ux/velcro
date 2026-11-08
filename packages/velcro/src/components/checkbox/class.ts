// Class-only entry: exports the component class and registers no custom element, changes no prefix and touches no shared map.
// Importing it still loads the core component modules (which set up core's own global scope), so it is not an SSR-ready import path.
// Import `./index.js` (or the package root / `./checkbox` export) to register `<sl-checkbox>` and `<sl-icon>`. As in
// Shoelace, constructing a checkbox defines Velcro's `<sl-icon>` (its checked and indeterminate icons) if that tag is not
// defined yet.
export * from './checkbox.js';
export { VelcroCheckbox as SlCheckbox } from './checkbox.js';
