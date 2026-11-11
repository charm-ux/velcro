// Adapted from Shoelace v2.20.1 (src/components/textarea/textarea.component.ts, the `defaultValue` decorator in
// src/internal/default-value.ts, the `watch` decorator in src/internal/watch.ts and the reflected-property restore in
// src/internal/shoelace-element.ts), Copyright (c) 2020 A Beautiful Site, LLC, MIT License. See THIRD_PARTY_NOTICES.md.
// The API documentation wording, the rendered structure (the `form-control` wrapper around the label, a `base` box that
// holds the native <textarea> and the size adjuster, and the help text), the events, the validation and form
// participation API, the auto-resize logic and the selection methods follow Shoelace. Velcro changes: built on the
// @charm-ux/core text area (core-only extras are kept, see the class comment).
import { LitElement, html, type PropertyValues } from 'lit';
import { property, query } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { live } from 'lit/directives/live.js';
import { CharmElement } from '@charm-ux/core/dist/base/charm-element/charm-element.js';
import { CharmFocusableElement } from '@charm-ux/core/dist/base/focusable-element/charm-focusable-element.js';
import type { CoreTextArea } from '@charm-ux/core/dist/components/text-area/text-area.js';
import { HasSlotController } from '@charm-ux/core/dist/controller/index.js';
import { ShoelaceCompat, restoreReflectedProperties } from '../../internal/shoelace-compat.js';
import { FormControlController } from '../../internal/form.js';
import { CoreTextAreaTyping } from './core-typing.js';
import styles from './textarea.styles.js';

/**
 * Textareas collect data from the user and allow multiple lines of text.
 *
 * Velcro extensions inherited from the core text area and kept working: `hide-label` (visually hides the label and help
 * text, which stay accessible) and `error-message` (sets a custom validity message, like `setCustomValidity()`; it is
 * not rendered). The core `invalid` and `label-position` properties are accepted but have no effect (use
 * `data-invalid`, as in Shoelace). As with every Velcro form control the host carries core's `focusable` attribute.
 *
 * @property {string} lang - The element's language, as set by the `lang` attribute or property. Not reflected.
 *
 * @tag sl-textarea
 * @status prototype
 *
 * @slot label - The textarea's label. Alternatively, you can use the `label` attribute.
 * @slot help-text - Text that describes how to use the input. Alternatively, you can use the `help-text` attribute.
 *
 * @event sl-blur - Emitted when the control loses focus.
 * @event sl-change - Emitted when an alteration to the control's value is committed by the user.
 * @event sl-focus - Emitted when the control gains focus.
 * @event sl-input - Emitted when the control receives input.
 * @event sl-invalid - Emitted when the form control has been checked for validity and its constraints aren't satisfied.
 *
 * @inheritedEventDropped change - Never emitted: Shoelace's `sl-change` is emitted instead.
 * @inheritedEventDropped input - Never emitted by the textarea: Shoelace's `sl-input` is emitted instead (as in
 * Shoelace, the host still receives the platform's composed `input` event from its inner `<textarea>`).
 * @inheritedEventDropped keydown - Never emitted by the textarea itself; keys pressed in it reach the host as the
 * platform's composed `keydown` event, as in Shoelace.
 *
 * @csspart form-control - The form control that wraps the label, input, and help text.
 * @csspart form-control-label - The label's wrapper.
 * @csspart form-control-input - The input's wrapper.
 * @csspart form-control-help-text - The help text's wrapper.
 * @csspart base - The component's base wrapper.
 * @csspart textarea - The internal `<textarea>` control.
 * @csspart textarea-adjuster - The invisible element that keeps the layout stable while `resize` is `auto`.
 */
export class VelcroTextarea extends ShoelaceCompat(CoreTextAreaTyping, { lang: true, dir: true, reflected: true }) {
  // Only Shoelace's styles: core's base element styles would, for example, hide the host for the `hidden` attribute,
  // which Shoelace's textarea does not do. The one Velcro rule visually hides the label and help text for `hide-label`.
  public static override styles = [styles];

  // Shoelace's textarea uses Lit's default shadow root options ({ mode: 'open' }). Core's focusable base delegates focus,
  // which would, for example, focus the textarea (and emit sl-focus) on a click on its help text.
  public static override shadowRootOptions = { ...LitElement.shadowRootOptions } as typeof CoreTextArea.shadowRootOptions;

  // The tag is `sl-textarea`, as in Shoelace; core's text area is named `text-area`.
  public static override baseName = 'textarea';

  // Shoelace's textarea is not form-associated: the form is found from `form` / the closest <form> and the value is added
  // in its `formdata` event. Core's ElementInternals association is switched off so the host does not join
  // `form.elements`, submit core's form value or follow a disabled fieldset, which Shoelace's textarea does not do either.
  protected static override formAssociated = false;

  // Core's error message template renders an icon; this template renders no other element.
  public static override get dependencies() {
    return [];
  }

  private readonly formControlController = new FormControlController(this, {
    assumeInteractionOn: ['sl-blur', 'sl-input'],
  });
  private readonly hasSlotController = new HasSlotController(this, 'help-text', 'label');
  private resizeObserver?: ResizeObserver;

