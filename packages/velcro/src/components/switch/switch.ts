// Adapted from Shoelace v2.20.1 (src/components/switch/switch.component.ts, the `defaultValue` decorator in
// src/internal/default-value.ts and the reflected-property restore in src/internal/shoelace-element.ts), Copyright (c)
// 2020 A Beautiful Site, LLC, MIT License. See THIRD_PARTY_NOTICES.md.
// The API documentation wording, the rendered structure (a `base` <label> around a hidden checkbox with role="switch",
// the `control` / `thumb` track and the `label` slot, then the help text), the events, keyboard handling and the form
// participation and validation API follow Shoelace. Velcro changes: built on the @charm-ux/core switch through
// Velcro's local scope resolver (core-only extras are kept, see the class comment).
import { css, html, type PropertyValues } from 'lit';
import { property, query } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { live } from 'lit/directives/live.js';
import { CharmElement } from '@charm-ux/core/dist/base/charm-element/charm-element.js';
import { CharmFocusableElement } from '@charm-ux/core/dist/base/focusable-element/charm-focusable-element.js';
import { CoreSwitch } from '@charm-ux/core/dist/components/switch/switch.js';
import { HasSlotController } from '@charm-ux/core/dist/controller/index.js';
import { FormControlController } from '../../internal/form.js';
import { useVelcroScope } from '../../internal/scope.js';
import styles from './switch.styles.js';

/**
 * Switches allow the user to toggle an option on or off.
 *
 * Velcro extensions inherited from the core switch and kept working: `readonly` (the switch keeps its state on click and
 * arrow keys), `label` (label text shown when the default slot is empty), `hide-label` (visually hides the label and
 * help text, which stay accessible), `error-message` (sets a custom validity message, like `setCustomValidity()`; it is
 * not rendered) and `autofocus` (passed to the inner checkbox). The core `invalid` and `label-position` properties are
 * accepted but have no effect (use `data-invalid`, as in Shoelace). As with every Velcro form control the host carries
 * core's `focusable` attribute.
 *
 * @tag sl-switch
 * @status prototype
 *
 * @slot - The switch's label.
 * @slot help-text - Text that describes how to use the switch. Alternatively, you can use the `help-text` attribute.
 *
 * @event sl-blur - Emitted when the control loses focus.
 * @event sl-change - Emitted when the control's checked state changes.
 * @event sl-input - Emitted when the control receives input.
 * @event sl-focus - Emitted when the control gains focus.
 * @event sl-invalid - Emitted when the form control has been checked for validity and its constraints aren't satisfied.
 *
 * @csspart base - The component's base wrapper.
 * @csspart control - The control that houses the switch's thumb.
 * @csspart thumb - The switch's thumb.
 * @csspart label - The switch's label.
 * @csspart form-control-help-text - The help text's wrapper.
 *
 * @cssproperty --width - The width of the switch.
 * @cssproperty --height - The height of the switch.
 * @cssproperty --thumb-size - The size of the thumb.
 */
export class VelcroSwitch extends CoreSwitch {
  // Only Shoelace's styles: core's base element styles would, for example, hide the host for the `hidden` attribute,
  // which Shoelace's switch does not do. The one Velcro rule visually hides the label and help text for `hide-label`.
  public static override styles = [
    styles,
    css`
      .visually-hidden:not(:focus):not(:focus-within) {
        position: absolute !important;
        width: 1px !important;
        height: 1px !important;
        clip: rect(0 0 0 0) !important;
        clip-path: inset(50%) !important;
        border: none !important;
        overflow: hidden !important;
        white-space: nowrap !important;
        padding: 0 !important;
      }
    `,
  ];

  // Shoelace's switch is not form-associated: the form is found from `form` / the closest <form> and the value is added
  // in its `formdata` event. Core's ElementInternals association is switched off so the host does not join
  // `form.elements`, submit core's form value or follow a disabled fieldset, which Shoelace's switch does not do either.
  protected static override formAssociated = false;

  // Core's error message template renders an icon; this template renders no other element.
  public static override get dependencies() {
    return [];
  }

  private readonly formControlController = new FormControlController(this, {
    value: control => ((control as VelcroSwitch).checked ? control.value || 'on' : undefined),
    defaultValue: control => (control as VelcroSwitch).defaultChecked,
    setValue: (control, checked) => {
      (control as VelcroSwitch).checked = checked as boolean;
    },
  });
  private readonly hasSlotController = new HasSlotController(this, 'help-text');

  // Focus and blur are handled on the inner checkbox, as in Shoelace, instead of core's host listeners.
  protected override useBlurHandler = false;
  protected override useFocusHandler = false;

  private hasRecordedInitialProperties = false;
  private readonly initialReflectedProperties = new Map<string, unknown>();
  private velcroValue?: string;
  private velcroDisabled = false;
  private velcroChecked = false;
  private velcroErrorMessage = '';

