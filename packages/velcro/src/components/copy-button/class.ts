// Class-only entry: exports the component class and registers no custom element, changes no prefix and touches no shared map.
// Importing it still loads the core base module (which sets up core's own global scope), so it is not an SSR-ready import path.
// Import `./index.js` (or the package root / `./copy-button` export) to register `<sl-copy-button>`, `<sl-tooltip>`, `<sl-popup>` and
// `<sl-icon>`. As in Shoelace, constructing a copy button defines Velcro's `<sl-icon>` and `<sl-tooltip>` if those tags are not
// defined yet (and constructing a tooltip defines `<sl-popup>`). Loading the class sets the default `copy.in` and `copy.out`
// animations, as Shoelace's module does.
export * from './copy-button.js';
export { VelcroCopyButton as SlCopyButton } from './copy-button.js';
