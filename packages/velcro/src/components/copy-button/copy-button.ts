// Adapted from Shoelace v2.20.1 (src/components/copy-button/copy-button.component.ts and the reflected-property restore
// in src/internal/shoelace-element.ts), Copyright (c) 2020 A Beautiful Site, LLC, MIT License. See
// THIRD_PARTY_NOTICES.md.
// The API documentation wording, the rendered structure (an `<sl-tooltip>` around a `<button part="button">` that holds
// the `copy-icon`, `success-icon` and `error-icon` slots with their default `<sl-icon>` fallbacks), the `from` lookup
// (id, `id[attribute]`, `id.property`), the Clipboard API call, the `sl-copy` / `sl-error` events and the feedback
// animations with their registry defaults follow Shoelace, including its quirks (listed on the docs page). Velcro
// changes: built on the @charm-ux/core base element (there is no core copy button), and the dependencies on
// <sl-icon> and <sl-tooltip> are defined when a copy button is constructed rather than through Shoelace's
// `static dependencies` (see the class).
import { html, type PropertyValues } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { CharmElement } from '@charm-ux/core/dist/base/charm-element/charm-element.js';
import { ShoelaceCompat, restoreReflectedProperties } from '../../internal/shoelace-compat.js';
import { getAnimation, setDefaultAnimation } from '../../utilities/animation-registry.js';
import { LocalizeController } from '../../utilities/localize.js';
import { defineVelcroComponent, type VelcroComponentConstructor } from '../../utilities/registration.js';
import { VelcroIcon } from '../icon/class.js';
import { VelcroTooltip } from '../tooltip/class.js';
import styles from './copy-button.styles.js';

/**
 * Copies text data to the clipboard when the user clicks the trigger. API modelled on Shoelace's `sl-copy-button`. There is
 * no core counterpart, so it extends the core base element. It renders an `<sl-tooltip>` and, for the default icons,
 * `<sl-icon>`, as in Shoelace; like Shoelace's, constructing a copy button defines Velcro's `<sl-icon>` and `<sl-tooltip>`
 * when no element owns those tags yet (and constructing a tooltip defines `<sl-popup>`), so the class-only entry needs no
 * extra step. The feedback animations come from the animation registry (`copy.in` and `copy.out`); change them with
 * `setAnimation()` or `setDefaultAnimation()` from `@charm-ux/velcro/utilities/animation-registry`. The labels default to
 * the localization module's `copy`, `copied` and `error` terms.
 *
 * Velcro extension inherited from the core base element and kept: the non-bubbling `ready` event, emitted on the first
 * update. Shoelace's copy button does not emit it.
 *
 * @property {string} lang - The element's language, as set by the `lang` attribute or property. Not reflected.
 *
 * @tag sl-copy-button
 * @status prototype
 *
 * @dependency sl-icon
 * @dependency sl-tooltip
 *
 * @event {{ value: string }} sl-copy - Emitted when the data has been copied. `detail.value` is the text that was copied.
 * @event sl-error - Emitted when the data could not be copied.
 *
 * @slot copy-icon - The icon to show in the default copy state. Works best with `<sl-icon>`.
 * @slot success-icon - The icon to show when the content is copied. Works best with `<sl-icon>`.
 * @slot error-icon - The icon to show when a copy error occurs. Works best with `<sl-icon>`.
 *
 * @csspart button - The internal `<button>` element.
 * @csspart copy-icon - The container that holds the copy icon.
 * @csspart success-icon - The container that holds the success icon.
 * @csspart error-icon - The container that holds the error icon.
 * @csspart tooltip__base - The tooltip's exported `base` part.
 * @csspart tooltip__base__popup - The tooltip's exported `popup` part.
 * @csspart tooltip__base__arrow - The tooltip's exported `arrow` part.
 * @csspart tooltip__body - The tooltip's exported `body` part.
 *
 * @cssproperty --success-color - The color to use for success feedback.
 * @cssproperty --error-color - The color to use for error feedback.
 *
 * @animation copy.in - The animation to use when feedback icons animate in.
 * @animation copy.out - The animation to use when feedback icons animate out.
 */
export class VelcroCopyButton extends ShoelaceCompat(CharmElement, { lang: true, dir: true, reflected: 'read-all' }) {
  public static override baseName = 'copy-button';