  @query('input[type="checkbox"]')
  public override input!: HTMLInputElement;

  @property()
  public override title = ''; // make reactive to pass through

  /** The name of the switch, submitted as a name/value pair with form data. */
  @property()
  public override name = '';

  /** The current value of the switch, submitted as a name/value pair with form data. */
  @property()
  public override get value(): string {
    return this.velcroValue as string;
  }
  public override set value(value: string) {
    this.velcroValue = value;
  }

  /** The switch's size. */
  @property({ reflect: true })
  public size: 'small' | 'medium' | 'large' = 'medium';

  /**
   * Disables the switch.
   * @default false
   */
  @property({ type: Boolean, reflect: true })
  public override get disabled(): boolean {
    return this.velcroDisabled;
  }
  public override set disabled(value: boolean) {
    this.velcroDisabled = value;
  }

  /**
   * Draws the switch in a checked state.
   * @default false
   */
  @property({ type: Boolean, reflect: true })
  public override get checked(): boolean {
    return this.velcroChecked;
  }
  public override set checked(value: boolean) {
    this.velcroChecked = value;
  }

  /** The default value of the form control. Primarily used for resetting the form control. */
  public defaultChecked = false;

  /**
   * By default, form controls are associated with the nearest containing `<form>` element. This attribute allows you
   * to place the form control outside of a form and associate it with the form that has this `id`. The form must be in
   * the same document or shadow root for this to work.
   */
  @property({ reflect: true })
  public form = '';

  /** Makes the switch a required field. */
  @property({ type: Boolean, reflect: true })
  public override required = false;

  /** The switch's help text. If you need to display HTML, use the `help-text` slot instead. */
  @property({ attribute: 'help-text' })
  public override helpText = '';

  /**
   * Velcro extension (core): a custom validity message, applied with `setCustomValidity()` after the next update. It
   * is not rendered. An empty string restores validity.
   * @default ''
   */
  @property({ attribute: 'error-message' })
  public override get errorMessage(): string {
    return this.velcroErrorMessage;
  }
  public override set errorMessage(message: string) {
    this.velcroErrorMessage = message ?? '';
  }

  /** Gets the validity state object */
  public override get validity() {
    return this.input.validity;
  }

  /** Gets the validation message */
  public override get validationMessage() {
    return this.input.validationMessage;
  }

  // Skips core's form-control connectedCallback, which writes ElementInternals form state that a non-form-associated
  // element cannot hold; core's focusable and base element setup still runs.
  public override connectedCallback() {
    CharmFocusableElement.prototype.connectedCallback.call(this);
  }

