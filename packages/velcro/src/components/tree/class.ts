// Class-only entry: exports the component class and registers no custom element, changes no prefix and touches no shared map.
// Importing it still loads the core base module (which sets up core's own global scope), so it is not an SSR-ready import path.
// Import `./index.js` (or the package root / `./tree` export) to register `<sl-tree>`. A tree holds tree items, which are a
// separate component: register `<sl-tree-item>` (its own export, or the package root) too. As in Shoelace, the tree has no
// dependencies of its own to define.
export * from './tree.js';
export { VelcroTree as SlTree } from './tree.js';
