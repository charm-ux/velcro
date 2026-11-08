// Adapted from Shoelace v2.20.1 (src/components/input/input.component.ts, the `defaultValue` decorator in
// src/internal/default-value.ts, the `watch` decorator in src/internal/watch.ts and the reflected-property restore in
// src/internal/shoelace-element.ts), Copyright (c) 2020 A Beautiful Site, LLC, MIT License. See THIRD_PARTY_NOTICES.md.
// The API documentation wording, the rendered structure (the `form-control` wrapper around the label, a `base` box that
// holds the prefix, the native <input>, the clear and password toggle buttons and the suffix, and the help text), the
// events, the validation and form participation API, the keyboard behavior, the in-memory `valueAsDate` and
// `valueAsNumber` conversions and the selection methods follow Shoelace. Velcro changes: built on the @charm-ux/core
// input (core-only extras are kept, see the class comment).
import { LitElement, html, type PropertyValues } from 'lit';
import { property, query } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { live } from 'lit/directives/live.js';
import { CharmElement } from '@charm-ux/core/dist/base/charm-element/charm-element.js';
import { CharmFocusableElement } from '@charm-ux/core/dist/base/focusable-element/charm-focusable-element.js';
import type { CoreInput } from '@charm-ux/core/dist/components/input/input.js';
import { HasSlotController } from '@charm-ux/core/dist/controller/index.js';
import { FormControlController } from '../../internal/form.js';
import { defineVelcroComponent, type VelcroComponentConstructor } from '../../utilities/registration.js';
import { LocalizeController } from '../../utilities/localize.js';
import { VelcroIcon } from '../icon/class.js';
import { CoreInputTyping } from './core-typing.js';
import styles from './input.styles.js';

/**
 * Inputs collect data from the user.
 *
 * Velcro extensions inherited from the core input and kept working: `hide-label` (visually hides the label and help
 * text, which stay accessible) and `error-message` (sets a custom validity message, like `setCustomValidity()`; it is
 * not rendered). The core `invalid` and `label-position` properties are accepted but have no effect (use
 * `data-invalid`, as in Shoelace). As with every Velcro form control the host carries core's `focusable` attribute.
 * The core input's slotted `<option>` datalist and its `start` and `end` slots are not rendered: the template is
 * Shoelace's, with `prefix` and `suffix` slots.
 *
 * @tag sl-input
 * @status prototype
 *
 * @dependency sl-icon
 *
 * @slot label - The input's label. Alternatively, you can use the `label` attribute.
 * @slot prefix - Used to prepend a presentational icon or similar element to the input.
 * @slot suffix - Used to append a presentational icon or similar element to the input.
 * @slot clear-icon - An icon to use in lieu of the default clear icon.
 * @slot show-password-icon - An icon to use in lieu of the default show password icon.
 * @slot hide-password-icon - An icon to use in lieu of the default hide password icon.
 * @slot help-text - Text that describes how to use the input. Alternatively, you can use the `help-text` attribute.
 *
 * @event sl-blur - Emitted when the control loses focus.
 * @event sl-change - Emitted when an alteration to the control's value is committed by the user.
 * @event sl-clear - Emitted when the clear button is activated.
 * @event sl-focus - Emitted when the control gains focus.
 * @event sl-input - Emitted when the control receives input.
 * @event sl-invalid - Emitted when the form control has been checked for validity and its constraints aren't satisfied.
 *
 * @inheritedEventDropped change - Never emitted: Shoelace's `sl-change` is emitted instead.
 * @inheritedEventDropped input - Never emitted by the input itself: Shoelace's `sl-input` is emitted instead (as in
 * Shoelace, the host still receives the platform's composed `input` event from its inner `<input>`).
 *
 * @csspart form-control - The form control that wraps the label, input, and help text.
 * @csspart form-control-label - The label's wrapper.
 * @csspart form-control-input - The input's wrapper.
 * @csspart form-control-help-text - The help text's wrapper.
 * @csspart base - The component's base wrapper.
 * @csspart input - The internal `<input>` control.
 * @csspart prefix - The container that wraps the prefix.
 * @csspart clear-button - The clear button.
 * @csspart password-toggle-button - The password toggle button.
 * @csspart suffix - The container that wraps the suffix.
 */
export class VelcroInput extends CoreInputTyping {
  // Only Shoelace's styles: core's base element styles would, for example, hide the host for the `hidden` attribute,
  // which Shoelace's input does not do. The one Velcro rule visually hides the label and help text for `hide-label`.
  public static override styles = [styles];

