// Adapted from Shoelace v2.20.1 (src/components/spinner/spinner.styles.ts), Copyright (c) 2020 A Beautiful Site, LLC,
// MIT License. See THIRD_PARTY_NOTICES.md. Changes: class names, a fallback for the primary token, a Velcro
// keyframes name (so it cannot collide with core's spinner keyframes) and a forced-colors rule.
import { css } from 'lit';

// Resizing a spinner element using anything but font-size will break the animation because the animation uses em
// units. The `flex: none` on the host keeps a spinner inside a flex container at its actual size.
export default css`
  :host {
    --track-width: 2px;
    --track-color: rgb(128 128 128 / 25%);
    --indicator-color: var(--sl-color-primary-600, #0284c7);
    --speed: 2s;

    display: inline-flex;
    width: 1em;
    height: 1em;
    flex: none;
  }

  .ring {
    flex: 1 1 auto;
    height: 100%;
    width: 100%;
  }

  .track,
  .indicator {
    fill: none;
    stroke-width: var(--track-width);
    r: calc(0.5em - var(--track-width) / 2);
    cx: 0.5em;
    cy: 0.5em;
    transform-origin: 50% 50%;
  }

  .track {
    stroke: var(--track-color);
    transform-origin: 0% 0%;
  }

  .indicator {
    stroke: var(--indicator-color);
    stroke-linecap: round;
    stroke-dasharray: 150% 75%;
    animation: velcro-spinner-spin var(--speed) linear infinite;
  }

  @keyframes velcro-spinner-spin {
    0% {
      transform: rotate(0deg);
      stroke-dasharray: 0.05em, 3em;
    }

    50% {
      transform: rotate(450deg);
      stroke-dasharray: 1.375em, 1.375em;
    }

    100% {
      transform: rotate(1080deg);
      stroke-dasharray: 0.05em, 3em;
    }
  }

  @media screen and (forced-colors: active) {
    .track {
      stroke: GrayText;
    }

    .indicator {
      stroke: Highlight;
    }
  }
`;
