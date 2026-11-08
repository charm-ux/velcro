// Class-only entry: exports the component class and registers no custom element, changes no prefix and touches no shared map.
// Importing it still loads the core component modules (which set up core's own global scope), so it is not an SSR-ready import path.
// Import `./index.js` (or the package root / `./avatar` export) to register `<sl-avatar>` and `<sl-icon>`. As in Shoelace,
// constructing an avatar defines Velcro's `<sl-icon>` (its default icon) if that tag is not defined yet.
export * from './avatar.js';
export { VelcroAvatar as SlAvatar } from './avatar.js';
