// Adapted from Shoelace v2.20.1 (src/components/checkbox/checkbox.component.ts, the `defaultValue` decorator in
// src/internal/default-value.ts, the `watch` decorator in src/internal/watch.ts and the reflected-property restore in
// src/internal/shoelace-element.ts), Copyright (c) 2020 A Beautiful Site, LLC, MIT License. See THIRD_PARTY_NOTICES.md.
// The API documentation wording, the rendered structure (a `form-control` wrapper around a `base` <label> holding a
// hidden native checkbox, the `control` square with its checked or indeterminate <sl-icon> and the `label` part, then
// the help text), the events and the form participation and validation API follow Shoelace. Velcro changes: built on
// the @charm-ux/core checkbox (core-only extras are kept, see the class comment).
import { LitElement, css, html, type PropertyValues } from 'lit';
import { property, query } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { live } from 'lit/directives/live.js';
import { CharmElement } from '@charm-ux/core/dist/base/charm-element/charm-element.js';
import { CharmFocusableElement } from '@charm-ux/core/dist/base/focusable-element/charm-focusable-element.js';
import { CharmFormControlElement } from '@charm-ux/core/dist/base/form-control-element/charm-form-control-element.js';
import { CoreCheckbox } from '@charm-ux/core/dist/components/checkbox/checkbox.js';
import { HasSlotController } from '@charm-ux/core/dist/controller/index.js';
import { FormControlController } from '../../internal/form.js';
import { defineVelcroComponent, type VelcroComponentConstructor } from '../../utilities/registration.js';
import { VelcroIcon } from '../icon/class.js';
import styles from './checkbox.styles.js';

/**
 * Checkboxes allow the user to toggle an option on or off.
 *
 * The checked and indeterminate icons are `<sl-icon>` elements from the `system` icon library, as in Shoelace. Like
 * Shoelace's, constructing a checkbox defines its dependency `<sl-icon>` (Velcro's) when no element owns that tag yet,
 * so the class-only entry needs no extra step.
 *
 * Velcro extensions inherited from the core checkbox and kept working: `readonly` (the checkbox keeps its state on
 * click), `label` (label text shown when the default slot is empty), `hide-label` (visually hides the label and help
 * text, which stay accessible) and `error-message` (sets a custom validity message, like `setCustomValidity()`; it is
 * not rendered). The core `invalid`, `label-position` and `autofocus` properties are accepted but have no effect (use
 * `data-invalid`, as in Shoelace). As with every Velcro form control the host carries core's `focusable` attribute.
 *
 * @tag sl-checkbox
 * @status prototype
 *
 * @slot - The checkbox's label.
 * @slot help-text - Text that describes how to use the checkbox. Alternatively, you can use the `help-text` attribute.
 *
 * @event sl-blur - Emitted when the checkbox loses focus.
 * @event sl-change - Emitted when the checked state changes.
 * @event sl-focus - Emitted when the checkbox gains focus.
 * @event sl-input - Emitted when the checkbox receives input.
 * @event sl-invalid - Emitted when the form control has been checked for validity and its constraints aren't satisfied.
 *
 * @inheritedEventDropped change - Never emitted: Shoelace's `sl-change` is emitted instead.
 * @inheritedEventDropped input - Never emitted by the checkbox: Shoelace's `sl-input` is emitted instead (as in
 * Shoelace, the host still receives the platform's composed `input` event from its inner checkbox on a click).
 *
 * @csspart base - The component's base wrapper.
 * @csspart control - The square container that wraps the checkbox's checked state.
 * @csspart control--checked - Matches the control part when the checkbox is checked.
 * @csspart control--indeterminate - Matches the control part when the checkbox is indeterminate.
 * @csspart checked-icon - The checked icon, an `<sl-icon>` element.
 * @csspart indeterminate-icon - The indeterminate icon, an `<sl-icon>` element.
 * @csspart label - The container that wraps the checkbox's label.
 * @csspart form-control-help-text - The help text's wrapper.
 */
export class VelcroCheckbox extends CoreCheckbox {
  // Only Shoelace's styles: core's base element styles would, for example, hide the host for the `hidden` attribute,
  // which Shoelace's checkbox does not do. The one Velcro rule visually hides the label and help text for `hide-label`.
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

  // Shoelace's checkbox uses Lit's default shadow root options ({ mode: 'open' }). Core's focusable base delegates focus,
  // which would, for example, focus the checkbox (and emit sl-focus) on a click on its help text.
  public static override shadowRootOptions = { ...LitElement.shadowRootOptions } as typeof CoreCheckbox.shadowRootOptions;

  // Shoelace's checkbox is not form-associated: the form is found from `form` / the closest <form> and the value is
  // added in its `formdata` event. Core's ElementInternals association is switched off so the host does not join
  // `form.elements`, submit core's form value or follow a disabled fieldset, which Shoelace's checkbox does not do either.
  protected static override formAssociated = false;

