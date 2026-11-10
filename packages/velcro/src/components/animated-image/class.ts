// Class-only entry: exports the component class and registers no custom element, changes no prefix and touches no shared map.
// Importing it still loads the core base module (which sets up core's own global scope), so it is not an SSR-ready import path.
// Import `./index.js` (or the package root / `./animated-image` export) to register `<sl-animated-image>` and `<sl-icon>`. As in
// Shoelace, constructing an animated image defines Velcro's `<sl-icon>` (its default play and pause icons) if that tag is not
// defined yet.
export * from './animated-image.js';
export { VelcroAnimatedImage as SlAnimatedImage } from './animated-image.js';
