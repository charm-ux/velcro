// Class-only entry: exports the component class and registers no custom element, changes no prefix and touches no shared map.
// Importing it still loads the core component modules (which set up core's own global scope), so it is not an SSR-ready
// import path. Import `./index.js` (or the package root / `./select` export) to register `<sl-select>` with the elements
// it renders (`<sl-popup>`, `<sl-tag>`, `<sl-icon-button>` and `<sl-icon>`; the class-only entry defines them when the
// first select is constructed). As in Shoelace, the options are not a dependency: import `../option/index.js` (or the
// `./option` export) to register `<sl-option>`.
export * from './select.js';
export { VelcroSelect as SlSelect } from './select.js';
