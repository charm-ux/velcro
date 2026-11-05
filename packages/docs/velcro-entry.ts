// Browser-only entry: registers every Velcro component in the package root (one sl-* tag per catalog.jsonl entry) and ships the light theme tokens.
// Never import this from pages/ or server/ — it touches `window` at evaluation time. Loaded by app-main.ts (docs pages) and by each example iframe.
import '@charm-ux/velcro/themes/light.css';
import '@charm-ux/velcro';