  // Focus and blur are handled on the inner textarea, as in Shoelace, instead of core's host listeners.
  protected override useBlurHandler = false;
  protected override useFocusHandler = false;
  private velcroValue = '';
  private velcroDisabled = false;
  private velcroReadonly = false;
  private velcroErrorMessage = '';
  private velcroAutocorrect?: string;

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

  @query('.textarea__control')
  public override input!: HTMLTextAreaElement;

  @query('.textarea__size-adjuster')
  public sizeAdjuster!: HTMLTextAreaElement;

  /** Reactive so that it passes through to the inner `<textarea>`; an empty title keeps validation tooltips from appearing on hover. */
  @property()
  public override title = '';

  /** The name of the textarea, submitted as a name/value pair with form data. */
  @property()
  public override name = '';

  /**
   * The current value of the textarea, submitted as a name/value pair with form data.
   * @default ''
   */
  @property()
  public override get value(): string {
    return this.velcroValue;
  }
  public override set value(value: string) {
    this.velcroValue = value;
  }

  /** The textarea's size. */
  @property({ reflect: true })
  public size: 'small' | 'medium' | 'large' = 'medium';

  /** Draws a filled textarea. */
  @property({ type: Boolean, reflect: true })
  public filled = false;

  /** The textarea's label. If you need to display HTML, use the `label` slot instead. */
  @property()
  public override label = '';

  /** The textarea's help text. If you need to display HTML, use the `help-text` slot instead. */
  @property({ attribute: 'help-text' })
  public override helpText = '';

  /** Placeholder text to show as a hint when the input is empty. */
  @property()
  public override placeholder = '';

  /** The number of rows to display by default. */
  @property({ type: Number })
  public override rows = 4;

  /** Controls how the textarea can be resized. */
  @property()
  public override resize: 'none' | 'vertical' | 'auto' = 'vertical';

  /**
   * Disables the textarea.
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
   * Makes the textarea readonly.
   * @default false
   */
  @property({ type: Boolean, reflect: true })
  public override get readonly(): boolean {
    return this.velcroReadonly;
  }
  public override set readonly(value: boolean) {
    this.velcroReadonly = value;
  }

  /**
   * By default, form controls are associated with the nearest containing `<form>` element. This attribute allows you
   * to place the form control outside of a form and associate it with the form that has this `id`. The form must be in
   * the same document or shadow root for this to work.
   */
  @property({ reflect: true })
  public form = '';

  /** Makes the textarea a required field. */
  @property({ type: Boolean, reflect: true })
  public override required = false;

  /** The minimum length of input that will be considered valid. */
  @property({ type: Number })
  public override minlength!: number;

  /** The maximum length of input that will be considered valid. */
  @property({ type: Number })
  public override maxlength!: number;

  /** Controls whether and how text input is automatically capitalized as it is entered by the user. */
  @property()
  public override autocapitalize!: 'off' | 'none' | 'on' | 'sentences' | 'words' | 'characters';

