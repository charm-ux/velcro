// Class-only entry: exports the component class and registers no custom element, changes no prefix and touches no shared map.
// Importing it still loads the core base module (which sets up core's own global scope), so it is not an SSR-ready import path.
// Import `./index.js` (or the package root / `./dropdown` export) to register `<sl-dropdown>` and `<sl-popup>`. As in Shoelace,
// constructing a dropdown defines Velcro's `<sl-popup>` if that tag is not defined yet. A dropdown works with whatever is
// slotted into it (usually an `<sl-button>` trigger and an `<sl-menu>`), which are separate components: register them too.
export * from './dropdown.js';
export { VelcroDropdown as SlDropdown } from './dropdown.js';
