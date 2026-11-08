// Class-only entry: exports the component class and Shoelace's form utilities (`serialize` and `getFormControls`, which
// Shoelace's package root exports too), and registers no custom element, changes no prefix and touches no shared map.
// Importing it still loads the core component modules (which set up core's own global scope), so it is not an SSR-ready
// import path. Import `./index.js` (or the package root / `./textarea` export) to register `<sl-textarea>`.
export * from './textarea.js';
export { VelcroTextarea as SlTextarea } from './textarea.js';
export * from '../../utilities/form.js';
