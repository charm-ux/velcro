// Adapted from Shoelace v2.20.1 (src/components/skeleton/skeleton.styles.ts), Copyright (c) 2020 A Beautiful Site, LLC,
// MIT License. See THIRD_PARTY_NOTICES.md. Changes: Velcro keyframes names (so they cannot collide with core's
// `pulse` and `wave` keyframes) and a fallback for each theme token.
import { css } from 'lit';

// The tokens (--sl-color-neutral-*, --sl-border-radius-pill) come from the page's theme; load
// `@charm-ux/velcro/themes/light.css`.
export default css`
  :host {
    --border-radius: var(--sl-border-radius-pill, 9999px);
    --color: var(--sl-color-neutral-200, #e4e4e7);
    --sheen-color: var(--sl-color-neutral-300, #d4d4d8);

    display: block;
    position: relative;
  }

  .skeleton {
    display: flex;
    width: 100%;
    height: 100%;
    min-height: 1rem;
  }

  .skeleton__indicator {
    flex: 1 1 auto;
    background: var(--color);
    border-radius: var(--border-radius);
  }

  .skeleton--sheen .skeleton__indicator {
    background: linear-gradient(270deg, var(--sheen-color), var(--color), var(--color), var(--sheen-color));
    background-size: 400% 100%;
    animation: velcro-skeleton-sheen 8s ease-in-out infinite;
  }

  .skeleton--pulse .skeleton__indicator {
    animation: velcro-skeleton-pulse 2s ease-in-out 0.5s infinite;
  }

  /* Forced colors mode */
  @media (forced-colors: active) {
    :host {
      --color: GrayText;
    }
  }

  @keyframes velcro-skeleton-sheen {
    0% {
      background-position: 200% 0;
    }
    to {
      background-position: -200% 0;
    }
  }

  @keyframes velcro-skeleton-pulse {
    0% {
      opacity: 1;
    }
    50% {
      opacity: 0.4;
    }
    100% {
      opacity: 1;
    }
  }
`;