  // Shoelace's input uses Lit's default shadow root options ({ mode: 'open' }). Core's focusable base delegates focus,
  // which would, for example, focus the input (and emit sl-focus) on a click on its help text.
  public static override shadowRootOptions = { ...LitElement.shadowRootOptions } as typeof CoreInput.shadowRootOptions;

  // Shoelace's input is not form-associated: the form is found from `form` / the closest <form> and the value is added
  // in its `formdata` event. Core's ElementInternals association is switched off so the host does not join
  // `form.elements`, submit core's form value or follow a disabled fieldset, which Shoelace's input does not do either.
  protected static override formAssociated = false;

  // Core's dependencies are registered in core's scope for core's own template, which this class replaces; the element it
  // renders is Shoelace's `sl-icon`, handled below.
  public static override get dependencies() {
    return [];
  }

  // Shoelace's `static dependencies` for the input: the elements its template renders. Shoelace keys them by tag; here the
  // tag is derived from each class's `baseName` (`sl-icon` for `VelcroIcon`), the same tag `defineVelcroComponent`
  // defines and the template renders. As in Shoelace's base element, each one that is not defined yet is defined when an
  // input is constructed, and a tag that another constructor already owns is left alone. If the platform refuses the
  // class itself (for example because it is already registered under another tag), an anonymous subclass is defined
  // instead, as Shoelace does. Not part of the documented API (Shoelace's manifest lists `dependencies` without a
  // description).
  private static readonly shoelaceDependencies: readonly VelcroComponentConstructor[] = [VelcroIcon];

  private readonly formControlController = new FormControlController(this, {
    assumeInteractionOn: ['sl-blur', 'sl-input'],
  });
  private readonly hasSlotController = new HasSlotController(this, 'help-text', 'label');
  private readonly localize = new LocalizeController(this);

  // Focus and blur are handled on the inner input, as in Shoelace, instead of core's host listeners.
  protected override useBlurHandler = false;
  protected override useFocusHandler = false;

  private hasRecordedInitialProperties = false;
  private readonly initialReflectedProperties = new Map<string, unknown>();
  private velcroValue = '';
  private velcroDisabled = false;
  private velcroReadonly = false;
  private velcroErrorMessage = '';
  private velcroAutocorrect?: 'off' | 'on';
  private velcroDir?: string;

  // NOTE (Shoelace): an in-memory input is used for the `valueAsDate` and `valueAsNumber` getters and setters instead of
  // the one in the template, because the properties can be set before the component is rendered.
  private __numberInput = Object.assign(document.createElement('input'), { type: 'number' });
  private __dateInput = Object.assign(document.createElement('input'), { type: 'date' });

  // `dir` and `lang` are declared as Shoelace's base element declares them: reactive, not reflected and without an
  // initial value (undefined). Core's `dir` would return the computed direction instead.
  // Types: Shoelace declares `dir: string`. The setter accepts any string, as Shoelace's does. The getter must keep
  // core's declared type, because TypeScript does not let a subclass widen an inherited property's read type; at
  // runtime it returns whatever was set.
  /**
   * The element's text direction, as set by the `dir` attribute or property and returned as set. Not reflected. Any
   * string can be assigned; the declared read type stays core's `'ltr' | 'rtl' | 'auto'`.
   */
  @property()
  public override get dir(): 'ltr' | 'rtl' | 'auto' {
    return this.velcroDir as 'ltr' | 'rtl' | 'auto';
  }
  public override set dir(value: string) {
    this.velcroDir = value;
  }

  /** The element's language, as set by the `lang` attribute or property. Not reflected. */
  @property()
  public override lang!: string;

  @query('.input__control')
  public override input!: HTMLInputElement;

  /** Reactive so that it passes through to the inner `<input>`; an empty title keeps validation tooltips from appearing on hover. */
  @property()
  public override title = '';

  /**
   * The type of input. Works the same as a native `<input>` element, but only a subset of types are supported. Defaults
   * to `text`.
   */
  @property({ reflect: true })
  public override type:
    | 'date'
    | 'datetime-local'
    | 'email'
    | 'number'
    | 'password'
    | 'search'
    | 'tel'
    | 'text'
    | 'time'
    | 'url' = 'text';

  /** The name of the input, submitted as a name/value pair with form data. */
  @property()
  public override name = '';

  /**
   * The current value of the input, submitted as a name/value pair with form data.
   * @default ''
   */
  @property()
  public override get value(): string {
    return this.velcroValue;
  }
  public override set value(value: string) {
    this.velcroValue = value;
  }

