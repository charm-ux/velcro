// Adapted from Shoelace v2.20.1 (src/components/breadcrumb-item/breadcrumb-item.styles.ts and the shared
// src/styles/component.styles.ts it is composed with), Copyright (c) 2020 A Beautiful Site, LLC, MIT License. See
// THIRD_PARTY_NOTICES.md. The two files are concatenated and every rule is unchanged: the shared component styles
// first, then the breadcrumb item's own. They replace core's base and breadcrumb item styles for this component: core
// adds a `:host([hidden]) { display: none !important }` rule that Shoelace does not have, and styles a different
// structure.
//
// Upstream quirk: the prefix and suffix containers' rule declares `display: none` and then `display: flex`, so the later
// one wins and the empty containers are always laid out (as zero-width flex boxes); only their margins depend on the
// `--has-prefix` / `--has-suffix` classes.
import { css } from 'lit';

// The tokens (--sl-font-sans, --sl-font-size-small, --sl-font-weight-semibold, --sl-color-neutral-600,
// --sl-line-height-normal, --sl-border-radius-medium, --sl-transition-fast, --sl-color-primary-500,
// --sl-color-primary-600, --sl-focus-ring, --sl-focus-ring-offset and --sl-spacing-x-small) come from the page's theme;
// load `@charm-ux/velcro/themes/light.css`.
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
    display: inline-flex;
  }

  .breadcrumb-item {
    display: inline-flex;
    align-items: center;
    font-family: var(--sl-font-sans);
    font-size: var(--sl-font-size-small);
    font-weight: var(--sl-font-weight-semibold);
    color: var(--sl-color-neutral-600);
    line-height: var(--sl-line-height-normal);
    white-space: nowrap;
  }

  .breadcrumb-item__label {
    display: inline-block;
    font-family: inherit;
    font-size: inherit;
    font-weight: inherit;
    line-height: inherit;
    text-decoration: none;
    color: inherit;
    background: none;
    border: none;
    border-radius: var(--sl-border-radius-medium);
    padding: 0;
    margin: 0;
    cursor: pointer;
    transition: var(--sl-transition-fast) --color;
  }

  :host(:not(:last-of-type)) .breadcrumb-item__label {
    color: var(--sl-color-primary-600);
  }

  :host(:not(:last-of-type)) .breadcrumb-item__label:hover {
    color: var(--sl-color-primary-500);
  }

  :host(:not(:last-of-type)) .breadcrumb-item__label:active {
    color: var(--sl-color-primary-600);
  }

  .breadcrumb-item__label:focus {
    outline: none;
  }

  .breadcrumb-item__label:focus-visible {
    outline: var(--sl-focus-ring);
    outline-offset: var(--sl-focus-ring-offset);
  }

  .breadcrumb-item__prefix,
  .breadcrumb-item__suffix {
    display: none;
    flex: 0 0 auto;
    display: flex;
    align-items: center;
  }

  .breadcrumb-item--has-prefix .breadcrumb-item__prefix {
    display: inline-flex;
    margin-inline-end: var(--sl-spacing-x-small);
  }

  .breadcrumb-item--has-suffix .breadcrumb-item__suffix {
    display: inline-flex;
    margin-inline-start: var(--sl-spacing-x-small);
  }

  :host(:last-of-type) .breadcrumb-item__separator {
    display: none;
  }

  .breadcrumb-item__separator {
    display: inline-flex;
    align-items: center;
    margin: 0 var(--sl-spacing-x-small);
    user-select: none;
    -webkit-user-select: none;
  }
`;
