// Class-only entry: exports the component class and registers no custom element, changes no prefix and touches no shared map.
// Importing it still loads the core base module (which sets up core's own global scope), so it is not an SSR-ready import path.
// Import `./index.js` (or the package root / `./breadcrumb` export) to register `<sl-breadcrumb>` and `<sl-icon>`. As in
// Shoelace, constructing a breadcrumb defines Velcro's `<sl-icon>` if that tag is not defined yet. A breadcrumb holds
// breadcrumb items, which are a separate component: register `<sl-breadcrumb-item>` (its own export, or the package root) too.
export * from './breadcrumb.js';
export { VelcroBreadcrumb as SlBreadcrumb } from './breadcrumb.js';
