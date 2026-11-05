// Portions of the API documentation wording in this file and the rendered structure (a `div` with the `base` part
// and `skeleton` / `skeleton--*` class names around a `div` with the `indicator` part) are adapted from Shoelace
// v2.20.1 (src/components/skeleton/skeleton.component.ts), Copyright (c) 2020 A Beautiful Site, LLC, MIT License.
// See THIRD_PARTY_NOTICES.md. No Shoelace source file or runtime is included.
import { html } from 'lit';
import { property } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { CoreSkeleton } from '@charm-ux/core/dist/components/skeleton/skeleton.js';
import styles from './skeleton.styles.js';

/**
 * Skeletons are used to provide a visual representation of where content will eventually be drawn. API modelled on
 * Shoelace's `sl-skeleton`.
 *
 * @tag sl-skeleton
 * @status prototype
 *
 * @csspart base - The component's base wrapper.
 * @csspart indicator - The skeleton's indicator which is responsible for its color and animation.
 *
 * @cssproperty [--border-radius=var(--sl-border-radius-pill)] - The skeleton's border radius.
 * @cssproperty [--color=var(--sl-color-neutral-200)] - The color of the skeleton.
 * @cssproperty [--sheen-color=var(--sl-color-neutral-300)] - The sheen color when the skeleton is in its loading state.
 */
export class VelcroSkeleton extends CoreSkeleton {
  // Core's own skeleton styles (a bordered, hidden-overflow host and `.skeleton` rules that would collide with the
  // Shoelace class names) are dropped on purpose; only the styles shared by every Charm element are kept.
  public static override styles = [...(Object.getPrototypeOf(CoreSkeleton) as typeof CoreSkeleton).styles, styles];

  /** Determines which effect the skeleton will use. */
  @property()
  public effect: 'pulse' | 'sheen' | 'none' = 'none';

  // Core renders a `skeleton-base` part with `aria-busy` and `aria-live` and is driven by `shape` and `animation`.
  // Shoelace's contract is a `base` part around an `indicator` part, driven by `effect`, with no ARIA attributes, so
  // the template is replaced. Core's `shape` and `animation` properties are still declared but are not used.
  protected override skeletonTemplate() {
    return html`
      <div
        part="base"
        class=${classMap({
          skeleton: true,
          'skeleton--pulse': this.effect === 'pulse',
          'skeleton--sheen': this.effect === 'sheen',
        })}
      >
        <div part="indicator" class="skeleton__indicator"></div>
      </div>
    `;
  }
}

export default VelcroSkeleton;
