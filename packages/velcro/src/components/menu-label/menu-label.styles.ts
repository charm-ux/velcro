// Adapted from Shoelace v2.20.1 (src/styles/component.styles.ts and src/components/menu-label/menu-label.styles.ts),
// Copyright (c) 2020 A Beautiful Site, LLC, MIT License. See THIRD_PARTY_NOTICES.md. The two files are concatenated
// and every rule is unchanged: the shared component styles first, then the menu label's own.
import { css } from 'lit';

// The tokens (--sl-font-sans, --sl-font-size-small, --sl-font-weight-semibold, --sl-line-height-normal,
// --sl-letter-spacing-normal, --sl-color-neutral-500, --sl-spacing-2x-small, --sl-spacing-x-large) come from the page's
// theme; load `@charm-ux/velcro/themes/light.css`.
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
    display: block;
  }

  .menu-label {
    display: inline-block;
    font-family: var(--sl-font-sans);
    font-size: var(--sl-font-size-small);
    font-weight: var(--sl-font-weight-semibold);
    line-height: var(--sl-line-height-normal);
    letter-spacing: var(--sl-letter-spacing-normal);
    color: var(--sl-color-neutral-500);
    padding: var(--sl-spacing-2x-small) var(--sl-spacing-x-large);
    user-select: none;
    -webkit-user-select: none;
  }
`;
