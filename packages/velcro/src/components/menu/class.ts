// Class-only entry: exports the component class and registers no custom element, changes no prefix and touches no shared map.
// Importing it still loads the core base module (which sets up core's own global scope), so it is not an SSR-ready import path.
// Import `./index.js` (or the package root / `./menu` export) to register `<sl-menu>`. A menu holds menu items, menu labels
// and dividers, which are separate components: register `<sl-menu-item>` (its own export, or the package root) too.
export * from './menu.js';
export { VelcroMenu as SlMenu } from './menu.js';
