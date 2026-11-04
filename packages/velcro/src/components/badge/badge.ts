// Portions of the API documentation wording in this file and the rendered structure (a `span` with the `base` part,
// `role="status"` and the `badge` / `badge--*` class names around a default slot) are adapted from Shoelace v2.20.1
// (src/components/badge/badge.component.ts), Copyright (c) 2020 A Beautiful Site, LLC, MIT License.
// See THIRD_PARTY_NOTICES.md. No Shoelace source file or runtime is included.
import { html } from 'lit';
import { property } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { CoreBadge } from '@charm-ux/core/dist/components/badge/badge.js';
import styles from './badge.styles.js';

/**
 * Badges are used to draw attention and display statuses or counts. API modelled on Shoelace's `sl-badge`.
 *
 * @tag sl-badge
 * @status prototype
 *
 * @slot - The badge's content.
 *
 * @csspart base - The component's base wrapper.
 */
export class VelcroBadge extends CoreBadge {
  public static override styles = [...super.styles, styles];

  /** The badge's theme variant. */
  @property({ reflect: true })
  public variant: 'primary' | 'success' | 'neutral' | 'warning' | 'danger' = 'primary';

  /** Draws a pill-style badge with rounded edges. */
  @property({ type: Boolean, reflect: true })
  public pill = false;

  /** Makes the badge pulsate to draw attention. */
  @property({ type: Boolean, reflect: true })
  public pulse = false;

  // What is reused from core: the CharmElement base (scoping attribute, `dir`, the `ready` event), the `baseName`
  // used for registration, the shared base styles (box-sizing, `[hidden]`) and `render()`, which delegates to this
  // hook. Core's own markup (`.base` / part `badge-base`, sized by `--badge-*` properties with a 20px minimum) is
  // replaced because Shoelace's contract is a differently named `base` part with `role="status"`, content-sized
  // padding and variant classes; keeping core's markup would leave two competing parts and sizing models.
  protected override badgeTemplate() {
    return html`
      <span
        part="base"
        class=${classMap({
          badge: true,
          'badge--primary': this.variant === 'primary',
          'badge--success': this.variant === 'success',
          'badge--neutral': this.variant === 'neutral',
          'badge--warning': this.variant === 'warning',
          'badge--danger': this.variant === 'danger',
          'badge--pill': this.pill,
          'badge--pulse': this.pulse,
        })}
        role="status"
      >
        <slot></slot>
      </span>
    `;
  }
}

export default VelcroBadge;