  /** The default value of the form control. Primarily used for resetting the form control. */
  public defaultValue = '';

  /** The input's size. */
  @property({ reflect: true })
  public size: 'small' | 'medium' | 'large' = 'medium';

  /** Draws a filled input. */
  @property({ type: Boolean, reflect: true })
  public filled = false;

  /** Draws a pill-style input with rounded edges. */
  @property({ type: Boolean, reflect: true })
  public pill = false;

  /** The input's label. If you need to display HTML, use the `label` slot instead. */
  @property()
  public override label = '';

  /** The input's help text. If you need to display HTML, use the `help-text` slot instead. */
  @property({ attribute: 'help-text' })
  public override helpText = '';

  /** Adds a clear button when the input is not empty. */
  @property({ type: Boolean })
  public clearable = false;

  /**
   * Disables the input.
   * @default false
   */
  @property({ type: Boolean, reflect: true })
  public override get disabled(): boolean {
    return this.velcroDisabled;
  }
  public override set disabled(value: boolean) {
    this.velcroDisabled = value;
  }

  /** Placeholder text to show as a hint when the input is empty. */
  @property()
  public override placeholder = '';

  /**
   * Makes the input readonly.
   * @default false
   */
  @property({ type: Boolean, reflect: true })
  public override get readonly(): boolean {
    return this.velcroReadonly;
  }
  public override set readonly(value: boolean) {
    this.velcroReadonly = value;
  }

  /** Adds a button to toggle the password's visibility. Only applies to password types. */
  @property({ attribute: 'password-toggle', type: Boolean })
  public passwordToggle = false;

  /** Determines whether or not the password is currently visible. Only applies to password input types. */
  @property({ attribute: 'password-visible', type: Boolean })
  public passwordVisible = false;

  /** Hides the browser's built-in increment/decrement spin buttons for number inputs. */
  @property({ attribute: 'no-spin-buttons', type: Boolean })
  public noSpinButtons = false;

  /**
   * By default, form controls are associated with the nearest containing `<form>` element. This attribute allows you
   * to place the form control outside of a form and associate it with the form that has this `id`. The form must be in
   * the same document or shadow root for this to work.
   */
  @property({ reflect: true })
  public form = '';

  /** Makes the input a required field. */
  @property({ type: Boolean, reflect: true })
  public override required = false;

  /** A regular expression pattern to validate input against. */
  @property()
  public override pattern!: string;

  /** The minimum length of input that will be considered valid. */
  @property({ type: Number })
  public override minlength!: number;

  /** The maximum length of input that will be considered valid. */
  @property({ type: Number })
  public override maxlength!: number;

  /** The input's minimum value. Only applies to date and number input types. */
  @property()
  public override min!: number | string;

  /** The input's maximum value. Only applies to date and number input types. */
  @property()
  public override max!: number | string;

  /**
   * Specifies the granularity that the value must adhere to, or the special value `any` which means no stepping is
   * implied, allowing any numeric value. Only applies to date and number input types.
   */
  @property()
  public override step!: number | 'any';

  /** Controls whether and how text input is automatically capitalized as it is entered by the user. */
  @property()
  public override autocapitalize!: 'off' | 'none' | 'on' | 'sentences' | 'words' | 'characters';

  // lib.dom declares `autocorrect: boolean` on HTMLElement, and a class whose property is `'off' | 'on'` is no longer an
  // HTMLElement for TypeScript (the generated JSX types and every API taking an HTMLElement reject it). The property is
  // therefore an accessor that reads as `any`, so the class stays an HTMLElement, and accepts only Shoelace's `'off' | 'on'`
  // when it is assigned. The manifest type is Shoelace's, from the `@type` tag.
  /**
   * Indicates whether the browser's autocorrect feature is on or off.
   * @type {'off' | 'on'}
   */
  @property()
  public get autocorrect(): any {
    return this.velcroAutocorrect;
  }
  public set autocorrect(value: 'off' | 'on') {
    this.velcroAutocorrect = value;
  }

  /**
   * Specifies what permission the browser has to provide assistance in filling out form field values. Refer to
   * [this page on MDN](https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/autocomplete) for available values.
   */
  @property()
  public override autocomplete!: string;

  /** Indicates that the input should receive focus on page load. */
  @property({ type: Boolean })
  public override autofocus!: boolean;

  /** Used to customize the label or icon of the Enter key on virtual keyboards. */
  @property()
  public override enterkeyhint!: 'enter' | 'done' | 'go' | 'next' | 'previous' | 'search' | 'send';

