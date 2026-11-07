// Browser-only entry: registers every Velcro component in the package root (one sl-* tag per catalog.jsonl entry) and ships the light and dark theme tokens (dark applies only under `.sl-theme-dark`).
// Never import this from pages/ or server/ — it touches `window` at evaluation time. Loaded by app-main.ts (docs pages) and by each example iframe.
import '@charm-ux/velcro/themes/light.css';
import '@charm-ux/velcro/themes/dark.css';
import { setBasePath } from '@charm-ux/velcro';
import { withBase } from './src/base.js';

// Icon assets are served at the site root (assets/icons/, assets/images/sprite.svg), under the build-time base path.
// Runs before any icon resolves: elements upgraded during evaluation draw in a later microtask.
setBasePath(withBase('/'));

// Re-exported so example documents can import Velcro's API from this same bundle (see exampleDocument's import map),
// including Shoelace's animation utilities (`getAnimationNames`, `getEasingNames`) for the animation examples.
export * from '@charm-ux/velcro';
