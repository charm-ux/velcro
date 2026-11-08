// Class-only entry: exports the component class and registers no custom element, changes no prefix and touches no shared map.
// Importing it still loads the core component modules (which set up core's own global scope), so it is not an SSR-ready import path.
// Import `./index.js` (or the package root / `./avatar` export) to register `<sl-avatar>` (and `<sl-icon>`, which the
// default icon renders; with the class-only entry, register an icon yourself if you rely on the default icon).
export * from './avatar.js';
export { VelcroAvatar as SlAvatar } from './avatar.js';
