// Browser-only entry: registers every Velcro component in the package root (one sl-* tag per catalog.jsonl entry) and ships the light and dark theme tokens (dark applies only under `.sl-theme-dark`).
// Never import this from pages/ or server/ — it touches `window` at evaluation time. Loaded by app-main.ts (docs pages) and by each example iframe.
import '@charm-ux/velcro/themes/light.css';
import '@charm-ux/velcro/themes/dark.css';
import '@charm-ux/velcro';
