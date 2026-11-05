// Browser-only entry: registers <sl-badge>, <sl-button>, <sl-divider>, <sl-progress-ring> and <sl-spinner> and ships the light theme tokens.
// Never import this from pages/ or server/ — it touches `window` at evaluation time.
import '@charm-ux/velcro/themes/light.css';
import '@charm-ux/velcro';
