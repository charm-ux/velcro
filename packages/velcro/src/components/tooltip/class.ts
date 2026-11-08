// Class-only entry: exports the component class and registers no custom element, changes no prefix and touches no shared map.
// Importing it still loads the core component modules (which set up core's own global scope), so it is not an SSR-ready import path.
// Import `./index.js` (or the package root / `./tooltip` export) to register `<sl-tooltip>` and `<sl-popup>`. As in
// Shoelace, constructing a tooltip defines Velcro's `<sl-popup>` (its positioning base) if that tag is not defined yet.
// Loading the class sets the default `tooltip.show` and `tooltip.hide` animations, as Shoelace's module does.
export * from './tooltip.js';
export { VelcroTooltip as SlTooltip } from './tooltip.js';
