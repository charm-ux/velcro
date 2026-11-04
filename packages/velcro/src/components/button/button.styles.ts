import { css } from 'lit';

export default css`
  :host {
    display: inline-block;
    width: auto;
    position: relative;
    cursor: pointer;
  }

  .control {
    --velcro-height: var(--sl-input-height-medium, 2.5rem);
    --velcro-font-size: var(--sl-button-font-size-medium, var(--sl-font-size-medium, 1rem));
    --velcro-padding-x: var(--sl-spacing-medium, 1rem);
    --velcro-radius: var(--sl-input-border-radius-medium, 0.25rem);
    --velcro-bg: var(--sl-color-neutral-0, #fff);
    --velcro-border: var(--sl-color-neutral-300, #d4d4d8);
    --velcro-fg: var(--sl-color-neutral-700, #3f3f46);
    --velcro-hover-bg: var(--sl-color-primary-50, #f0f9ff);
    --velcro-hover-border: var(--sl-color-primary-300, #7dd3fc);
    --velcro-hover-fg: var(--sl-color-primary-700, #0369a1);
    --velcro-active-bg: var(--sl-color-primary-100, #e0f2fe);
    --velcro-active-border: var(--sl-color-primary-400, #38bdf8);
    --velcro-active-fg: var(--sl-color-primary-700, #0369a1);

    position: relative;
    display: inline-flex;
    align-items: stretch;
    justify-content: center;
    width: 100%;
    min-height: var(--velcro-height);
    height: var(--velcro-height);
    padding: 0 var(--velcro-padding-x);
    border: var(--sl-input-border-width, 1px) solid var(--velcro-border);
    border-radius: var(--velcro-radius);
    background-color: var(--velcro-bg);
    color: var(--velcro-fg);
    font-family: var(--sl-input-font-family, inherit);
    font-size: var(--velcro-font-size);
    font-weight: var(--sl-font-weight-semibold, 500);
    line-height: calc(var(--velcro-height) - var(--sl-input-border-width, 1px) * 2);
    letter-spacing: var(--sl-input-letter-spacing, normal);
    text-decoration: none;
    white-space: nowrap;
    user-select: none;
    cursor: inherit;
    box-shadow: none;
    transition:
      background-color var(--sl-transition-x-fast, 150ms) ease,
      border-color var(--sl-transition-x-fast, 150ms) ease,
      color var(--sl-transition-x-fast, 150ms) ease;
  }

  .control:hover:not([disabled]),
  .control:focus:not([disabled]) {
    background-color: var(--velcro-hover-bg);
    border-color: var(--velcro-hover-border);
    color: var(--velcro-hover-fg);
    box-shadow: none;
  }

  .control:focus-visible {
    outline: var(--sl-focus-ring, solid 3px #38bdf866);
    outline-offset: var(--sl-focus-ring-offset, 1px);
    z-index: 1;
  }

  .control:active:not([disabled]) {
    background-color: var(--velcro-active-bg);
    border-color: var(--velcro-active-border);
    color: var(--velcro-active-fg);
    box-shadow: none;
  }

  :host([disabled]),
  :host([disabled]) .control {
    cursor: not-allowed;
  }

  :host([disabled]) .control {
    opacity: 0.5;
    background-color: var(--velcro-bg);
    border-color: var(--velcro-border);
    color: var(--velcro-fg);
  }

  .prefix,
  .suffix,
  .label,
  .caret {
    display: inline-flex;
    align-items: center;
    flex: 0 0 auto;
  }

  .label {
    padding: 0 0.125em;
  }

  .prefix ::slotted(*),
  .suffix ::slotted(*) {
    pointer-events: none;
  }

  slot[name='prefix']::slotted(*) {
    margin-inline-end: 0.5em;
  }

  slot[name='suffix']::slotted(*) {
    margin-inline-start: 0.5em;
  }

  .caret svg {
    width: 1em;
    height: 1em;
    margin-inline-start: 0.5em;
  }

  /* Sizes */
  :host([size='small']) .control {
    --velcro-height: var(--sl-input-height-small, 1.875rem);
    --velcro-font-size: var(--sl-button-font-size-small, var(--sl-font-size-small, 0.875rem));
    --velcro-padding-x: var(--sl-spacing-small, 0.75rem);
    --velcro-radius: var(--sl-input-border-radius-small, 0.1875rem);
  }

  :host([size='large']) .control {
    --velcro-height: var(--sl-input-height-large, 3.125rem);
    --velcro-font-size: var(--sl-button-font-size-large, var(--sl-font-size-large, 1.25rem));
    --velcro-padding-x: var(--sl-spacing-large, 1.25rem);
    --velcro-radius: var(--sl-input-border-radius-large, 0.34375rem);
  }

  :host([pill]) .control {
    --velcro-radius: var(--sl-border-radius-pill, 9999px);
  }

  :host([circle]) .control {
    --velcro-radius: 50%;
    width: var(--velcro-height);
    padding: 0;
  }

  :host([circle]) .label {
    padding: 0;
  }

  /* Solid variants */
  :host([variant='primary']) .control {
    --velcro-bg: var(--sl-color-primary-600, #0284c7);
    --velcro-border: var(--sl-color-primary-600, #0284c7);
    --velcro-fg: var(--sl-color-neutral-0, #fff);
    --velcro-hover-bg: var(--sl-color-primary-500, #0ea5e9);
    --velcro-hover-border: var(--sl-color-primary-500, #0ea5e9);
    --velcro-hover-fg: var(--sl-color-neutral-0, #fff);
    --velcro-active-bg: var(--sl-color-primary-600, #0284c7);
    --velcro-active-border: var(--sl-color-primary-600, #0284c7);
    --velcro-active-fg: var(--sl-color-neutral-0, #fff);
  }

  :host([variant='success']) .control {
    --velcro-bg: var(--sl-color-success-600, #16a34a);
    --velcro-border: var(--sl-color-success-600, #16a34a);
    --velcro-fg: var(--sl-color-neutral-0, #fff);
    --velcro-hover-bg: var(--sl-color-success-500, #22c55e);
    --velcro-hover-border: var(--sl-color-success-500, #22c55e);
    --velcro-hover-fg: var(--sl-color-neutral-0, #fff);
    --velcro-active-bg: var(--sl-color-success-600, #16a34a);
    --velcro-active-border: var(--sl-color-success-600, #16a34a);
    --velcro-active-fg: var(--sl-color-neutral-0, #fff);
  }

  :host([variant='neutral']) .control {
    --velcro-bg: var(--sl-color-neutral-600, #52525b);
    --velcro-border: var(--sl-color-neutral-600, #52525b);
    --velcro-fg: var(--sl-color-neutral-0, #fff);
    --velcro-hover-bg: var(--sl-color-neutral-500, #71717a);
    --velcro-hover-border: var(--sl-color-neutral-500, #71717a);
    --velcro-hover-fg: var(--sl-color-neutral-0, #fff);
    --velcro-active-bg: var(--sl-color-neutral-600, #52525b);
    --velcro-active-border: var(--sl-color-neutral-600, #52525b);
    --velcro-active-fg: var(--sl-color-neutral-0, #fff);
  }

  :host([variant='warning']) .control {
    --velcro-bg: var(--sl-color-warning-600, #d97706);
    --velcro-border: var(--sl-color-warning-600, #d97706);
    --velcro-fg: var(--sl-color-neutral-0, #fff);
    --velcro-hover-bg: var(--sl-color-warning-500, #f59e0b);
    --velcro-hover-border: var(--sl-color-warning-500, #f59e0b);
    --velcro-hover-fg: var(--sl-color-neutral-0, #fff);
    --velcro-active-bg: var(--sl-color-warning-600, #d97706);
    --velcro-active-border: var(--sl-color-warning-600, #d97706);
    --velcro-active-fg: var(--sl-color-neutral-0, #fff);
  }

  :host([variant='danger']) .control {
    --velcro-bg: var(--sl-color-danger-600, #dc2626);
    --velcro-border: var(--sl-color-danger-600, #dc2626);
    --velcro-fg: var(--sl-color-neutral-0, #fff);
    --velcro-hover-bg: var(--sl-color-danger-500, #ef4444);
    --velcro-hover-border: var(--sl-color-danger-500, #ef4444);
    --velcro-hover-fg: var(--sl-color-neutral-0, #fff);
    --velcro-active-bg: var(--sl-color-danger-600, #dc2626);
    --velcro-active-border: var(--sl-color-danger-600, #dc2626);
    --velcro-active-fg: var(--sl-color-neutral-0, #fff);
  }

  /* Outline variants */
  :host([outline]) .control {
    --velcro-bg: transparent;
  }

  :host([variant='primary'][outline]) .control {
    --velcro-fg: var(--sl-color-primary-600, #0284c7);
    --velcro-hover-bg: var(--sl-color-primary-600, #0284c7);
    --velcro-active-bg: var(--sl-color-primary-700, #0369a1);
    --velcro-active-border: var(--sl-color-primary-700, #0369a1);
  }

  :host([variant='success'][outline]) .control {
    --velcro-fg: var(--sl-color-success-600, #16a34a);
    --velcro-hover-bg: var(--sl-color-success-600, #16a34a);
    --velcro-active-bg: var(--sl-color-success-700, #15803d);
    --velcro-active-border: var(--sl-color-success-700, #15803d);
  }

  :host([variant='neutral'][outline]) .control {
    --velcro-fg: var(--sl-color-neutral-600, #52525b);
    --velcro-hover-bg: var(--sl-color-neutral-600, #52525b);
    --velcro-active-bg: var(--sl-color-neutral-700, #3f3f46);
    --velcro-active-border: var(--sl-color-neutral-700, #3f3f46);
  }

  :host([variant='warning'][outline]) .control {
    --velcro-fg: var(--sl-color-warning-600, #d97706);
    --velcro-hover-bg: var(--sl-color-warning-600, #d97706);
    --velcro-active-bg: var(--sl-color-warning-700, #b45309);
    --velcro-active-border: var(--sl-color-warning-700, #b45309);
  }

  :host([variant='danger'][outline]) .control {
    --velcro-fg: var(--sl-color-danger-600, #dc2626);
    --velcro-hover-bg: var(--sl-color-danger-600, #dc2626);
    --velcro-active-bg: var(--sl-color-danger-700, #b91c1c);
    --velcro-active-border: var(--sl-color-danger-700, #b91c1c);
  }

  :host([variant][outline]:not([variant='default']):not([variant='text'])) .control:hover:not([disabled]),
  :host([variant][outline]:not([variant='default']):not([variant='text'])) .control:active:not([disabled]) {
    color: var(--sl-color-neutral-0, #fff);
  }

  /* Text variant */
  :host([variant='text']) .control {
    --velcro-bg: transparent;
    --velcro-border: transparent;
    --velcro-fg: var(--sl-color-primary-600, #0284c7);
    --velcro-hover-bg: transparent;
    --velcro-hover-border: transparent;
    --velcro-hover-fg: var(--sl-color-primary-500, #0ea5e9);
    --velcro-active-bg: transparent;
    --velcro-active-border: transparent;
    --velcro-active-fg: var(--sl-color-primary-700, #0369a1);
  }

  /* Loading */
  :host([loading]) .control > .prefix,
  :host([loading]) .control > .label,
  :host([loading]) .control > .suffix,
  :host([loading]) .control > .caret {
    visibility: hidden;
  }

  .spinner {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 1em;
    height: 1em;
    margin: -0.5em 0 0 -0.5em;
    border: 0.125em solid currentColor;
    border-right-color: transparent;
    border-radius: 50%;
    animation: velcro-spin 1s linear infinite;
  }

  @keyframes velcro-spin {
    to {
      transform: rotate(360deg);
    }
  }
`;
