// Adapted from Shoelace v2.20.1 (src/components/button/button.component.ts and the reflected-property restore in
// src/internal/shoelace-element.ts), Copyright (c) 2020 A Beautiful Site, LLC, MIT License. See THIRD_PARTY_NOTICES.md.
// The API documentation wording, the rendered structure (a `base` <button> or <a> with `button` / `button--*` class names
// around the prefix, label and suffix slots, caret and spinner), the form participation and the validation API follow
// Shoelace. Velcro changes: built on the @charm-ux/core button (core-only extras are kept, see the class comment),
// and the caret is an inline svg instead of an sl-icon.
import { type PropertyValues } from 'lit';
import { html, literal } from 'lit/static-html.js';
import { property, query } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { CharmElement } from '@charm-ux/core/dist/base/charm-element/charm-element.js';
import { CoreButton } from '@charm-ux/core/dist/components/button/button.js';
import { HasSlotController } from '@charm-ux/core/dist/controller/index.js';
import { FormControlController, validValidityState } from '../../internal/form.js';
import { LocalizeController } from '../../internal/localize.js';
import styles from './button.styles.js';

/**
 * Buttons represent actions that are available to the user.
 *
 * Velcro extensions inherited from the core button and kept working: `toggle` / `pressed` (an aria-pressed toggle that
 * emits `change`), `expanded` and `current` (aria-expanded / aria-current), `autofocus`, `referrerpolicy` on links, and
 * `shows` / `hides` / `toggles`. The core `icon-only` and `allow-wrap` attributes are accepted but have no effect.
 *
 * @tag sl-button
 * @status prototype
 *
 * @event sl-blur - Emitted when the button loses focus.
 * @event sl-focus - Emitted when the button gains focus.
 * @event sl-invalid - Emitted when the form control has been checked for validity and its constraints aren't satisfied.
 *
 * @slot - The button's label.
 * @slot prefix - A presentational prefix icon or similar element.
 * @slot suffix - A presentational suffix icon or similar element.
 *
 * @csspart base - The component's base wrapper.
 * @csspart button-control - The inner native button or link (core's part name; it also carries `base`).
 * @csspart prefix - The container that wraps the prefix.
 * @csspart label - The button's label.
 * @csspart suffix - The container that wraps the suffix.
 * @csspart caret - The button's caret icon, a `<span>` around an inline svg (an `<sl-icon>` in Shoelace).
 * @csspart spinner - The spinner that shows when the button is in the loading state.
 */
export class VelcroButton extends CoreButton {
  public static override styles = [...CharmElement.styles, styles];

  // Shoelace's button is not form-associated: the form is found from `form` / the closest <form>, and submission goes
  // through a temporary native button. Core's ElementInternals association is switched off so the host does not join
  // `form.elements` or follow a disabled fieldset, which Shoelace's button does not do either.
  protected static override formAssociated = false;

  private readonly formControlController = new FormControlController(this, {
    assumeInteractionOn: ['click'],
    submitsOnlyAsSubmitter: true,
  });
  private readonly hasSlotController = new HasSlotController(this, '[default]', 'prefix', 'suffix');
  private readonly localize = new LocalizeController(this);

  // Focus events come from the inner control (bound in the template), as in Shoelace, not from core's host listeners.
  protected override useBlurHandler = false;
  protected override useFocusHandler = false;

  /** The rendered native `<button>`, or `<a>` when `href` is set. */
  @query('.button')
  public button!: HTMLButtonElement | HTMLAnchorElement;

  // Shoelace restores a reflected property's initial value when its attribute is removed (see attributeChangedCallback).
  private hasRecordedInitialProperties = false;
  private readonly initialReflectedProperties = new Map<string, unknown>();

  /** Passed through to the inner control; an empty title also hides the browser's validation tooltip on hover. */
  @property()
  public override title = '';

  /** The button's theme variant. */
  @property({ reflect: true })
  public variant: 'default' | 'primary' | 'success' | 'neutral' | 'warning' | 'danger' | 'text' = 'default';

  /** The button's size. */
  @property({ reflect: true })
  public size: 'small' | 'medium' | 'large' = 'medium';

  /** Draws the button with a caret. Used to indicate that the button triggers a dropdown menu or similar behavior. */
  @property({ type: Boolean, reflect: true })
  public caret = false;

  /** Disables the button. */
  @property({ type: Boolean, reflect: true })
  public override disabled = false;

  /** Draws the button in a loading state. */
  @property({ type: Boolean, reflect: true })
  public loading = false;

  /** Draws an outlined button. */
  @property({ type: Boolean, reflect: true })
  public outline = false;

  /** Draws a pill-style button with rounded edges. */
  @property({ type: Boolean, reflect: true })
  public pill = false;

  /**
   * Draws a circular icon button. When this attribute is present, the button expects a single icon element in the
   * default slot.
   */
  @property({ type: Boolean, reflect: true })
  public circle = false;

  /**
   * The type of button. Note that the default value is `button` instead of `submit`, which is opposite of how native
   * `<button>` elements behave. When the type is `submit`, the button will submit the surrounding form.
   */
  @property()
  public override type: 'button' | 'submit' | 'reset' = 'button';

