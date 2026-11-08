// Adapted from Shoelace v2.20.1 (src/components/radio-button/radio-button.styles.ts and the shared
// src/styles/component.styles.ts it is composed with), Copyright (c) 2020 A Beautiful Site, LLC, MIT License. See
// THIRD_PARTY_NOTICES.md. Changes: the component styles are written out first, in the order Shoelace's radio button
// composes them, and Shoelace's button styles come from Velcro's adapted copy (`../button/button.styles.js`), whose only
// addition is the `.button__caret` sizing, which matches nothing in a radio button. The rules are otherwise unchanged.
// They replace core's base styles, because core adds a `:host([hidden]) { display: none !important }` rule that
// Shoelace does not have.
import { css } from 'lit';
import buttonStyles from '../button/button.styles.js';

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

  ${buttonStyles}

  .button__prefix,
  .button__suffix,
  .button__label {
    display: inline-flex;
    position: relative;
    align-items: center;
  }

  /* We use a hidden input so constraint validation errors work, since they don't appear to show when used with buttons.
    We can't actually hide it, though, otherwise the messages will be suppressed by the browser. */
  .hidden-input {
    all: unset;
    position: absolute;
    top: 0;
    left: 0;
    bottom: 0;
    right: 0;
    outline: dotted 1px red;
    opacity: 0;
    z-index: -1;
  }
`;
