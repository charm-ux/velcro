// Browser-only entry: registers <sl-badge>, <sl-button>, <sl-card>, <sl-divider>, <sl-progress-bar>, <sl-progress-ring>, <sl-resize-observer>, <sl-skeleton>, <sl-spinner> and <sl-visually-hidden> and ships the light and dark theme tokens (dark applies only under `.sl-theme-dark`).
// Never import this from pages/ or server/ — it touches `window` at evaluation time.
import '@charm-ux/velcro/themes/light.css';
import '@charm-ux/velcro/themes/dark.css';
import '@charm-ux/velcro';