  /**
   * The name of the button, submitted as a name/value pair with form data, but only when this button is the submitter.
   * This attribute is ignored when `href` is present.
   */
  @property()
  public override name = '';

  /**
   * The value of the button, submitted as a pair with the button's name as part of the form data, but only when this
   * button is the submitter. This attribute is ignored when `href` is present.
   */
  @property()
  public override value = '';

  /** When set, the underlying button will be rendered as an `<a>` with this `href` instead of a `<button>`. */
  @property()
  public override href = '';

  /** Tells the browser where to open the link. Only used when `href` is present. */
  @property()
  public override target!: '_blank' | '_parent' | '_self' | '_top';

  /**
   * When using `href`, this attribute will map to the underlying link's `rel` attribute. Unlike regular links, the
   * default is `noreferrer noopener` to prevent security exploits. However, if you're using `target` to point to a
   * specific tab/window, this will prevent that from working correctly. You can remove or change the default value by
   * setting the attribute to an empty string or a value of your choice, respectively.
   */
  @property()
  public rel = 'noreferrer noopener';

  /** Tells the browser to download the linked file as this filename. Only used when `href` is present. */
  @property()
  public override download?: string;

  /**
   * The "form owner" to associate the button with. If omitted, the closest containing form will be used instead. The
   * value of this attribute must be an id of a form in the same document or shadow root as the button.
   */
  @property()
  public form!: string;

  /** Used to override the form owner's `action` attribute. */
  @property({ attribute: 'formaction' })
  public formAction!: string;

  /** Used to override the form owner's `enctype` attribute. */
  @property({ attribute: 'formenctype' })
  public formEnctype!: 'application/x-www-form-urlencoded' | 'multipart/form-data' | 'text/plain';

  /** Used to override the form owner's `method` attribute. */
  @property({ attribute: 'formmethod' })
  public formMethod!: 'post' | 'get';

  /** Used to override the form owner's `novalidate` attribute. */
  @property({ attribute: 'formnovalidate', type: Boolean })
  public formNoValidate!: boolean;

  /** Used to override the form owner's `target` attribute. */
  @property({ attribute: 'formtarget' })
  public formTarget!: '_self' | '_blank' | '_parent' | '_top' | string;

  /** Gets the validity state object. */
  public get validity() {
    if (this.isButton() && this.button) {
      return (this.button as HTMLButtonElement).validity;
    }
    return validValidityState;
  }

  /** Gets the validation message. */
  public get validationMessage() {
    if (this.isButton() && this.button) {
      return (this.button as HTMLButtonElement).validationMessage;
    }
    return '';
  }

  // Records the reflected properties' values the first time any attribute changes (during upgrade, before the
  // attribute values are applied), so that removing a reflected attribute later restores that value instead of
  // leaving the property null. Same timing and rule as Shoelace's base element.
  public override attributeChangedCallback(name: string, previous: string | null, next: string | null) {
    if (!this.hasRecordedInitialProperties) {
      (this.constructor as typeof VelcroButton).elementProperties.forEach((options, prop) => {
        const current = (this as unknown as Record<PropertyKey, unknown>)[prop];
        if (options.reflect && current != null) {
          this.initialReflectedProperties.set(prop as string, current);
        }
      });
      this.hasRecordedInitialProperties = true;
    }
    super.attributeChangedCallback(name, previous, next);
  }

  protected override willUpdate(changed: PropertyValues<this>) {
    super.willUpdate(changed);
    this.initialReflectedProperties.forEach((value, prop) => {
      const self = this as unknown as Record<string, unknown>;
      if (changed.has(prop as keyof VelcroButton) && self[prop] == null) {
        self[prop] = value;
      }
    });
  }

  protected override update(changed: PropertyValues<this>) {
    // Shoelace's `@watch('disabled', { waitUntilFirstUpdate: true })`: runs before render; the controller's
    // hostUpdated() then sets the data attributes from the real validity.
    if (this.hasUpdated && changed.has('disabled') && changed.get('disabled') !== this.disabled && this.isButton()) {
      this.formControlController.setValidity(this.disabled);
    }
    super.update(changed);
  }

  protected override firstUpdated() {
    super.firstUpdated();
    if (this.isButton()) {
      this.formControlController.updateValidity();
    }
  }

  protected override handleBlur() {
    this.hasFocus = false;
    this.emit('sl-blur');
  }

  protected override handleFocus() {
    this.hasFocus = true;
    this.emit('sl-focus');
  }

  // As in Shoelace there is no disabled guard: a disabled native button never fires a click, and a disabled link
  // renders without href, so its click reaches host listeners but does not navigate.
  protected override handleClick() {
    // Core's toggle-button extension: a `toggle` button flips `pressed` and emits `change` instead of acting on a form.
    if (!this.href && this.toggle) {
      this.pressed = !this.pressed;
      this.emit('change');
      return;
    }
    if (this.type === 'submit') {
      this.formControlController.submit(this);
    }
    if (this.type === 'reset') {
      this.formControlController.reset(this);
    }
  }

