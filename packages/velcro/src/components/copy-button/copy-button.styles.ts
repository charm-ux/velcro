// Adapted from Shoelace v2.20.1 (src/styles/component.styles.ts and src/components/copy-button/copy-button.styles.ts),
// Copyright (c) 2020 A Beautiful Site, LLC, MIT License. See THIRD_PARTY_NOTICES.md. The two files are concatenated
// and every rule is unchanged: the shared component styles first, then the copy button's own. They replace core's base
// styles for this component (core's add `:host([hidden]) { display: none !important }`, focus outlines and
// form-control resets that Shoelace's copy button does not have).
//
// Upstream quirk: the host's `display: inline-block` is author CSS, so it beats the browser's own `[hidden]` rule and
// `<sl-copy-button hidden>` stays visible. The shared `[hidden]` rule only applies inside the shadow root, where it
// hides the two feedback icons while the button is at rest.
import { css } from 'lit';

// The tokens (--sl-color-danger-600, --sl-color-success-600, --sl-border-radius-medium, --sl-spacing-x-small,
// --sl-transition-x-fast, --sl-focus-ring and --sl-focus-ring-offset) come from the page's theme; load
// `@charm-ux/velcro/themes/light.css`. Without a theme the button has no feedback colors, rounded corners, padding or
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
    --error-color: var(--sl-color-danger-600);
    --success-color: var(--sl-color-success-600);

    display: inline-block;
  }

  .copy-button__button {
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
  }

  .copy-button--success .copy-button__button {
    color: var(--success-color);
  }

  .copy-button--error .copy-button__button {
    color: var(--error-color);
  }

  .copy-button__button:focus-visible {
    outline: var(--sl-focus-ring);
    outline-offset: var(--sl-focus-ring-offset);
  }

  .copy-button__button[disabled] {
    opacity: 0.5;
    cursor: not-allowed !important;
  }

  slot {
    display: inline-flex;
  }
`;