  /** Enables spell checking on the input. */
  @property({
    type: Boolean,
    converter: {
      // Allow "true|false" attribute values but keep the property boolean
      fromAttribute: value => (!value || value === 'false' ? false : true),
      toAttribute: value => (value ? 'true' : 'false'),
    },
  })
  public override spellcheck = true;

  /**
   * Tells the browser what type of data will be entered by the user, allowing it to display the appropriate virtual
   * keyboard on supportive devices.
   */
  @property()
  public override inputmode!: 'none' | 'text' | 'decimal' | 'numeric' | 'tel' | 'search' | 'email' | 'url';

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

  /** Velcro extension (core): visually hides the label and help text, which stay accessible. */
  @property({ type: Boolean, attribute: 'hide-label', reflect: true })
  public override hideLabel = false;

  /**
   * Velcro extension (core), inert: accepted and reflected for compatibility with the core input, but not
   * maintained and without effect. Use `validity` or the `data-invalid` attribute, as in Shoelace.
   */
  @property({ type: Boolean, reflect: true })
  public override invalid = false;

  /** Velcro extension (core), inert: accepted and reflected for compatibility with the core input, without effect. */
  @property({ attribute: 'label-position', reflect: true })
  public override labelPosition?: 'end' | 'start' | 'top';

  public constructor() {
    super();
    this.clearCoreDefaults();
    for (const component of VelcroInput.shoelaceDependencies) {
      if (customElements.get(`sl-${component.baseName}`)) continue;
      try {
        defineVelcroComponent(component);
      } catch {
        defineVelcroComponent(class extends component {});
      }
    }
  }

  // Core's constructors give two properties values that Shoelace's input does not have: Shoelace leaves
  // `autocapitalize` and `autofocus` undefined until they are set. (A separate method, not constructor assignments, so
  // the manifest analyzer does not record `undefined` as a declared default.)
  private clearCoreDefaults() {
    (this as { autocapitalize?: string }).autocapitalize = undefined;
    (this as { autofocus?: boolean }).autofocus = undefined;
  }

  /**
   * Gets or sets the current value as a `Date` object. Returns `null` if the value can't be converted. This will use the native `<input type="{{type}}">` implementation and may result in an error.
   */
  public override get valueAsDate() {
    this.__dateInput.type = this.type;
    this.__dateInput.value = this.value;
    return this.input?.valueAsDate || this.__dateInput.valueAsDate;
  }

  public override set valueAsDate(newValue: Date | null) {
    this.__dateInput.type = this.type;
    this.__dateInput.valueAsDate = newValue;
    this.value = this.__dateInput.value;
  }

  /** Gets or sets the current value as a number. Returns `NaN` if the value can't be converted. */
  public override get valueAsNumber() {
    this.__numberInput.value = this.value;
    return this.input?.valueAsNumber || this.__numberInput.valueAsNumber;
  }

