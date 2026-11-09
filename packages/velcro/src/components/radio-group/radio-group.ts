// Adapted from Shoelace v2.20.1 (src/components/radio-group/radio-group.component.ts, the validity states in
// src/internal/form.ts and the reflected-property restore in src/internal/shoelace-element.ts), Copyright (c) 2020
// A Beautiful Site, LLC, MIT License. See THIRD_PARTY_NOTICES.md.
// The API documentation wording, the rendered structure (a `form-control` <fieldset role="radiogroup"> with the label,
// the visually hidden error message and validation input, the default slot, wrapped in an <sl-button-group> when it
// holds radio buttons, and the help text), the selection, keyboard and focus handling, the radio synchronisation and the
// form participation and validation API follow Shoelace, including its quirks (each one is marked "Upstream quirk").
// Velcro changes: built on the @charm-ux/core radio group through Velcro's local scope resolver (core-only extras are
// kept where they do not change Shoelace's behaviour, see the class comment).
import { css, html, LitElement, type PropertyValues } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { CharmElement } from '@charm-ux/core/dist/base/charm-element/charm-element.js';
import { CharmFocusableElement } from '@charm-ux/core/dist/base/focusable-element/charm-focusable-element.js';
import { CoreRadioGroup } from '@charm-ux/core/dist/components/radio-group/radio-group.js';
import {
  customErrorValidityState,
  FormControlController,
  validValidityState,
  valueMissingValidityState,
} from '../../internal/form.js';
import { useVelcroScope } from '../../internal/scope.js';
import { defineVelcroComponent, type VelcroComponentConstructor } from '../../utilities/registration.js';
import { VelcroButtonGroup } from '../button-group/class.js';
import type { VelcroRadioButton } from '../radio-button/radio-button.js';
import type { VelcroRadio } from '../radio/radio.js';
import styles from './radio-group.styles.js';

type Radio = VelcroRadio | VelcroRadioButton;

/** Upstream `@watch` handlers receive the previous and the current value. */
type WatchHandler = (oldValue: unknown, newValue: unknown) => void;

/**
 * Radio groups are used to group multiple radios or radio buttons so they function as a single form control. API
 * modelled on Shoelace's `sl-radio-group`. Like Shoelace's, constructing a radio group defines its dependency
 * `<sl-button-group>` (Velcro's) when no element owns that tag yet. The radios themselves (`<sl-radio>`,
 * `<sl-radio-button>`) are registered by their own entries, as in Shoelace.
 *
 * Velcro extensions inherited from the core radio group and kept working, none of which changes anything unless it is
 * set: `disabled` (disables every radio it holds, also radios added later, and when removed re-enables exactly the
 * radios it disabled; a disabled group is left out of form data, is barred from validation like a disabled native
 * control and ignores the keyboard), `readonly` (clicks and keys do not change the value), `hide-label` (visually hides
 * the label and help text, which stay accessible) and `error-message` (sets a custom validity message, like `setCustomValidity()`). The core `layout`,
 * `invalid` and `label-position` properties are accepted and reflected but have no effect (use `data-invalid`, as in
 * Shoelace). `autofocus` is the platform's own property, as in Shoelace. Core's `ready` event is emitted on the first
 * update. As with every Velcro form control the host carries core's `focusable` attribute.
 *
 * @tag sl-radio-group
 * @status prototype
 *
 * @dependency sl-button-group
 *
 * @slot - The default slot where `<sl-radio>` or `<sl-radio-button>` elements are placed.
 * @slot label - The radio group's label. Required for proper accessibility. Alternatively, you can use the `label`
 *  attribute.
 * @slot help-text - Text that describes how to use the radio group. Alternatively, you can use the `help-text` attribute.
 *
 * @event sl-change - Emitted when the radio group's selected value changes.
 * @event sl-input - Emitted when the radio group receives user input.
 * @event sl-invalid - Emitted when the form control has been checked for validity and its constraints aren't satisfied.
 *
 * @inheritedEventDropped change - Never emitted: Shoelace's `sl-change` is emitted instead.
 * @inheritedEventDropped input - Never emitted: Shoelace's `sl-input` is emitted instead.
 * @inheritedEventDropped blur - Never emitted by the group: its radios emit `sl-blur`.
 * @inheritedEventDropped focus - Never emitted by the group: its radios emit `sl-focus`.
 *
 * @csspart form-control - The form control that wraps the label, input, and help text.
 * @csspart form-control-label - The label's wrapper.
 * @csspart form-control-input - The input's wrapper.
 * @csspart form-control-help-text - The help text's wrapper.
 * @csspart button-group - The button group that wraps radio buttons.
 * @csspart button-group__base - The button group's `base` part.
 */
