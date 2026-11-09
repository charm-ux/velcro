// Class-only entry: exports the component class and registers no custom element, changes no prefix and touches no shared map.
// Importing it still loads the core base module (which sets up core's own global scope), so it is not an SSR-ready import path.
// Import `./index.js` (or the package root / `./dialog` export) to register `<sl-dialog>`, `<sl-icon-button>` and `<sl-icon>`.
// As in Shoelace, constructing a dialog defines Velcro's `<sl-icon-button>` (its close button) if that tag is not defined yet.
// Loading the class sets the default `dialog.show`, `dialog.hide`, `dialog.denyClose`, `dialog.overlay.show` and
// `dialog.overlay.hide` animations, as Shoelace's module does.
export * from './dialog.js';
export { VelcroDialog as SlDialog } from './dialog.js';