  // The core base styles are replaced by Shoelace's own (see the styles file). Core's add a `:host([hidden]) { display:
  // none !important }` rule, focus outlines and form-control resets that Shoelace's copy button does not have.
  public static override styles = [styles];

  // Shoelace's `static dependencies` for the copy button: the elements its template renders. Shoelace keys them by tag;
  // here the tag is derived from each class's `baseName` (`sl-icon` for `VelcroIcon`, `sl-tooltip` for `VelcroTooltip`),
  // the same tag `defineVelcroComponent` defines and the template renders. As in Shoelace's base element, each one that
  // is not defined yet is defined when a copy button is constructed, and a tag that another constructor already owns is
  // left alone (with Shoelace's warning when the versions differ). If the platform refuses the class itself (for example
  // because it is already registered under another tag), an anonymous subclass is defined instead, as Shoelace does. The
  // tooltip in turn defines `<sl-popup>` when it is constructed. Core's own array-typed `dependencies` (registration in
  // core's scope) stays empty. Not part of the documented API (Shoelace's manifest lists `dependencies` without a
  // description).
  private static readonly shoelaceDependencies: readonly VelcroComponentConstructor[] = [VelcroIcon, VelcroTooltip];

  public constructor() {
    super();
    for (const component of VelcroCopyButton.shoelaceDependencies) defineVelcroComponent(component);
  }

  private readonly localize = new LocalizeController(this);

  @query('slot[name="copy-icon"]')
  public copyIcon!: HTMLSlotElement;

  @query('slot[name="success-icon"]')
  public successIcon!: HTMLSlotElement;

  @query('slot[name="error-icon"]')
  public errorIcon!: HTMLSlotElement;

  @query('sl-tooltip')
  public tooltip!: VelcroTooltip;

  @state()
  public isCopying = false;

  @state()
  public status: 'rest' | 'success' | 'error' = 'rest';

  /**
   * The element's text direction, as set by the `dir` attribute or property and returned as set. Not reflected. Any
   * string can be assigned; the declared read type stays core's `'ltr' | 'rtl' | 'auto'`.
   */
  @property()
  public override get dir(): 'ltr' | 'rtl' | 'auto' {
    return super.dir;
  }
  public override set dir(value: string) {
    super.dir = value as 'ltr' | 'rtl' | 'auto';
  }

  /** The text value to copy. */
  @property()
  public value = '';

  /**
   * An id that references an element in the same document from which data will be copied. If both this and `value` are
   * present, this value will take precedence. By default, the target element's `textContent` will be copied. To copy an
   * attribute, append the attribute name wrapped in square brackets, e.g. `from="el[value]"`. To copy a property,
   * append a dot and the property name, e.g. `from="el.value"`.
   */
  @property()
  public from = '';

  /** Disables the copy button. */
  @property({ type: Boolean, reflect: true })
  public disabled = false;

  /** A custom label to show in the tooltip. */
  @property({ attribute: 'copy-label' })
  public copyLabel = '';

  /** A custom label to show in the tooltip after copying. */
  @property({ attribute: 'success-label' })
  public successLabel = '';

  /** A custom label to show in the tooltip when a copy error occurs. */
  @property({ attribute: 'error-label' })
  public errorLabel = '';

  /** The length of time to show feedback before restoring the default trigger. */
  @property({ attribute: 'feedback-duration', type: Number })
  public feedbackDuration = 1000;

  /** The preferred placement of the tooltip. */
  @property({ attribute: 'tooltip-placement' })
  public tooltipPlacement: 'top' | 'right' | 'bottom' | 'left' = 'top';

  /**
   * Enable this option to prevent the tooltip from being clipped when the component is placed inside a container with
   * `overflow: auto|hidden|scroll`. Hoisting uses a fixed positioning strategy that works in many, but not all,
   * scenarios.
   */
  @property({ type: Boolean })
  public hoist = false;

  protected override willUpdate(changed: PropertyValues<this>) {
    super.willUpdate(changed);
    restoreReflectedProperties(this, changed);
  }

