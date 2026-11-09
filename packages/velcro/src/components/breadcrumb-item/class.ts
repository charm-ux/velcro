// Class-only entry: exports the component class and registers no custom element, changes no prefix and touches no shared map.
// Importing it still loads the core base module (which sets up core's own global scope), so it is not an SSR-ready import path.
// Import `./index.js` (or the package root / `./breadcrumb-item` export) to register `<sl-breadcrumb-item>`. A breadcrumb
// item works inside an `<sl-breadcrumb>`, which is a separate component: register it too.
export * from './breadcrumb-item.js';
export { VelcroBreadcrumbItem as SlBreadcrumbItem } from './breadcrumb-item.js';
