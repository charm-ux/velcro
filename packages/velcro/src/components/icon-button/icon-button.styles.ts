// Adapted from Shoelace v2.20.1 (src/styles/component.styles.ts and src/components/icon-button/icon-button.styles.ts),
// Copyright (c) 2020 A Beautiful Site, LLC, MIT License. See THIRD_PARTY_NOTICES.md. The two files are concatenated
// and every rule is unchanged: the shared component styles first, then the icon button's own. They replace core's base
// styles for this component (core's add `:host([hidden]) { display: none !important }` and focus and form-control resets
// that Shoelace's icon button does not have).
//
// Upstream quirk: the host's `display: inline-block` is author CSS, so it beats the browser's own `[hidden]` rule and
// `<sl-icon-button hidden>` stays visible. The shared `[hidden]` rule only applies inside the shadow root.
import { css } from 'lit';

// The tokens (--sl-color-neutral-600, --sl-color-primary-600, --sl-color-primary-700, --sl-border-radius-medium,
// --sl-spacing-x-small, --sl-transition-x-fast, --sl-focus-ring and --sl-focus-ring-offset) come from the page's theme;
// load `@charm-ux/velcro/themes/light.css`. Without a theme the icon button has no color, padding, rounded corners or
// focus ring.
export default css`
  :host {
    box-sizing: border-box;
  }

  :host *,
  :host *::before,
  :host *::after {
    box-sizing: inherit;
  }

  [hidden] {
    display: none !important;
  }

  :host {
    display: inline-block;
    color: var(--sl-color-neutral-600);
  }

  .icon-button {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    background: none;
    border: none;
    border-radius: var(--sl-border-radius-medium);
    font-size: inherit;
    color: inherit;
    padding: var(--sl-spacing-x-small);
    cursor: pointer;
    transition: var(--sl-transition-x-fast) color;
    -webkit-appearance: none;
  }

  .icon-button:hover:not(.icon-button--disabled),
  .icon-button:focus-visible:not(.icon-button--disabled) {
    color: var(--sl-color-primary-600);
  }

  .icon-button:active:not(.icon-button--disabled) {
    color: var(--sl-color-primary-700);
  }

  .icon-button:focus {
    outline: none;
  }

  .icon-button--disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .icon-button:focus-visible {
    outline: var(--sl-focus-ring);
    outline-offset: var(--sl-focus-ring-offset);
  }

  .icon-button__icon {
    pointer-events: none;
  }
`;
