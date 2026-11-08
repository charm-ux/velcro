// Class-only entry: exports the component class and registers no custom element, changes no prefix and touches no shared map.
// Importing it still loads the core base module (which sets up core's own global scope), so it is not an SSR-ready import path.
// Import `./index.js` (or the package root / `./icon-button` export) to register `<sl-icon-button>` and `<sl-icon>`. As in
// Shoelace, constructing an icon button defines Velcro's `<sl-icon>` if that tag is not defined yet.
export * from './icon-button.js';
export { VelcroIconButton as SlIconButton } from './icon-button.js';