export class VelcroRadioGroup extends CoreRadioGroup {
  // Only Shoelace's styles (with its shared component and form control styles): core's base and radio group styles
  // would, for example, hide the host for the `hidden` attribute and style core's own structure.
  public static override styles = [
    styles,
    css`
      /* Velcro extension (core): visually hides the label and help text for hide-label. */
      .form-control__label.visually-hidden,
      .form-control__help-text.visually-hidden {
        position: absolute !important;
        width: 1px !important;
        height: 1px !important;
        clip: rect(0 0 0 0) !important;
        clip-path: inset(50%) !important;
        border: none !important;
        overflow: hidden !important;
        white-space: nowrap !important;
        padding: 0 !important;
        margin: -1px !important;
      }
    `,
  ];

  // Shoelace's radio group uses Lit's default shadow root options ({ mode: 'open' }). Core's focusable base delegates
  // focus, which would, for example, focus a radio on a click on the help text.
  public static override shadowRootOptions = { ...LitElement.shadowRootOptions } as typeof CoreRadioGroup.shadowRootOptions;

  // Shoelace's radio group is not form-associated: the form is found from `form` / the closest <form> and the value is
  // added in its `formdata` event. Core's ElementInternals association is switched off.
  protected static override formAssociated = false;

  // Core's error message template renders a core icon; this template renders only <sl-button-group>, which is
  // registered below as Shoelace registers its dependencies.
  public static override get dependencies() {
    return [];
  }

  // Shoelace's `static dependencies` for the radio group: the elements its template renders. Shoelace keys them by tag;
  // here the tag is derived from each class's `baseName` (`sl-button-group`). As in Shoelace's base element, each one
  // that is not defined yet is defined when a radio group is constructed, a tag that another constructor already owns
  // is left alone (with Shoelace's warning when the versions differ), and if the platform refuses the class itself an
  // anonymous subclass is defined instead. Core's own array-typed `dependencies` stays empty. Not part of the
  // documented API.
  private static readonly shoelaceDependencies: readonly VelcroComponentConstructor[] = [VelcroButtonGroup];

  // `autofocus` is the platform's own property, as in Shoelace (see the accessor installed after the class): core's
  // reactive, asynchronously reflected `autofocus` and its observed attribute are not used.
  public static override get observedAttributes() {
    return super.observedAttributes.filter(name => name !== 'autofocus');
  }

  public constructor() {
    super();
    constructed.add(this);
    for (const component of VelcroRadioGroup.shoelaceDependencies) defineVelcroComponent(component);
  }

  protected readonly formControlController = new FormControlController(this);
  private customValidityMessage = '';
  private validationTimeout?: number;
  private hasRecordedInitialProperties = false;
  private readonly initialReflectedProperties = new Map<string, unknown>();
  private readonly radiosDisabledByGroup = new Set<Radio>();
  private velcroValue = '';
  private velcroDisabled = false;
  private velcroReadonly = false;
  private velcroErrorMessage = '';
  private velcroDir?: string;

  /** The default slot element in the shadow root. */
  @query('slot:not([name])')
  public defaultSlot!: HTMLSlotElement;

  /** The visually hidden input that carries the group's constraint validation. */
  @query('.radio-group__validation-input')
  public validationInput!: HTMLInputElement;

  @state()
  private hasButtonGroup = false;

  // Shoelace's private `errorMessage` state (the text of the visually hidden live region). Renamed, because core's
  // public `errorMessage` is kept as a Velcro extension.
  @state()
  private validationErrorMessage = '';

  /** The default value of the form control. Primarily used for resetting the form control. */
  @state()
  public defaultValue = '';

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

  /**
   * The radio group's label. Required for proper accessibility. If you need to display HTML, use the `label` slot
   * instead.
   */
  @property()
  public override label = '';

  /** The radio groups's help text. If you need to display HTML, use the `help-text` slot instead. */
  @property({ attribute: 'help-text' })
  public override helpText = '';

  /** The name of the radio group, submitted as a name/value pair with form data. */
  @property()
  public override name = 'option';

