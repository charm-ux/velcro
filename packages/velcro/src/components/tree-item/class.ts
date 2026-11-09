// Class-only entry: exports the component class and registers no custom element, changes no prefix and touches no shared map.
// Importing it still loads the core base module (which sets up core's own global scope), so it is not an SSR-ready import path.
// Import `./index.js` (or the package root / `./tree-item` export) to register `<sl-tree-item>`, `<sl-checkbox>`, `<sl-icon>`
// and `<sl-spinner>`. As in Shoelace, constructing a tree item defines Velcro's `<sl-checkbox>`, `<sl-icon>` and `<sl-spinner>`
// (its multiple-selection checkbox, expand and collapse icon and loading spinner) if those tags are not defined yet.
// Loading the class sets the default `tree-item.expand` and `tree-item.collapse` animations, as Shoelace's module does.
export * from './tree-item.js';
export { VelcroTreeItem as SlTreeItem } from './tree-item.js';
