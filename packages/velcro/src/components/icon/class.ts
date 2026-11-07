// Class-only entry: exports the component class and the icon library and base path utilities, and registers no custom
// element, changes no prefix and touches no shared map. Importing it still loads the core component modules (which set up
// core's own global scope), so it is not an SSR-ready import path. Import `./index.js` to register `<sl-icon>`.
export * from './icon.js';
export { VelcroIcon as SlIcon } from './icon.js';
export * from '../../utilities/icon-library.js';
export * from '../../utilities/base-path.js';
