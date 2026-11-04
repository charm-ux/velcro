// Portions of the API documentation wording in this file are adapted from Shoelace v2.20.1
// (src/components/button/button.component.ts), Copyright (c) 2020 A Beautiful Site, LLC, MIT License.
// See THIRD_PARTY_NOTICES.md. The implementation itself is not copied from Shoelace.
import { html, type PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import { CoreButton } from '@charm-ux/core/dist/components/button/button.js';
import styles from './button.styles.js';

/**
 * Buttons represent actions that are available to the user. API modelled on Shoelace's `sl-button`.
 *
 * @tag sl-button
 * @status prototype
 *
 * @event sl-focus - Emitted when the button gains focus.
 * @event sl-blur - Emitted when the button loses focus.
 *
 * @slot - The button's label.
 * @slot prefix - A presentational prefix icon or similar element.
 * @slot suffix - A presentational suffix icon or similar element.
 *
 * @csspart base - The component's base wrapper.
 * @csspart prefix - The container that wraps the prefix.
 * @csspart label - The button's label.
 * @csspart suffix - The container that wraps the suffix.
 * @csspart caret - The container that wraps the caret icon.
 * @csspart spinner - The spinner shown while `loading`.
 */
export class VelcroButton extends CoreButton {
  public static override styles = [...super.styles, styles];

  /** The button's theme variant. */
  @property({ reflect: true })
  public variant: 'default' | 'primary' | 'success' | 'neutral' | 'warning' | 'danger' | 'text' = 'default';

  /** The button's size. */
  @property({ reflect: true })
  public size: 'small' | 'medium' | 'large' = 'medium';

  /** Draws the button with a caret, used to indicate that the button triggers a dropdown menu or similar behavior. */
  @property({ type: Boolean, reflect: true })
  public caret = false;

  /** Draws the button in a loading state. */
  @property({ type: Boolean, reflect: true })
  public loading = false;

  /** Draws an outlined button. */
  @property({ type: Boolean, reflect: true })
  public outline = false;

  /** Draws a pill-style button with rounded edges. */
  @property({ type: Boolean, reflect: true })
  public pill = false;

  /** Draws a circular icon button. When this attribute is present, the button expects a single icon element in the default slot. */
  @property({ type: Boolean, reflect: true })
  public circle = false;

  /**
   * Programmatic `click()` does nothing while disabled, like a native disabled button. Once rendered it activates
   * the inner native button/link exactly once: that single composed click reaches host listeners, and a host
   * `preventDefault()` cancels the link's default action. (Core's `click()` instead dispatches a host click and then
   * separately clicks the link, which fires listeners twice and cannot be cancelled.)
   */
  public override click(): void {
    if (this.disabled) {
      return;
    }
    const control = this.shadowRoot?.querySelector<HTMLElement>('.control');
    if (control) {
      control.click();
      return;
    }
    super.click();
  }

  protected override handleFocus() {
    if (!this.hasFocus) {
      this.emit('sl-focus');
    }
    super.handleFocus();
  }

  protected override handleBlur() {
    if (this.hasFocus) {
      this.emit('sl-blur');
    }
    super.handleBlur();
  }

  protected override contentTemplate() {
    return html`
      <span part="prefix" class="prefix"><slot name="prefix"></slot></span>
      <span part="label" class="label"><slot></slot></span>
      <span part="suffix" class="suffix"><slot name="suffix"></slot></span>
      ${this.caret
        ? html`<span part="caret" class="caret">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="m6 9 6 6 6-6"></path>
            </svg>
          </span>`
        : ''}
      ${this.loading ? html`<span part="spinner" class="spinner" role="status" aria-label="Loading"></span>` : ''}
    `;
  }

  protected override updated(changed: PropertyValues<this>) {
    super.updated(changed);
    // Core's template owns `part` and cannot be extended without copying it, so add Shoelace's `base` part
    // and a native `disabled` (not focusable, like sl-button) on the inner control after render.
    const control = this.shadowRoot?.querySelector('.control');
    if (control) {
      control.setAttribute('part', 'button-control base');
      control.toggleAttribute('disabled', !this.href && Boolean(this.disabled));
    }
  }
}

export default VelcroButton;