  // Core's array of dependencies registers core's icon in core's scope; this template renders Velcro's `<sl-icon>`
  // instead, defined by the constructor below (Shoelace's `static dependencies`).
  public static override get dependencies() {
    return [];
  }

  // Shoelace's `static dependencies` for the checkbox: the elements its template renders. Shoelace keys them by tag; here
  // the tag is derived from each class's `baseName` (`sl-icon` for `VelcroIcon`), the same tag `defineVelcroComponent`
  // defines and the template renders. As in Shoelace's base element, each one that is not defined yet is defined when a
  // checkbox is constructed, and a tag that another constructor already owns is left alone (with Shoelace's
  // warning when the registered version differs from its own). If the platform refuses the
  // class itself (for example because it is already registered under another tag), an anonymous subclass is defined
  // instead, as Shoelace does. Not part of the documented API (Shoelace's manifest does not document it).
  private static readonly shoelaceDependencies: readonly VelcroComponentConstructor[] = [VelcroIcon];

  public constructor() {
    super();
    for (const component of VelcroCheckbox.shoelaceDependencies) defineVelcroComponent(component);
  }

  private readonly formControlController = new FormControlController(this, {
    value: control => ((control as VelcroCheckbox).checked ? control.value || 'on' : undefined),
    defaultValue: control => (control as VelcroCheckbox).defaultChecked,
    setValue: (control, checked) => {
      (control as VelcroCheckbox).checked = checked as boolean;
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
  private velcroErrorMessage = '';
  private velcroReadonly = false;
  private velcroDir?: string;

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

  @query('input[type="checkbox"]')
  public override input!: HTMLInputElement;

  /** Reactive so that it passes through to the inner checkbox; an empty title keeps validation tooltips from appearing on hover. */
  @property()
  public override title = '';

  /** The name of the checkbox, submitted as a name/value pair with form data. */
  @property()
  public override name = '';

  /** The current value of the checkbox, submitted as a name/value pair with form data. */
  @property()
  public override get value(): string {
    return this.velcroValue as string;
  }
  public override set value(value: string) {
    this.velcroValue = value;
  }

  /** The checkbox's size. */
  @property({ reflect: true })
  public size: 'small' | 'medium' | 'large' = 'medium';

  /**
   * Disables the checkbox.
   * @default false
   */
  @property({ type: Boolean, reflect: true })
  public override get disabled(): boolean {
    return this.velcroDisabled;
  }
  public override set disabled(value: boolean) {
    this.velcroDisabled = value;
  }

  /** Draws the checkbox in a checked state. */
  @property({ type: Boolean, reflect: true })
  public override checked = false;

  /**
   * Draws the checkbox in an indeterminate state. This is usually applied to checkboxes that represents a "select
   * all/none" behavior when associated checkboxes have a mix of checked and unchecked states.
   */
  @property({ type: Boolean, reflect: true })
  public override indeterminate = false;

  /** The default value of the form control. Primarily used for resetting the form control. */
  public defaultChecked = false;

  /**
   * By default, form controls are associated with the nearest containing `<form>` element. This attribute allows you
   * to place the form control outside of a form and associate it with the form that has this `id`. The form must be in
   * the same document or shadow root for this to work.
   */
  @property({ reflect: true })
  public form = '';

  /** Makes the checkbox a required field. */
  @property({ type: Boolean, reflect: true })
  public override required = false;

  /** The checkbox's help text. If you need to display HTML, use the `help-text` slot instead. */
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

  /**
   * Velcro extension (core): keeps the checkbox's state on clicks.
   * @default false
   */
  @property({ type: Boolean, reflect: true })
  public override get readonly(): boolean {
    return this.velcroReadonly;
  }
  public override set readonly(value: boolean) {
    this.velcroReadonly = value;
  }

  /** Velcro extension (core): label text rendered as the default slot's fallback content when the slot is empty. */
  @property({ reflect: true })
  public override label?: string;

  /** Velcro extension (core): visually hides the label and help text, which stay accessible. */
  @property({ type: Boolean, attribute: 'hide-label', reflect: true })
  public override hideLabel = false;

  /**
   * Velcro extension (core), inert: accepted and reflected for compatibility with the core checkbox, but not
   * maintained and without effect. Use `validity` or the `data-invalid` attribute, as in Shoelace.
   */
  @property({ type: Boolean, reflect: true })
  public override invalid = false;

  /** Velcro extension (core), inert: accepted and reflected for compatibility with the core checkbox, without effect. */
  @property({ attribute: 'label-position', reflect: true })
  public override labelPosition?: 'end' | 'start' | 'top';

  /**
   * Velcro extension (core), inert: accepted and reflected for compatibility with the core checkbox, without effect.
   * As in Shoelace, the checkbox is not focused on page load.
   */
  @property({ type: Boolean, reflect: true })
  public override autofocus = false;

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
      (this.constructor as typeof VelcroCheckbox).elementProperties.forEach((options, prop) => {
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

  // Skips core's checkbox willUpdate, which writes ElementInternals form state and runs core's own validation; the
  // form-control base's label and help text bookkeeping still runs.
  protected override willUpdate(changed: PropertyValues<this>) {
    (CharmFormControlElement.prototype as unknown as { willUpdate(c: PropertyValues): void }).willUpdate.call(this, changed);
    this.initialReflectedProperties.forEach((value, prop) => {
      const self = this as unknown as Record<string, unknown>;
      if (changed.has(prop as keyof VelcroCheckbox) && self[prop] == null) {
        self[prop] = value;
      }
    });
  }

  protected override update(changed: PropertyValues<this>) {
    // Shoelace's `@watch` handlers with `waitUntilFirstUpdate: true` run before render, the last-declared watcher
    // first: `checked` and `indeterminate` (once for each that changed), then `disabled`.
    if (this.hasUpdated) {
      for (const prop of ['checked', 'indeterminate'] as const) {
        if (changed.has(prop) && changed.get(prop) !== this[prop]) {
          this.handleStateChange();
        }
      }
      if (changed.has('disabled') && changed.get('disabled') !== this.disabled) {
        this.handleDisabledChange();
      }
    }
    super.update(changed);
  }

  // Skips core's checkbox and form-control firstUpdated (ElementInternals validity and core's initial value); core's
  // base element still emits `ready`.
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

  /** Toggles the checkbox from a click on the inner checkbox and clears `indeterminate`. A `readonly` checkbox keeps its state. */
  protected override handleClick(event?: Event) {
    if (this.readonly) {
      event?.preventDefault();
      return;
    }
    this.checked = !this.checked;
    this.indeterminate = false;
    this.emit('sl-change');
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

  protected override handleFocus() {
    this.hasFocus = true;
    this.emit('sl-focus');
  }

  public handleDisabledChange() {
    // Disabled form controls are always valid
    this.formControlController.setValidity(this.disabled);
  }

  public handleStateChange() {
    this.input.checked = this.checked; // force a sync update
    this.input.indeterminate = this.indeterminate; // force a sync update
    this.formControlController.updateValidity();
  }

  /** Simulates a click on the checkbox. */
  public override click() {
    this.input.click();
  }

  /** Sets focus on the checkbox. */
  public override focus(options?: FocusOptions) {
    this.input.focus(options);
  }

  /** Removes focus from the checkbox. */
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

  /**
   * Sets a custom validation message. The value provided will be shown to the user when the form is submitted. To clear
   * the custom validation message, call this method with an empty string.
   */
  public override setCustomValidity(message: string) {
    this.input.setCustomValidity(message);
    this.formControlController.updateValidity();
  }

  // Core calls this when validity may have changed; the Velcro form control controller owns the validity attributes.
  protected override updateValidity() {
    if (!this.input) return;
    this.formControlController.updateValidity();
  }

  // Core's form reset; the form control controller restores `defaultChecked` on a form reset, as in Shoelace.
  protected override formResetCallback() {
    this.checked = this.defaultChecked;
  }

  public override render() {
    const hasHelpTextSlot = this.hasSlotController.test('help-text');
    const hasHelpText = this.helpText ? true : !!hasHelpTextSlot;

    //
    // NOTE: we use a <div> around the label slot because of this Chrome bug.
    //
    // https://bugs.chromium.org/p/chromium/issues/detail?id=1413733
    //
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
            checkbox: true,
            'checkbox--checked': this.checked,
            'checkbox--disabled': this.disabled,
            'checkbox--focused': this.hasFocus,
            'checkbox--indeterminate': this.indeterminate,
            'checkbox--small': this.size === 'small',
            'checkbox--medium': this.size === 'medium',
            'checkbox--large': this.size === 'large',
          })}
        >
          <input
            class="checkbox__input"
            type="checkbox"
            title=${this.title /* An empty title prevents browser validation tooltips from appearing on hover */}
            name=${this.name}
            value=${ifDefined(this.value)}
            .indeterminate=${live(this.indeterminate)}
            .checked=${live(this.checked)}
            .disabled=${this.disabled}
            .required=${this.required}
            aria-checked=${this.checked ? 'true' : 'false'}
            aria-describedby="help-text"
            @click=${this.handleClick}
            @input=${this.handleInput}
            @invalid=${this.handleInvalid}
            @blur=${this.handleBlur}
            @focus=${this.handleFocus}
          />

          <span
            part="control${this.checked ? ' control--checked' : ''}${this.indeterminate ? ' control--indeterminate' : ''}"
            class="checkbox__control"
          >
            ${this.checked
              ? html`
                  <sl-icon part="checked-icon" class="checkbox__checked-icon" library="system" name="check"></sl-icon>
                `
              : ''}
            ${!this.checked && this.indeterminate
              ? html`
                  <sl-icon
                    part="indeterminate-icon"
                    class="checkbox__indeterminate-icon"
                    library="system"
                    name="indeterminate"
                  ></sl-icon>
                `
              : ''}
          </span>

          <div part="label" class=${classMap({ checkbox__label: true, 'visually-hidden': this.hideLabel })}>
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

export default VelcroCheckbox;