  /**
   * The current value of the radio group, submitted as a name/value pair with form data.
   * @default ''
   */
  @property({ reflect: true })
  public override get value(): string {
    return this.velcroValue;
  }
  public override set value(value: string) {
    this.velcroValue = value;
  }

  /** The radio group's size. This size will be applied to all child radios and radio buttons. */
  @property({ reflect: true })
  public size: 'small' | 'medium' | 'large' = 'medium';

  /**
   * By default, form controls are associated with the nearest containing `<form>` element. This attribute allows you
   * to place the form control outside of a form and associate it with the form that has this `id`. The form must be in
   * the same document or shadow root for this to work.
   */
  @property({ reflect: true })
  public form = '';

  /** Ensures a child radio is checked before allowing the containing form to submit. */
  @property({ type: Boolean, reflect: true })
  public override required = false;

  /**
   * Velcro extension (core): disables every radio in the group. Removing it re-enables only the radios that were not
   * disabled before. A disabled group is left out of form data and, like a disabled native control, is barred from
   * validation: it is valid, `checkValidity()` and `reportValidity()` (also the form's) return `true` without an
   * `sl-invalid` event or message, and enabling it restores its required or custom validity.
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
   * Velcro extension (core): clicks and keys do not change the group's value.
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
   * Velcro extension (core): a custom validity message, applied with `setCustomValidity()` after the next update. An
   * empty string restores validity.
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

  /** Velcro extension (core), inert: accepted and reflected for compatibility with the core radio group, without effect. */
  @property({ reflect: true })
  public override layout?: 'horizontal' | 'vertical' | 'horizontal-stacked';

  /**
   * Velcro extension (core), inert: accepted and reflected for compatibility with the core radio group, but not
   * maintained and without effect. Use `validity` or the `data-invalid` attribute, as in Shoelace.
   */
  @property({ type: Boolean, reflect: true })
  public override invalid = false;

  /** Velcro extension (core), inert: accepted and reflected for compatibility with the core radio group, without effect. */
  @property({ attribute: 'label-position', reflect: true })
  public override labelPosition?: 'end' | 'start' | 'top';

  /** Gets the validity state object */
  public override get validity() {
    // Velcro extension (core) `disabled`: like a disabled native control, a disabled group is barred from validation.
    // The value and any custom validity message are kept, so enabling the group restores its validity.
    if (this.disabled) return validValidityState;
    const isRequiredAndEmpty = this.required && !this.value;
    const hasCustomValidityMessage = this.customValidityMessage !== '';

    if (hasCustomValidityMessage) {
      return customErrorValidityState;
    } else if (isRequiredAndEmpty) {
      return valueMissingValidityState;
    }

    return validValidityState;
  }

  /** Gets the validation message */
  public override get validationMessage() {
    if (this.disabled) return '';
    const isRequiredAndEmpty = this.required && !this.value;
    const hasCustomValidityMessage = this.customValidityMessage !== '';

    if (hasCustomValidityMessage) {
      return this.customValidityMessage;
    } else if (isRequiredAndEmpty) {
      return this.validationInput.validationMessage;
    }

    return '';
  }

  // Skips core's radio group and form-control connectedCallbacks: the first makes the host a tab stop with focus and
  // blur listeners, the second writes ElementInternals form state that a non-form-associated element cannot hold. Core's
  // focusable and base element setup still runs. Async only because core's declared signature is.
  public override async connectedCallback(): Promise<void> {
    CharmFocusableElement.prototype.connectedCallback.call(this);
    this.defaultValue = this.value;
  }