  public override set valueAsNumber(newValue: number) {
    this.__numberInput.valueAsNumber = newValue;
    this.value = this.__numberInput.value;
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
  // element cannot hold (and core input's datalist lookup); core's focusable and base element setup still runs.
  public override connectedCallback() {
    CharmFocusableElement.prototype.connectedCallback.call(this);
  }

  // Records the reflected properties' values the first time any attribute changes (during upgrade, before the
  // attribute values are applied), so that removing a reflected attribute later restores that value instead of
  // leaving the property null. Same timing and rule as Shoelace's base element. A change of the `value` attribute
  // also sets `defaultValue`, as Shoelace's `defaultValue()` decorator does.
  public override attributeChangedCallback(name: string, previous: string | null, next: string | null) {
    if (name === 'value' && this.value !== next) {
      this.defaultValue = next as string;
    }
    if (!this.hasRecordedInitialProperties) {
      (this.constructor as typeof VelcroInput).elementProperties.forEach((options, prop) => {
        // Reflection is checked first, as upstream does, so that a non-reflected property's getter is not read here.
        if (!options.reflect) return;
        const current = (this as unknown as Record<PropertyKey, unknown>)[prop];
        if (current != null) {
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
      if (changed.has(prop as keyof VelcroInput) && self[prop] == null) {
        self[prop] = value;
      }
    });
  }

  protected override update(changed: PropertyValues<this>) {
    // Shoelace's `@watch` handlers with `waitUntilFirstUpdate: true` run before render. Each decorator wraps the previous
    // `update`, so the handler declared last (value) runs first.
    if (this.hasUpdated && changed.has('value') && changed.get('value') !== this.value) {
      this.handleValueChange();
    }
    if (this.hasUpdated && changed.has('step') && changed.get('step') !== this.step) {
      this.handleStepChange();
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

  protected override handleChange() {
    this.value = this.input.value;
    this.emit('sl-change');
  }

  private handleClearClick(event: MouseEvent) {
    event.preventDefault();

    if (this.value !== '') {
      this.value = '';
      this.emit('sl-clear');
      this.emit('sl-input');
      this.emit('sl-change');
    }

    this.input.focus();
  }

  protected override handleFocus() {
    this.hasFocus = true;
    this.emit('sl-focus');
  }

  protected override handleInput() {
    this.value = this.input.value;
    this.formControlController.updateValidity();
    this.emit('sl-input');
  }

  private handleInvalid(event: Event) {
    this.formControlController.setValidity(false);
    this.formControlController.emitInvalidEvent(event);
  }

  protected override handleKeyDown(event: KeyboardEvent) {
    const hasModifier = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;

    // Pressing enter when focused on an input should submit the form like a native input, but we wait a tick before
    // submitting to allow users to cancel the keydown event if they need to
    if (event.key === 'Enter' && !hasModifier) {
      setTimeout(() => {
        //
        // When using an Input Method Editor (IME), pressing enter will cause the form to submit unexpectedly. One way
        // to check for this is to look at event.isComposing, which will be true when the IME is open.
        //
        // See https://github.com/shoelace-style/shoelace/pull/988
        //
        if (!event.defaultPrevented && !event.isComposing) {
          this.formControlController.submit();
        }
      });
    }
  }

  private handlePasswordToggle() {
    this.passwordVisible = !this.passwordVisible;
  }

  public handleDisabledChange() {
    // Disabled form controls are always valid
    this.formControlController.setValidity(this.disabled);
  }

  public handleStepChange() {
    // If step changes, the value may become invalid so we need to recheck after the update. We set the new step
    // imperatively so we don't have to wait for the next render to report the updated validity.
    this.input.step = String(this.step);
    this.formControlController.updateValidity();
  }

  public async handleValueChange() {
    await this.updateComplete;
    this.formControlController.updateValidity();
  }

  /** Sets focus on the input. */
  public override focus(options?: FocusOptions) {
    this.input.focus(options);
  }

  /** Removes focus from the input. */
  public override blur() {
    this.input.blur();
  }

  /** Selects all the text in the input. */
  public select() {
    this.input.select();
  }

  /** Sets the start and end positions of the text selection (0-based). */
  public setSelectionRange(
    selectionStart: number,
    selectionEnd: number,
    selectionDirection: 'forward' | 'backward' | 'none' = 'none',
  ) {
    this.input.setSelectionRange(selectionStart, selectionEnd, selectionDirection);
  }

  /** Replaces a range of text with a new string. */
  public setRangeText(
    replacement: string,
    start?: number,
    end?: number,
    selectMode: 'select' | 'start' | 'end' | 'preserve' = 'preserve',
  ) {
    const selectionStart = start ?? (this.input.selectionStart as number);
    const selectionEnd = end ?? (this.input.selectionEnd as number);

    this.input.setRangeText(replacement, selectionStart, selectionEnd, selectMode);

    if (this.value !== this.input.value) {
      this.value = this.input.value;
    }
  }

  /** Displays the browser picker for an input element (only works if the browser supports it for the input type). */
  public showPicker() {
    if ('showPicker' in HTMLInputElement.prototype) {
      this.input.showPicker();
    }
  }

  /** Increments the value of a numeric input type by the value of the step attribute. */
  public stepUp() {
    this.input.stepUp();
    if (this.value !== this.input.value) {
      this.value = this.input.value;
    }
  }

  /** Decrements the value of a numeric input type by the value of the step attribute. */
  public stepDown() {
    this.input.stepDown();
    if (this.value !== this.input.value) {
      this.value = this.input.value;
    }
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

  // Core calls this when validity may have changed; the Velcro form control controller owns the validity attributes.
  protected override updateValidity() {
    if (!this.input) return;
    this.formControlController.updateValidity();
  }

  public override render() {
    const hasLabelSlot = this.hasSlotController.test('label');
    const hasHelpTextSlot = this.hasSlotController.test('help-text');
    const hasLabel = this.label ? true : !!hasLabelSlot;
    const hasHelpText = this.helpText ? true : !!hasHelpTextSlot;
    const hasClearIcon = this.clearable && !this.disabled && !this.readonly;
    const isClearIconVisible = hasClearIcon && (typeof this.value === 'number' || this.value.length > 0);

    return html`
      <div
        part="form-control"
        class=${classMap({
          'form-control': true,
          'form-control--small': this.size === 'small',
          'form-control--medium': this.size === 'medium',
          'form-control--large': this.size === 'large',
          'form-control--has-label': hasLabel,
          'form-control--has-help-text': hasHelpText,
        })}
      >
        <label
          part="form-control-label"
          class=${classMap({ 'form-control__label': true, 'visually-hidden': this.hideLabel })}
          for="input"
          aria-hidden=${hasLabel ? 'false' : 'true'}
        >
          <slot name="label">${this.label}</slot>
        </label>

        <div part="form-control-input" class="form-control-input">
          <div
            part="base"
            class=${classMap({
              input: true,

              // Sizes
              'input--small': this.size === 'small',
              'input--medium': this.size === 'medium',
              'input--large': this.size === 'large',

              // States
              'input--pill': this.pill,
              'input--standard': !this.filled,
              'input--filled': this.filled,
              'input--disabled': this.disabled,
              'input--focused': this.hasFocus,
              'input--empty': !this.value,
              'input--no-spin-buttons': this.noSpinButtons,
            })}
          >
            <span part="prefix" class="input__prefix">
              <slot name="prefix"></slot>
            </span>

            <input
              part="input"
              id="input"
              class="input__control"
              type=${this.type === 'password' && this.passwordVisible ? 'text' : this.type}
              title=${this.title /* An empty title prevents browser validation tooltips from appearing on hover */}
              name=${ifDefined(this.name)}
              ?disabled=${this.disabled}
              ?readonly=${this.readonly}
              ?required=${this.required}
              placeholder=${ifDefined(this.placeholder)}
              minlength=${ifDefined(this.minlength)}
              maxlength=${ifDefined(this.maxlength)}
              min=${ifDefined(this.min)}
              max=${ifDefined(this.max)}
              step=${ifDefined(this.step as number)}
              .value=${live(this.value)}
              autocapitalize=${ifDefined(this.autocapitalize)}
              autocomplete=${ifDefined(this.autocomplete)}
              autocorrect=${ifDefined(this.autocorrect)}
              ?autofocus=${this.autofocus}
              spellcheck=${this.spellcheck}
              pattern=${ifDefined(this.pattern)}
              enterkeyhint=${ifDefined(this.enterkeyhint)}
              inputmode=${ifDefined(this.inputmode)}
              aria-describedby="help-text"
              @change=${this.handleChange}
              @input=${this.handleInput}
              @invalid=${this.handleInvalid}
              @keydown=${this.handleKeyDown}
              @focus=${this.handleFocus}
              @blur=${this.handleBlur}
            />

            ${isClearIconVisible
              ? html`
                  <button
                    part="clear-button"
                    class="input__clear"
                    type="button"
                    aria-label=${this.localize.term('clearEntry')}
                    @click=${this.handleClearClick}
                    tabindex="-1"
                  >
                    <slot name="clear-icon">
                      <sl-icon name="x-circle-fill" library="system"></sl-icon>
                    </slot>
                  </button>
                `
              : ''}
            ${this.passwordToggle && !this.disabled
              ? html`
                  <button
                    part="password-toggle-button"
                    class="input__password-toggle"
                    type="button"
                    aria-label=${this.localize.term(this.passwordVisible ? 'hidePassword' : 'showPassword')}
                    @click=${this.handlePasswordToggle}
                    tabindex="-1"
                  >
                    ${this.passwordVisible
                      ? html`
                          <slot name="show-password-icon">
                            <sl-icon name="eye-slash" library="system"></sl-icon>
                          </slot>
                        `
                      : html`
                          <slot name="hide-password-icon">
                            <sl-icon name="eye" library="system"></sl-icon>
                          </slot>
                        `}
                  </button>
                `
              : ''}

            <span part="suffix" class="input__suffix">
              <slot name="suffix"></slot>
            </span>
          </div>
        </div>

        <div
          part="form-control-help-text"
          id="help-text"
          class=${classMap({ 'form-control__help-text': true, 'visually-hidden': this.hideLabel })}
          aria-hidden=${hasHelpText ? 'false' : 'true'}
        >
          <slot name="help-text">${this.helpText}</slot>
        </div>
      </div>
    `;
  }
}

export default VelcroInput;
