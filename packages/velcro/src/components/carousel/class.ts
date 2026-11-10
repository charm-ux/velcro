// Class-only entry: exports the component class and registers no custom element, changes no prefix and touches no shared map.
// Importing it still loads the core base module (which sets up core's own global scope), so it is not an SSR-ready import path.
// Import `./index.js` (or the package root / `./carousel` export) to register `<sl-carousel>` and `<sl-icon>`. As in Shoelace,
// constructing a carousel defines Velcro's `<sl-icon>` (its navigation icons) if that tag is not defined yet. The slides are a
// separate component: register `<sl-carousel-item>` too.
// Like Shoelace's carousel, importing it applies Shoelace's scrollend polyfill (the tab group's copy of
// `src/internal/scrollend-polyfill.ts`, listed in the package's `sideEffects`, so bundlers keep it): where the browser has no
// native `scrollend` event it patches `EventTarget.prototype.addEventListener` and `removeEventListener` globally.
export * from './carousel.js';
export { VelcroCarousel as SlCarousel } from './carousel.js';