  // Records the reflected properties' values the first time any observed attribute changes, so that removing a reflected
  // attribute later restores that value instead of leaving the property null. Same timing and rule as Shoelace's base.
  public override attributeChangedCallback(name: string, previous: string | null, next: string | null) {
    if (!this.hasRecordedInitialProperties) {
      (this.constructor as typeof VelcroRadioGroup).elementProperties.forEach((options, prop) => {
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

  // Core's own willUpdate (layout, readonly, disabled and autofocus handling and its label and help text state) is not
  // called; the `disabled` and `readonly` extensions are applied here instead.
  protected override willUpdate(changed: PropertyValues<this>) {
    this.initialReflectedProperties.forEach((value, prop) => {
      const self = this as unknown as Record<string, unknown>;
      if (changed.has(prop as keyof VelcroRadioGroup) && self[prop] == null) {
        self[prop] = value;
      }
    });
    if (changed.has('disabled') && (this.disabled || changed.get('disabled') === true)) {
      this.applyDisabled();
      // A disabled group is valid (see `validity`); enabling it brings back its required or custom error state.
      this.updateValidity();
    }
    if (changed.has('readonly') && (this.readonly || changed.get('readonly') === true)) {
      this.getAllRadioElements().forEach(radio => {
        if ('readonly' in radio) radio.readonly = this.readonly;
      });
    }
  }

  // Shoelace's `@watch('value')` (also before the first update) and `@watch('size', { waitUntilFirstUpdate: true })`,
  // run before the render. Each upstream `@watch` wraps `update` in turn, so the watcher declared last runs first.
  protected override update(changed: PropertyValues<this>) {
    // Like Shoelace's decorator, each handler receives the previous and the current value.
    if (changed.has('value') && changed.get('value') !== this.value) {
      (this.handleValueChange as WatchHandler).call(this, changed.get('value'), this.value);
    }
    if (this.hasUpdated && changed.has('size') && changed.get('size') !== this.size) {
      (this.handleSizeChange as WatchHandler).call(this, changed.get('size'), this.size);
    }
    super.update(changed);
  }

  // Skips core's radio group and form-control firstUpdated (ElementInternals validity); core's base element still emits
  // `ready`.
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

  private getAllRadioElements(): Radio[] {
    return [...this.querySelectorAll<Radio>('sl-radio, sl-radio-button')];
  }

  // Velcro extension (core): while the group is disabled, disables every radio that is not disabled yet (also on each
  // later radio sync, so radios added later follow) and records it; when the group is enabled again, re-enables exactly
  // the radios it disabled. Radios that were disabled on their own stay disabled.
  private applyDisabled() {
    if (this.disabled) {
      this.getAllRadioElements().forEach(radio => {
        if (!radio.disabled) {
          radio.disabled = true;
          this.radiosDisabledByGroup.add(radio);
        }
      });
    } else {
      this.radiosDisabledByGroup.forEach(radio => (radio.disabled = false));
      this.radiosDisabledByGroup.clear();
    }
  }

  private handleRadioClick(event: MouseEvent) {
    const target = (event.target as HTMLElement).closest<Radio>('sl-radio, sl-radio-button');
    const radios = this.getAllRadioElements();
    const oldValue = this.value;

    // The `readonly` check is the Velcro extension; without it this is Shoelace's handler.
    if (!target || target.disabled || this.readonly) {
      return;
    }

    this.value = target.value;
    radios.forEach(radio => (radio.checked = radio === target));

    if (this.value !== oldValue) {
      this.emit('sl-change');
      this.emit('sl-input');
    }
  }

  /** Moves the selection with the arrow keys and selects the focused radio with Space, as Shoelace does. */
  protected override handleKeyDown(event: KeyboardEvent) {
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) {
      return;
    }

    // Velcro extensions (core): a read-only group keeps its value, and a disabled group ignores the keyboard (with every
    // radio disabled, Shoelace's handler would read past the end of an empty list and throw).
    if (this.readonly || this.disabled) {
      return;
    }

    const radios = this.getAllRadioElements().filter(radio => !radio.disabled);
    const checkedRadio = radios.find(radio => radio.checked) ?? radios[0];
    const incr = event.key === ' ' ? 0 : ['ArrowUp', 'ArrowLeft'].includes(event.key) ? -1 : 1;
    const oldValue = this.value;
    let index = radios.indexOf(checkedRadio) + incr;

    if (index < 0) {
      index = radios.length - 1;
    }

    if (index > radios.length - 1) {
      index = 0;
    }

    this.getAllRadioElements().forEach(radio => {
      radio.checked = false;

      if (!this.hasButtonGroup) {
        radio.setAttribute('tabindex', '-1');
      }
    });

    this.value = radios[index].value;
    radios[index].checked = true;

    if (!this.hasButtonGroup) {
      radios[index].setAttribute('tabindex', '0');
      radios[index].focus();
    } else {
      radios[index].shadowRoot!.querySelector('button')!.focus();
    }

    if (this.value !== oldValue) {
      this.emit('sl-change');
      this.emit('sl-input');
    }

    event.preventDefault();
  }

  private handleLabelClick() {
    this.focus();
  }

  private handleInvalid(event: Event) {
    this.formControlController.setValidity(false);
    this.formControlController.emitInvalidEvent(event);
  }

  private async syncRadioElements() {
    const radios = this.getAllRadioElements();

    await Promise.all(
      // Sync the checked state and size
      radios.map(async radio => {
        await radio.updateComplete;
        radio.checked = radio.value === this.value;
        radio.size = this.size;
      }),
    );

    this.hasButtonGroup = radios.some(radio => radio.tagName.toLowerCase() === 'sl-radio-button');

    if (radios.length > 0 && !radios.some(radio => radio.checked)) {
      if (this.hasButtonGroup) {
        const buttonRadio = radios[0].shadowRoot?.querySelector('button');

        if (buttonRadio) {
          buttonRadio.setAttribute('tabindex', '0');
        }
      } else {
        radios[0].setAttribute('tabindex', '0');
      }
    }

    if (this.hasButtonGroup) {
      const buttonGroup = this.shadowRoot?.querySelector<VelcroButtonGroup>('sl-button-group');

      if (buttonGroup) {
        buttonGroup.disableRole = true;
      }
    }

    // Velcro extension (core): radios added to a disabled or read-only group follow it.
    if (this.disabled) this.applyDisabled();
    if (this.readonly) {
      radios.forEach(radio => {
        if ('readonly' in radio) radio.readonly = true;
      });
    }
  }

  private syncRadios() {
    if (customElements.get('sl-radio') && customElements.get('sl-radio-button')) {
      void this.syncRadioElements();
      return;
    }

    if (customElements.get('sl-radio')) {
      void this.syncRadioElements();
    } else {
      void customElements.whenDefined('sl-radio').then(() => this.syncRadios());
    }

    if (customElements.get('sl-radio-button')) {
      void this.syncRadioElements();
    } else {
      // Rerun this handler when <sl-radio> or <sl-radio-button> is registered
      void customElements.whenDefined('sl-radio-button').then(() => this.syncRadios());
    }
  }

  protected override updateCheckedRadio() {
    const radios = this.getAllRadioElements();
    radios.forEach(radio => (radio.checked = radio.value === this.value));
    this.formControlController.setValidity(this.validity.valid);
  }

  /**
   * Applies the group's size to its radios after the first update. Called before the render with the previous and the
   * current size, as Shoelace's `@watch` decorator calls it.
   */
  public handleSizeChange() {
    this.syncRadios();
  }

  /**
   * Checks the radio that matches the new value once the group has rendered. Called before the render with the
   * previous and the current value, as Shoelace's `@watch` decorator calls it.
   */
  public override handleValueChange() {
    if (this.hasUpdated) {
      this.updateCheckedRadio();
    }
  }

  // Core's layout handling is not used: `layout` is inert (see the class comment).
  protected override handleLayoutChange() {}

  /** Checks for validity but does not show a validation message. Returns `true` when valid and `false` when invalid. */
  public override checkValidity() {
    // A disabled group (Velcro extension) is valid and emits no `sl-invalid`, as `reportValidity()` (through `validity`).
    if (this.disabled) return true;
    const isRequiredAndEmpty = this.required && !this.value;
    const hasCustomValidityMessage = this.customValidityMessage !== '';

    if (isRequiredAndEmpty || hasCustomValidityMessage) {
      this.formControlController.emitInvalidEvent();
      return false;
    }

    return true;
  }

  /** Gets the associated form, if one exists. */
  public getForm(): HTMLFormElement | null {
    return this.formControlController.getForm();
  }

  /** Checks for validity and shows the browser's validation message if the control is invalid. */
  public override reportValidity(): boolean {
    const isValid = this.validity.valid;

    // Upstream quirk: this reads as `(custom message || isValid) ? '' : message`, so a custom validity message empties
    // the live region instead of showing that message.
    this.validationErrorMessage = this.customValidityMessage || isValid ? '' : this.validationInput.validationMessage;
    this.formControlController.setValidity(isValid);
    this.validationInput.hidden = true;
    clearTimeout(this.validationTimeout);

    if (!isValid) {
      // Show the browser's constraint validation message
      this.validationInput.hidden = false;
      this.validationInput.reportValidity();
      this.validationTimeout = setTimeout(() => (this.validationInput.hidden = true), 10000) as unknown as number;
    }

    return isValid;
  }

  /** Sets a custom validation message. Pass an empty string to restore validity. */
  public override setCustomValidity(message = '') {
    this.customValidityMessage = message;
    this.validationErrorMessage = message;
    this.validationInput.setCustomValidity(message);
    this.formControlController.updateValidity();
  }

  /** Velcro extension (core): updates the validity data attributes, once rendered. */
  public override updateValidity() {
    if (!this.validationInput) return;
    this.formControlController.updateValidity();
  }

  /** Velcro extension (core): restores `value` to `defaultValue`, as a form reset does. */
  public override formResetCallback() {
    this.value = this.defaultValue;
  }

  /** Sets focus on the radio-group. */
  public override focus(options?: FocusOptions) {
    const radios = this.getAllRadioElements();
    const checked = radios.find(radio => radio.checked);
    const firstEnabledRadio = radios.find(radio => !radio.disabled);
    const radioToFocus = checked || firstEnabledRadio;

    // Call focus for the checked radio
    // If no radio is checked, focus the first one that is not disabled
    if (radioToFocus) {
      radioToFocus.focus(options);
    }
  }

  protected override render() {
    const hasLabelSlot = this.hasSlotController.test('label');
    const hasHelpTextSlot = this.hasSlotController.test('help-text');
    const hasLabel = this.label ? true : !!hasLabelSlot;
    const hasHelpText = this.helpText ? true : !!hasHelpTextSlot;
    const defaultSlot = html`
      <slot @slotchange=${this.syncRadios} @click=${this.handleRadioClick} @keydown=${this.handleKeyDown}></slot>
    `;

    return html`
      <fieldset
        part="form-control"
        class=${classMap({
          'form-control': true,
          'form-control--small': this.size === 'small',
          'form-control--medium': this.size === 'medium',
          'form-control--large': this.size === 'large',
          'form-control--radio-group': true,
          'form-control--has-label': hasLabel,
          'form-control--has-help-text': hasHelpText,
        })}
        role="radiogroup"
        aria-labelledby="label"
        aria-describedby="help-text"
        aria-errormessage="error-message"
      >
        <label
          part="form-control-label"
          id="label"
          class=${classMap({ 'form-control__label': true, 'visually-hidden': this.hideLabel })}
          aria-hidden=${hasLabel ? 'false' : 'true'}
          @click=${this.handleLabelClick}
        >
          <slot name="label">${this.label}</slot>
        </label>

        <div part="form-control-input" class="form-control-input">
          <div class="visually-hidden">
            <div id="error-message" aria-live="assertive">${this.validationErrorMessage}</div>
            <label class="radio-group__validation">
              <input
                type="text"
                class="radio-group__validation-input"
                ?required=${this.required}
                tabindex="-1"
                hidden
                @invalid=${this.handleInvalid}
              />
            </label>
          </div>

          ${this.hasButtonGroup
            ? html`
                <sl-button-group part="button-group" exportparts="base:button-group__base" role="presentation">
                  ${defaultSlot}
                </sl-button-group>
              `
            : defaultSlot}
        </div>

        <div
          part="form-control-help-text"
          id="help-text"
          class=${classMap({ 'form-control__help-text': true, 'visually-hidden': this.hideLabel })}
          aria-hidden=${hasHelpText ? 'false' : 'true'}
        >
          <slot name="help-text">${this.helpText}</slot>
        </div>
      </fieldset>
    `;
  }
}

// Upstream behavior: `autofocus` is HTMLElement's own property, which reflects the attribute synchronously. The
// accessor on this prototype hides core's reactive one. Core's constructor assigns `autofocus = false`, which would
// remove an `autofocus` attribute the element is upgraded with, so writes are ignored until the group's own constructor
// has run. The same approach as sl-radio.
const constructed = new WeakSet<object>();
const nativeAutofocus = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'autofocus');
if (nativeAutofocus?.get && nativeAutofocus.set) {
  const { get, set } = nativeAutofocus;
  Object.defineProperty(VelcroRadioGroup.prototype, 'autofocus', {
    configurable: true,
    enumerable: true,
    get(this: HTMLElement) {
      return get.call(this);
    },
    set(this: HTMLElement, value: boolean) {
      if (constructed.has(this)) set.call(this, value);
    },
  });
}

// Velcro's local scope: core's radio group template asks the scope for its icon tag, and without a scope of its own the
// group could pick up core's scope if a page configured core with the `sl` prefix.
useVelcroScope(VelcroRadioGroup);

export default VelcroRadioGroup;
