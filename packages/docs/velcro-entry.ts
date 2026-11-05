// Browser-only entry: registers <sl-badge>, <sl-button>, <sl-card>, <sl-divider>, <sl-progress-bar>, <sl-progress-ring>, <sl-resize-observer>, <sl-skeleton>, <sl-spinner> and <sl-visually-hidden> and ships the light theme tokens.
// Never import this from pages/ or server/ — it touches `window` at evaluation time. Loaded by app-main.ts (docs pages) and by each example iframe.
import '@charm-ux/velcro/themes/light.css';
import '@charm-ux/velcro';
