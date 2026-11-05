// Portions of the API documentation wording in this file and the behavior (host `role="separator"`, and
// `aria-orientation` kept in sync with `vertical`) are adapted from Shoelace v2.20.1
// (src/components/divider/divider.component.ts), Copyright (c) 2020 A Beautiful Site, LLC, MIT License.
// See THIRD_PARTY_NOTICES.md. No Shoelace source file or runtime is included.
import { html, type PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import { CoreDivider } from '@charm-ux/core/dist/components/divider/divider.js';
import styles from './divider.styles.js';

/**
 * Dividers are used to visually separate or group elements. API modelled on Shoelace's `sl-divider`.
 *
 * @tag sl-divider
 * @status prototype
 *
 * @cssproperty [--color=var(--sl-panel-border-color)] - The color of the divider.
 * @cssproperty [--width=var(--sl-panel-border-width)] - The width of the divider.
 * @cssproperty [--spacing=var(--sl-spacing-medium)] - The spacing of the divider.
 */
export class VelcroDivider extends CoreDivider {
  public static override styles = [...super.styles, styles];

  /** Draws the divider in a vertical orientation. */
  @property({ type: Boolean, reflect: true })
  public vertical = false;

  // What is reused from core: the CharmElement base (scoping attribute, `dir`, the `ready` event), the `baseName`
  // used for registration, the shared base styles (box-sizing, `[hidden]`) and `render()`. Core's markup (two line
  // spans, a content slot, `divider-*` parts) and its `orientation`-driven role handling are replaced because
  // Shoelace's divider is a single host element drawn with a border, has no slot or parts, and is switched with the
  // boolean `vertical`. Core's `orientation`, `presentation`, `inset` and `align-content` stay declared but have no
  // effect on this element (the styles neutralize core's rules for them).
  protected override dividerTemplate() {
    return html``;
  }

  public override connectedCallback() {
    super.connectedCallback();
    this.setAttribute('role', 'separator');
  }

  // Intentionally does not call `super.willUpdate`: core would derive `role` and `aria-orientation` from
  // `orientation` / `presentation`, which are not part of this element's contract.
  protected override willUpdate(changedProperties: PropertyValues<this>) {
    if (changedProperties.has('vertical')) {
      this.setAttribute('aria-orientation', this.vertical ? 'vertical' : 'horizontal');
    }
  }
}

export default VelcroDivider;
