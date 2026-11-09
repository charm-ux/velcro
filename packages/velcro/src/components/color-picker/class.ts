// Class-only entry: exports the component class and registers no custom element, changes no prefix and touches no shared map.
// Importing it still loads the core base module (which sets up core's own global scope), so it is not an SSR-ready import path.
// Import `./index.js` (or the package root / `./color-picker` export) to register `<sl-color-picker>` and the elements it
// renders. As in Shoelace, constructing a color picker defines Velcro's `<sl-button-group>`, `<sl-button>`,
// `<sl-dropdown>` (which defines `<sl-popup>`), `<sl-icon>`, `<sl-input>` and `<sl-visually-hidden>` when those tags are
// not defined yet.
export * from './color-picker.js';
export { VelcroColorPicker as SlColorPicker } from './color-picker.js';
