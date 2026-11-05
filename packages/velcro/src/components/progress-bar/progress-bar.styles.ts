// Adapted from Shoelace v2.20.1 (src/components/progress-bar/progress-bar.styles.ts), Copyright (c) 2020 A Beautiful Site, LLC,
// MIT License. See THIRD_PARTY_NOTICES.md. Changes: a Velcro keyframes name pair (so they cannot collide with core's
// `indeterminate` keyframes) and resets for the core progress bar's host width and slotted-icon color rules.
import { css } from 'lit';

// The tokens (--sl-color-*, --sl-border-radius-pill, --sl-shadow-small, --sl-font-sans, --sl-font-weight-normal) come
// from the page's theme; load `@charm-ux/velcro/themes/light.css`.
export default css`
  :host {
    --height: 1rem;
    --track-color: var(--sl-color-neutral-200);
    --indicator-color: var(--sl-color-primary-600);
    --label-color: var(--sl-color-neutral-0);

    display: block;
    /* Core's host rule sets width: 100%; Shoelace's host has no width, so a block host fills its container itself. */
    width: auto;
  }

  /* Core's styles color a slotted [icon] with --progress-bar-icon-color (black); the label must inherit --label-color. */
  ::slotted([icon]) {
    color: inherit;
  }

  .progress-bar {
    position: relative;
    background-color: var(--track-color);
    height: var(--height);
    border-radius: var(--sl-border-radius-pill);
    box-shadow: inset var(--sl-shadow-small);
    overflow: hidden;
  }

  .progress-bar__indicator {
    height: 100%;
    font-family: var(--sl-font-sans);
    font-size: 12px;
    font-weight: var(--sl-font-weight-normal);
    background-color: var(--indicator-color);
    color: var(--label-color);
    text-align: center;
    line-height: var(--height);
    white-space: nowrap;
    overflow: hidden;
    transition:
      400ms width,
      400ms background-color;
    user-select: none;
    -webkit-user-select: none;
  }

  /* Indeterminate */
  .progress-bar--indeterminate .progress-bar__indicator {
    position: absolute;
    animation: velcro-progress-bar-indeterminate 2.5s infinite cubic-bezier(0.37, 0, 0.63, 1);
  }

  .progress-bar--indeterminate.progress-bar--rtl .progress-bar__indicator {
    animation-name: velcro-progress-bar-indeterminate-rtl;
  }

  @media (forced-colors: active) {
    .progress-bar {
      outline: solid 1px SelectedItem;
      background-color: var(--sl-color-neutral-0);
    }

    .progress-bar__indicator {
      outline: solid 1px SelectedItem;
      background-color: SelectedItem;
    }
  }

  @keyframes velcro-progress-bar-indeterminate {
    0% {
      left: -50%;
      width: 50%;
    }
    75%,
    100% {
      left: 100%;
      width: 50%;
    }
  }

  @keyframes velcro-progress-bar-indeterminate-rtl {
    0% {
      right: -50%;
      width: 50%;
    }
    75%,
    100% {
      right: 100%;
      width: 50%;
    }
  }
`;