  // Shoelace types `autocorrect` as `string`, but lib.dom declares `autocorrect: boolean` on HTMLElement, and a class whose
  // property is `string` is no longer an HTMLElement for TypeScript (the generated JSX types and every API taking an
  // HTMLElement reject it). The property is therefore an accessor that reads as `any`, so the class stays an HTMLElement,
  // and accepts only a string when it is assigned. The manifest type is Shoelace's, from the `@type` tag.
  /**
   * Indicates whether the browser's autocorrect feature is on or off.
   * @type {string}
   */
  @property()
  public get autocorrect(): any {
    return this.velcroAutocorrect;
  }
  public set autocorrect(value: string) {
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

  /** Enables spell checking on the textarea. */
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

  /** The default value of the form control. Primarily used for resetting the form control. */
  public defaultValue = '';

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
   * Velcro extension (core), inert: accepted and reflected for compatibility with the core text area, but not
   * maintained and without effect. Use `validity` or the `data-invalid` attribute, as in Shoelace.
   */
  @property({ type: Boolean, reflect: true })
  public override invalid = false;

  /** Velcro extension (core), inert: accepted and reflected for compatibility with the core text area, without effect. */
  @property({ attribute: 'label-position', reflect: true })
  public override labelPosition?: 'end' | 'start' | 'top';

  public constructor() {
    super();
    this.clearCoreDefaults();
  }

  // Core's constructors give two properties values that Shoelace's textarea does not have: Shoelace leaves
  // `autocapitalize` and `autofocus` undefined until they are set. (A separate method, not constructor assignments, so
  // the manifest analyzer does not record `undefined` as a declared default.)
  private clearCoreDefaults() {
    (this as { autocapitalize?: string }).autocapitalize = undefined;
    (this as { autofocus?: boolean }).autofocus = undefined;
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
    this.resizeObserver = new ResizeObserver(() => this.setTextareaHeight());

    this.updateComplete.then(() => {
      this.setTextareaHeight();
      this.resizeObserver?.observe(this.input);
    });
  }

  public override disconnectedCallback() {
    super.disconnectedCallback();
    if (this.input) {
      this.resizeObserver?.unobserve(this.input);
    }
  }

  // Records the reflected properties' values the first time any attribute changes (during upgrade, before the
  // attribute values are applied), so that removing a reflected attribute later restores that value instead of
  // leaving the property null. Same timing and rule as Shoelace's base element. A change of the `value` attribute
  // also sets `defaultValue`, as Shoelace's `defaultValue()` decorator does.
  public override attributeChangedCallback(name: string, previous: string | null, next: string | null) {
    if (name === 'value' && this.value !== next) {
      this.defaultValue = next as string;
    }
    super.attributeChangedCallback(name, previous, next);
  }

  protected override willUpdate(changed: PropertyValues<this>) {
    super.willUpdate(changed);
    restoreReflectedProperties(this, changed);
  }

  protected override update(changed: PropertyValues<this>) {
    // Shoelace's `@watch` handlers with `waitUntilFirstUpdate: true` run before render.
    if (this.hasUpdated && changed.has('value') && changed.get('value') !== this.value) {
      this.handleValueChange();
    }
    if (this.hasUpdated && changed.has('rows') && changed.get('rows') !== this.rows) {
      this.handleRowsChange();
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
    this.setTextareaHeight();
    this.emit('sl-change');
  }

  protected override handleFocus() {
    this.hasFocus = true;
    this.emit('sl-focus');
  }

  protected override handleInput = () => {
    this.value = this.input.value;
    this.emit('sl-input');
  };

  private handleInvalid(event: Event) {
    this.formControlController.setValidity(false);
    this.formControlController.emitInvalidEvent(event);
  }

  private setTextareaHeight() {
    if (this.resize === 'auto') {
      // This prevents layout shifts. We use `clientHeight` instead of `scrollHeight` to account for if the `<textarea>` has a max-height set on it. In my tests, this has worked fine. Im not aware of any edge cases. [Konnor]
      this.sizeAdjuster.style.height = `${this.input.clientHeight}px`;
      this.input.style.height = 'auto';
      this.input.style.height = `${this.input.scrollHeight}px`;
    } else {
      this.input.style.height = '';
    }
  }

  public handleDisabledChange() {
    // Disabled form controls are always valid
    this.formControlController.setValidity(this.disabled);
  }

  public handleRowsChange() {
    this.setTextareaHeight();
  }

  public async handleValueChange() {
    await this.updateComplete;
    this.formControlController.updateValidity();
    this.setTextareaHeight();
  }

  /** Sets focus on the textarea. */
  public override focus(options?: FocusOptions) {
    this.input.focus(options);
  }

  /** Removes focus from the textarea. */
  public override blur() {
    this.input.blur();
  }

  /** Selects all the text in the textarea. */
  public select() {
    this.input.select();
  }

  /** Gets or sets the textarea's scroll position. */
  public scrollPosition(position?: { top?: number; left?: number }): { top: number; left: number } | undefined {
    if (position) {
      if (typeof position.top === 'number') this.input.scrollTop = position.top;
      if (typeof position.left === 'number') this.input.scrollLeft = position.left;
      return undefined;
    }

    return {
      top: this.input.scrollTop,
      left: this.input.scrollTop,
    };
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
      this.setTextareaHeight();
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
              textarea: true,
              'textarea--small': this.size === 'small',
              'textarea--medium': this.size === 'medium',
              'textarea--large': this.size === 'large',
              'textarea--standard': !this.filled,
              'textarea--filled': this.filled,
              'textarea--disabled': this.disabled,
              'textarea--focused': this.hasFocus,
              'textarea--empty': !this.value,
              'textarea--resize-none': this.resize === 'none',
              'textarea--resize-vertical': this.resize === 'vertical',
              'textarea--resize-auto': this.resize === 'auto',
            })}
          >
            <textarea
              part="textarea"
              id="input"
              class="textarea__control"
              title=${this.title /* An empty title prevents browser validation tooltips from appearing on hover */}
              name=${ifDefined(this.name)}
              .value=${live(this.value)}
              ?disabled=${this.disabled}
              ?readonly=${this.readonly}
              ?required=${this.required}
              placeholder=${ifDefined(this.placeholder)}
              rows=${ifDefined(this.rows)}
              minlength=${ifDefined(this.minlength)}
              maxlength=${ifDefined(this.maxlength)}
              autocapitalize=${ifDefined(this.autocapitalize)}
              autocorrect=${ifDefined(this.autocorrect)}
              ?autofocus=${this.autofocus}
              spellcheck=${ifDefined(this.spellcheck)}
              enterkeyhint=${ifDefined(this.enterkeyhint)}
              inputmode=${ifDefined(this.inputmode)}
              aria-describedby="help-text"
              @change=${this.handleChange}
              @input=${this.handleInput}
              @invalid=${this.handleInvalid}
              @focus=${this.handleFocus}
              @blur=${this.handleBlur}
            ></textarea>
            <!-- This "adjuster" exists to prevent layout shifting. https://github.com/shoelace-style/shoelace/issues/2180 -->
            <div part="textarea-adjuster" class="textarea__size-adjuster" ?hidden=${this.resize !== 'auto'}></div>
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

export default VelcroTextarea;