  private handleInvalid = (event: Event) => {
    this.formControlController.setValidity(false);
    this.formControlController.emitInvalidEvent(event);
  };

  private isButton() {
    return !this.href;
  }

  private isLink() {
    return Boolean(this.href);
  }

  /**
   * Simulates a click on the button. As in Shoelace, once rendered it always activates the inner native button or link
   * exactly once: a disabled native button ignores it, a disabled link's click reaches host listeners without
   * navigating, and a host `preventDefault()` cancels a link's default action.
   */
  public override click(): void {
    if (this.button) {
      this.button.click();
      return;
    }
    super.click();
  }

  /** Sets focus on the button. */
  public override focus(options?: FocusOptions) {
    if (this.button) {
      this.button.focus(options);
      return;
    }
    super.focus(options);
  }

  /** Removes focus from the button. */
  public override blur() {
    if (this.button) {
      this.button.blur();
      return;
    }
    super.blur();
  }

  /** Checks for validity but does not show a validation message. Returns `true` when valid and `false` when invalid. */
  public checkValidity() {
    if (this.isButton() && this.button) {
      return (this.button as HTMLButtonElement).checkValidity();
    }
    return true;
  }

  /** Gets the associated form, if one exists. */
  public getForm(): HTMLFormElement | null {
    return this.formControlController.getForm();
  }

  /** Checks for validity and shows the browser's validation message if the control is invalid. */
  public reportValidity() {
    if (this.isButton() && this.button) {
      return (this.button as HTMLButtonElement).reportValidity();
    }
    return true;
  }

  /** Sets a custom validation message. Pass an empty string to restore validity. */
  public setCustomValidity(message: string) {
    if (this.isButton() && this.button) {
      (this.button as HTMLButtonElement).setCustomValidity(message);
      this.formControlController.updateValidity();
    }
  }

  protected override render() {
    const isLink = this.isLink();
    const tag = isLink ? literal`a` : literal`button`;
    /* eslint-disable lit/no-invalid-html, lit/binding-positions */
    return html`
      <${tag}
        part="base button-control"
        class=${classMap({
          button: true,
          'button--default': this.variant === 'default',
          'button--primary': this.variant === 'primary',
          'button--success': this.variant === 'success',
          'button--neutral': this.variant === 'neutral',
          'button--warning': this.variant === 'warning',
          'button--danger': this.variant === 'danger',
          'button--text': this.variant === 'text',
          'button--small': this.size === 'small',
          'button--medium': this.size === 'medium',
          'button--large': this.size === 'large',
          'button--caret': this.caret,
          'button--circle': this.circle,
          'button--disabled': this.disabled,
          'button--focused': this.hasFocus,
          'button--loading': this.loading,
          'button--standard': !this.outline,
          'button--outline': this.outline,
          'button--pill': this.pill,
          'button--rtl': this.localize.dir() === 'rtl',
          'button--has-label': this.hasSlotController.test('[default]'),
          'button--has-prefix': this.hasSlotController.test('prefix'),
          'button--has-suffix': this.hasSlotController.test('suffix'),
        })}
        ?disabled=${ifDefined(isLink ? undefined : this.disabled)}
        type=${ifDefined(isLink ? undefined : this.type)}
        title=${this.title}
        name=${ifDefined(isLink ? undefined : this.name)}
        value=${ifDefined(isLink ? undefined : this.value)}
        href=${ifDefined(isLink && !this.disabled ? this.href : undefined)}
        target=${ifDefined(isLink ? this.target : undefined)}
        download=${ifDefined(isLink ? this.download : undefined)}
        rel=${ifDefined(isLink ? this.rel : undefined)}
        referrerpolicy=${ifDefined(isLink ? this.referrerPolicy : undefined)}
        role=${ifDefined(isLink ? undefined : 'button')}
        aria-disabled=${this.disabled ? 'true' : 'false'}
        aria-current=${ifDefined(this.current ?? undefined)}
        aria-expanded=${ifDefined(!isLink && this.expanded !== undefined ? String(this.expanded) : undefined)}
        aria-pressed=${ifDefined(!isLink && this.pressed !== undefined ? String(this.pressed) : undefined)}
        tabindex=${this.disabled ? '-1' : '0'}
        ?autofocus=${this.autofocus}
        @blur=${this.handleBlur}
        @focus=${this.handleFocus}
        @invalid=${this.isButton() ? this.handleInvalid : null}
        @click=${this.handleClick}
      >
        <slot name="prefix" part="prefix" class="button__prefix"></slot>
        <slot part="label" class="button__label"></slot>
        <slot name="suffix" part="suffix" class="button__suffix"></slot>
        ${this.caret
          ? html`<span part="caret" class="button__caret" aria-hidden="true"
              ><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="6 9 12 15 18 9"></polyline></svg
            ></span>`
          : ''}
        ${this.loading ? html`<sl-spinner part="spinner"></sl-spinner>` : ''}
      </${tag}>
    `;
    /* eslint-enable lit/no-invalid-html, lit/binding-positions */
  }
}

export default VelcroButton;