  private async handleCopy() {
    if (this.disabled || this.isCopying) {
      return;
    }
    this.isCopying = true;

    // Copy the value by default
    let valueToCopy = this.value;

    // If an element is specified, copy from that instead
    if (this.from) {
      const root = this.getRootNode() as ShadowRoot | Document;

      // Simple way to parse ids, properties, and attributes
      const isProperty = this.from.includes('.');
      const isAttribute = this.from.includes('[') && this.from.includes(']');
      let id = this.from;
      let field = '';

      if (isProperty) {
        // Split at the dot
        [id, field] = this.from.trim().split('.');
      } else if (isAttribute) {
        // Trim the ] and split at the [
        [id, field] = this.from.trim().replace(/\]$/, '').split('[');
      }

      // Locate the target element by id
      const target = 'getElementById' in root ? root.getElementById(id) : null;

      if (target) {
        if (isAttribute) {
          valueToCopy = target.getAttribute(field) || '';
        } else if (isProperty) {
          valueToCopy = (target as unknown as Record<string, string>)[field] || '';
        } else {
          valueToCopy = target.textContent || '';
        }
      } else {
        // No target
        void this.showStatus('error');
        this.emit('sl-error');
      }
    }

    // No value
    if (!valueToCopy) {
      void this.showStatus('error');
      this.emit('sl-error');
    } else {
      try {
        await navigator.clipboard.writeText(valueToCopy);
        void this.showStatus('success');
        this.emit('sl-copy', {
          detail: {
            value: valueToCopy,
          },
        });
      } catch {
        // Rejected by browser
        void this.showStatus('error');
        this.emit('sl-error');
      }
    }
  }

  private async showStatus(status: 'success' | 'error') {
    const copyLabel = this.copyLabel || this.localize.term('copy');
    const successLabel = this.successLabel || this.localize.term('copied');
    const errorLabel = this.errorLabel || this.localize.term('error');
    const iconToShow = status === 'success' ? this.successIcon : this.errorIcon;
    const showAnimation = getAnimation(this, 'copy.in', { dir: 'ltr' });
    const hideAnimation = getAnimation(this, 'copy.out', { dir: 'ltr' });

    this.tooltip.content = status === 'success' ? successLabel : errorLabel;

    // Show the feedback icon
    await this.copyIcon.animate(hideAnimation.keyframes, hideAnimation.options).finished;
    this.copyIcon.hidden = true;
    this.status = status;
    iconToShow.hidden = false;
    await iconToShow.animate(showAnimation.keyframes, showAnimation.options).finished;

    // After a brief delay, restore the original state
    setTimeout(async () => {
      await iconToShow.animate(hideAnimation.keyframes, hideAnimation.options).finished;
      iconToShow.hidden = true;
      this.status = 'rest';
      this.copyIcon.hidden = false;
      await this.copyIcon.animate(showAnimation.keyframes, showAnimation.options).finished;

      this.tooltip.content = copyLabel;
      this.isCopying = false;
    }, this.feedbackDuration);
  }

  protected override render() {
    const copyLabel = this.copyLabel || this.localize.term('copy');

    return html`
      <sl-tooltip
        class=${classMap({
          'copy-button': true,
          'copy-button--success': this.status === 'success',
          'copy-button--error': this.status === 'error',
        })}
        content=${copyLabel}
        placement=${this.tooltipPlacement}
        ?disabled=${this.disabled}
        ?hoist=${this.hoist}
        exportparts="
          base:tooltip__base,
          base__popup:tooltip__base__popup,
          base__arrow:tooltip__base__arrow,
          body:tooltip__body
        "
      >
        <button
          class="copy-button__button"
          part="button"
          type="button"
          ?disabled=${this.disabled}
          @click=${this.handleCopy}
        >
          <slot part="copy-icon" name="copy-icon">
            <sl-icon library="system" name="copy"></sl-icon>
          </slot>
          <slot part="success-icon" name="success-icon" hidden>
            <sl-icon library="system" name="check"></sl-icon>
          </slot>
          <slot part="error-icon" name="error-icon" hidden>
            <sl-icon library="system" name="x-lg"></sl-icon>
          </slot>
        </button>
      </sl-tooltip>
    `;
  }
}

setDefaultAnimation('copy.in', {
  keyframes: [
    { scale: '.25', opacity: '.25' },
    { scale: '1', opacity: '1' },
  ],
  options: { duration: 100 },
});

setDefaultAnimation('copy.out', {
  keyframes: [
    { scale: '1', opacity: '1' },
    { scale: '.25', opacity: '0' },
  ],
  options: { duration: 100 },
});

export default VelcroCopyButton;