  // Records the reflected properties' values the first time any attribute changes (during upgrade, before the
  // attribute values are applied), so that removing a reflected attribute later restores that value instead of
  // leaving the property null. Same timing and rule as Shoelace's base element. A change of the `checked` attribute
  // also sets `defaultChecked`, as Shoelace's `defaultValue('checked')` decorator does.
  public override attributeChangedCallback(name: string, previous: string | null, next: string | null) {
    if (name === 'checked') {
      const checked = next !== null;
      if (this.checked !== checked) {
        this.defaultChecked = checked;
      }
    }
    if (!this.hasRecordedInitialProperties) {
      (this.constructor as typeof VelcroSwitch).elementProperties.forEach((options, prop) => {
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
      if (changed.has(prop as keyof VelcroSwitch) && self[prop] == null) {
        self[prop] = value;
      }
    });
  }

  protected override update(changed: PropertyValues<this>) {
    // Shoelace's `@watch` handlers with `waitUntilFirstUpdate: true` run before render.
    if (this.hasUpdated && changed.has('checked') && changed.get('checked') !== this.checked) {
      this.handleCheckedChange();
    }
    if (this.hasUpdated && changed.has('disabled') && changed.get('disabled') !== this.disabled) {
      this.handleDisabledChange();
    }
    super.update(changed);
  }

  // Skips core's form-control firstUpdated (ElementInternals validity); core's base element still emits `ready`.
  protected override firstUpdated() {
    (CharmElement.prototype as unknown as { firstUpdated(): void }).firstUpdated.call(this);
    this.formControlController.updateValidity();
  }

  protected override updated(changed: PropertyValues<this>) {
    super.updated(changed);
    if (changed.has('errorMessage')) {
      this.setCustomValidity(this.errorMessage);
    }
  }

  protected override handleBlur() {
    this.hasFocus = false;
    this.emit('sl-blur');
  }

  private handleInput() {
    this.emit('sl-input');
  }

  private handleInvalid(event: Event) {
    this.formControlController.setValidity(false);
    this.formControlController.emitInvalidEvent(event);
  }

  /** Toggles the switch from a click on the inner checkbox. A `readonly` switch keeps its state. */
  public override handleClick(event?: Event) {
    if (this.readonly) {
      event?.preventDefault();
      return;
    }
    this.checked = !this.checked;
    this.emit('sl-change');
  }

  protected override handleFocus() {
    this.hasFocus = true;
    this.emit('sl-focus');
  }

  /** ArrowLeft turns the switch off and ArrowRight turns it on; a `readonly` switch ignores both. */
  public override handleKeyDown(event: KeyboardEvent) {
    if (this.readonly) return;
    if (event.key === 'ArrowLeft') {
      this.handleArrowLeftKey(event);
    }
    if (event.key === 'ArrowRight') {
      this.handleArrowRightKey(event);
    }
  }

  /** Turns the switch off and emits `sl-change` and `sl-input`. */
  public override handleArrowLeftKey(event: KeyboardEvent) {
    event.preventDefault();
    this.checked = false;
    this.emit('sl-change');
    this.emit('sl-input');
  }

  /** Turns the switch on and emits `sl-change` and `sl-input`. */
  public override handleArrowRightKey(event: KeyboardEvent) {
    event.preventDefault();
    this.checked = true;
    this.emit('sl-change');
    this.emit('sl-input');
  }

  public handleCheckedChange() {
    this.input.checked = this.checked; // force a sync update
    this.formControlController.updateValidity();
  }

  public handleDisabledChange() {
    // Disabled form controls are always valid
    this.formControlController.setValidity(true);
  }

  /** Simulates a click on the switch. */
  public override click() {
    this.input.click();
  }

  /** Sets focus on the switch. */
  public override focus(options?: FocusOptions) {
    this.input.focus(options);
  }

  /** Removes focus from the switch. */
  public override blur() {
    this.input.blur();
  }

  /** Checks for validity but does not show a validation message. Returns `true` when valid and `false` when invalid. */
  public override checkValidity() {
    return this.input.checkValidity();
  }

  /** Gets the associated form, if one exists. */
  public getForm(): HTMLFormElement | null {
    return this.formControlController.getForm();
  }

  /** Checks for validity and shows the browser's validation message if the control is invalid. */
  public override reportValidity() {
    return this.input.reportValidity();
  }

  /** Sets a custom validation message. Pass an empty string to restore validity. */
  public override setCustomValidity(message: string) {
    this.input.setCustomValidity(message);
    this.formControlController.updateValidity();
  }

  /** Velcro extension (core): updates the validity data attributes from the inner checkbox, once rendered. */
  public override updateValidity() {
    if (!this.input) return;
    this.formControlController.updateValidity();
  }

  /** Velcro extension (core): restores `checked` to `defaultChecked`, as a form reset does. */
  public override formResetCallback() {
    this.checked = this.defaultChecked;
  }

  public override render() {
    const hasHelpTextSlot = this.hasSlotController.test('help-text');
    const hasHelpText = this.helpText ? true : !!hasHelpTextSlot;

    return html`
      <div
        class=${classMap({
          'form-control': true,
          'form-control--small': this.size === 'small',
          'form-control--medium': this.size === 'medium',
          'form-control--large': this.size === 'large',
          'form-control--has-help-text': hasHelpText,
        })}
      >
        <label
          part="base"
          class=${classMap({
            switch: true,
            'switch--checked': this.checked,
            'switch--disabled': this.disabled,
            'switch--focused': this.hasFocus,
            'switch--small': this.size === 'small',
            'switch--medium': this.size === 'medium',
            'switch--large': this.size === 'large',
          })}
        >
          <input
            class="switch__input"
            type="checkbox"
            title=${this.title /* An empty title prevents browser validation tooltips from appearing on hover */}
            name=${this.name}
            value=${ifDefined(this.value)}
            .checked=${live(this.checked)}
            .disabled=${this.disabled}
            .required=${this.required}
            ?autofocus=${this.autofocus}
            role="switch"
            aria-checked=${this.checked ? 'true' : 'false'}
            aria-describedby="help-text"
            @click=${this.handleClick}
            @input=${this.handleInput}
            @invalid=${this.handleInvalid}
            @blur=${this.handleBlur}
            @focus=${this.handleFocus}
            @keydown=${this.handleKeyDown}
          />
          <span part="control" class="switch__control">
            <span part="thumb" class="switch__thumb"></span>
          </span>
          <div part="label" class=${classMap({ switch__label: true, 'visually-hidden': this.hideLabel })}>
            <slot>${this.label ?? ''}</slot>
          </div>
        </label>
        <div
          aria-hidden=${hasHelpText ? 'false' : 'true'}
          class=${classMap({ 'form-control__help-text': true, 'visually-hidden': this.hideLabel })}
          id="help-text"
          part="form-control-help-text"
        >
          <slot name="help-text">${this.helpText}</slot>
        </div>
      </div>
    `;
  }
}

useVelcroScope(VelcroSwitch);

export default VelcroSwitch;
