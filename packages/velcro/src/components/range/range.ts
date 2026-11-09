// Adapted from Shoelace v2.20.1 (src/components/range/range.component.ts, the `defaultValue` decorator in
// src/internal/default-value.ts, the `watch` decorator in src/internal/watch.ts and the `dir` and `lang` declarations
// and the reflected-property restore in src/internal/shoelace-element.ts), Copyright (c) 2020 A Beautiful Site, LLC, MIT
// License. See THIRD_PARTY_NOTICES.md. The API documentation wording, the rendered structure (a `form-control` wrapper
// around the label, a `base` box holding the native `<input type="range">` and the tooltip `<output>`, and the help
// text), the events, the tooltip placement logic, the validation and form participation API and `stepUp()` /
// `stepDown()` follow Shoelace. Velcro changes: built on the @charm-ux/core base element (core has no range). Shoelace's
// behavior is matched exactly, including its quirks; each one is marked "Upstream quirk" below and listed on the docs
// page.
import { html, type PropertyValues } from 'lit';
import { eventOptions, property, query, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { live } from 'lit/directives/live.js';
import { CharmElement } from '@charm-ux/core/dist/base/charm-element/charm-element.js';
import { FormControlController, type VelcroFormControl } from '../../internal/form.js';
import { documentDir } from '../../internal/localize.js';
import { HasSlotController } from '../../internal/slot.js';
import { LocalizeController } from '../../utilities/localize.js';
import styles from './range.styles.js';

// Built on the @charm-ux/core base element: @charm-ux/core has no range component to extend. The only core extension
// that remains is the non-bubbling `ready` event on first update.
/**
 * Ranges allow the user to select a single value within a given range using a slider. API modelled on Shoelace's
 * `sl-range`.
 *
 * Velcro extension inherited from the core base element and kept: the non-bubbling `ready` event, emitted on the first
 * update.
 *
 * @tag sl-range
 * @status prototype
 *
 * @slot label - The range's label. Alternatively, you can use the `label` attribute.
 * @slot help-text - Text that describes how to use the input. Alternatively, you can use the `help-text` attribute.
 *
 * @event sl-blur - Emitted when the control loses focus.
 * @event sl-change - Emitted when an alteration to the control's value is committed by the user.
 * @event sl-focus - Emitted when the control gains focus.
 * @event sl-input - Emitted when the control receives input.
 * @event sl-invalid - Emitted when the form control has been checked for validity and its constraints aren't satisfied.
 *
 * @csspart form-control - The form control that wraps the label, input, and help text.
 * @csspart form-control-label - The label's wrapper.
 * @csspart form-control-input - The range's wrapper.
 * @csspart form-control-help-text - The help text's wrapper.
 * @csspart base - The component's base wrapper.
 * @csspart input - The internal `<input>` element.
 * @csspart tooltip - The range's tooltip.
 *
 * @cssproperty --thumb-size - The size of the thumb.
 * @cssproperty --tooltip-offset - The vertical distance the tooltip is offset from the track.
 * @cssproperty --track-color-active - The color of the portion of the track that represents the current value.
 * @cssproperty --track-color-inactive - The of the portion of the track that represents the remaining value.
 * @cssproperty --track-height - The height of the track.
 * @cssproperty --track-active-offset - The point of origin of the active track.
 */
export class VelcroRange extends CharmElement implements VelcroFormControl {
  public static override baseName = 'range';

  // Core's base styles are replaced by Shoelace's own (see the styles file).
  public static override styles = [styles];

  private readonly formControlController = new FormControlController(this);

  private readonly hasSlotController = new HasSlotController(this, 'help-text', 'label');

  // Re-renders the range when the document's direction changes, which flips the track and the tooltip placement (see
  // `direction()`).
  private readonly localize = new LocalizeController(this);

  private resizeObserver!: ResizeObserver;

  private velcroDir?: string;

  // Shoelace's base element restores a reflected property's initial value when it becomes null or undefined (see
  // attributeChangedCallback). `disabled` and `form` are the reflected properties here.
  private readonly initialReflectedProperties = new Map<string, unknown>();

  private hasRecordedInitialProperties = false;

  @query('.range__control')
  public input!: HTMLInputElement;

  @query('.range__tooltip')
  public output!: HTMLOutputElement | null;

  @state() private hasFocus = false;
  @state() private hasTooltip = false;

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

  // Reactive so that it passes through to the inner `<input>` (undocumented in Shoelace's API reference).
  @property()
  public override title = '';

  /** The name of the range, submitted as a name/value pair with form data. */
  @property()
  public name = '';

  // Upstream quirk: `value`, `min`, `max`, `step` and `label` are not reflected, so removing their attribute sets the
  // property to null (Shoelace's base element restores only reflected properties). A null `value` makes the next render
  // throw, because the template reads `this.value.toString()`.
  /** The current value of the range, submitted as a name/value pair with form data. */
  @property({ type: Number })
  public value = 0;

  /** The range's label. If you need to display HTML, use the `label` slot instead. */
  @property()
  public label = '';

  /** The range's help text. If you need to display HTML, use the help-text slot instead. */
  @property({ attribute: 'help-text' })
  public helpText = '';

  /** Disables the range. */
  @property({ type: Boolean, reflect: true })
  public disabled = false;

  /** The minimum acceptable value of the range. */
  @property({ type: Number })
  public min = 0;

  /** The maximum acceptable value of the range. */
  @property({ type: Number })
  public max = 100;

  /** The interval at which the range will increase and decrease. */
  @property({ type: Number })
  public step = 1;

  /** The preferred placement of the range's tooltip. */
  @property()
  public tooltip: 'top' | 'bottom' | 'none' = 'top';

  /**
   * A function used to format the tooltip's value. The range's value is passed as the first and only argument. The
   * function should return a string to display in the tooltip.
   */
  @property({ attribute: false })
  public tooltipFormatter: (value: number) => string = (value: number) => value.toString();

  /**
   * By default, form controls are associated with the nearest containing `<form>` element. This attribute allows you
   * to place the form control outside of a form and associate it with the form that has this `id`. The form must be in
   * the same document or shadow root for this to work.
   */
  @property({ reflect: true })
  public form = '';

  /** The default value of the form control. Primarily used for resetting the form control. */
  public defaultValue = 0;

  /** Gets the validity state object */
  public get validity() {
    return this.input.validity;
  }

  /** Gets the validation message */
  public get validationMessage() {
    return this.input.validationMessage;
  }

  public override connectedCallback() {
    super.connectedCallback();
    this.resizeObserver = new ResizeObserver(() => this.syncRange());

    if (this.value < this.min) {
      this.value = this.min;
    }
    if (this.value > this.max) {
      this.value = this.max;
    }

    this.updateComplete.then(() => {
      this.syncRange();
      this.resizeObserver.observe(this.input);
    });
  }

  // Upstream quirk: a range that is disconnected before its first render has no input, and `unobserve(null)` throws a
  // TypeError, as in Shoelace.
  public override disconnectedCallback() {
    super.disconnectedCallback();
    this.resizeObserver?.unobserve(this.input);
  }

  // Records the reflected properties' values the first time any attribute changes (during upgrade, before the
  // attribute values are applied), so that a reflected property set to null or undefined later (for a boolean, by
  // assignment; removing its attribute already yields false) gets that value back instead. Same timing and rule as
  // Shoelace's base element. A change of the `value` attribute also sets `defaultValue`, as Shoelace's `defaultValue()`
  // decorator does (the attribute's converted value; `null` when the attribute is removed).
  public override attributeChangedCallback(name: string, previous: string | null, next: string | null) {
    if (name === 'value') {
      const converted = next === null ? null : Number(next);
      if (this.value !== converted) {
        this.defaultValue = converted as number;
      }
    }
    if (!this.hasRecordedInitialProperties) {
      (this.constructor as typeof VelcroRange).elementProperties.forEach((options, prop) => {
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
      if (changed.has(prop as keyof VelcroRange) && self[prop] == null) {
        self[prop] = value;
      }
    });
  }

  // Shoelace's `@watch` handlers with `waitUntilFirstUpdate: true` run before render. Each decorator wraps the update
  // method that was installed before it, so the last one declared runs first: `hasTooltip`, then `disabled`, then
  // `value`.
  protected override update(changed: PropertyValues) {
    if (this.hasUpdated && changed.has('hasTooltip') && changed.get('hasTooltip') !== this.hasTooltip) {
      this.syncRange();
    }
    if (this.hasUpdated && changed.has('disabled') && changed.get('disabled') !== this.disabled) {
      this.handleDisabledChange();
    }
    if (this.hasUpdated && changed.has('value') && changed.get('value') !== this.value) {
      this.handleValueChange();
    }
    super.update(changed);
  }

  // Shoelace's controller resolves the direction from the host's `dir` property, else the document's snapshot (`<html
  // dir>`, else ltr), lower-cased. Velcro's shared controller reads the host's `dir` attribute instead, which would miss a
  // direction set only through the property; this component's `dir` returns what was set, by attribute or property, so
  // it resolves the direction the way Shoelace does.
  private direction() {
    return `${this.velcroDir || documentDir()}`.toLowerCase();
  }

  private handleChange() {
    this.emit('sl-change');
  }

  private handleInput() {
    this.value = parseFloat(this.input.value);
    this.emit('sl-input');
    this.syncRange();
  }

  private handleBlur() {
    this.hasFocus = false;
    this.hasTooltip = false;
    this.emit('sl-blur');
  }

  private handleFocus() {
    this.hasFocus = true;
    this.hasTooltip = true;
    this.emit('sl-focus');
  }

  @eventOptions({ passive: true })
  private handleThumbDragStart() {
    this.hasTooltip = true;
  }

  private handleThumbDragEnd() {
    this.hasTooltip = false;
  }

  private syncProgress(percent: number) {
    this.input.style.setProperty('--percent', `${percent * 100}%`);
  }

  private syncTooltip(percent: number) {
    if (this.output !== null) {
      const inputWidth = this.input.offsetWidth;
      const tooltipWidth = this.output.offsetWidth;
      const thumbSize = getComputedStyle(this.input).getPropertyValue('--thumb-size');
      const isRtl = this.direction() === 'rtl';
      const percentAsWidth = inputWidth * percent;

      // The calculations are used to "guess" where the thumb is located. Since we're using the native range control
      // under the hood, we don't have access to the thumb's true coordinates. These measurements can be a pixel or two
      // off depending on the size of the control, thumb, and tooltip dimensions.
      if (isRtl) {
        const x = `${inputWidth - percentAsWidth}px + ${percent} * ${thumbSize}`;
        this.output.style.translate = `calc((${x} - ${tooltipWidth / 2}px - ${thumbSize} / 2))`;
      } else {
        const x = `${percentAsWidth}px - ${percent} * ${thumbSize}`;
        this.output.style.translate = `calc(${x} - ${tooltipWidth / 2}px + ${thumbSize} / 2)`;
      }
    }
  }

  // Shoelace's `value` watcher: public, and listed in its manifest without a description.
  public handleValueChange() {
    this.formControlController.updateValidity();

    // The value may have constraints, so we set the native control's value and sync it back to ensure it adhere's to
    // min, max, and step properly
    this.input.value = this.value.toString();
    this.value = parseFloat(this.input.value);

    this.syncRange();
  }

  // Shoelace's `disabled` watcher: public, and listed in its manifest without a description.
  public handleDisabledChange() {
    // Disabled form controls are always valid
    this.formControlController.setValidity(this.disabled);
  }

  // Shoelace's `hasTooltip` watcher, also called by the value watcher, the resize observer and every input event:
  // public, and listed in its manifest without a description.
  public syncRange() {
    const percent = Math.max(0, (this.value - this.min) / (this.max - this.min));

    this.syncProgress(percent);

    if (this.tooltip !== 'none' && this.hasTooltip) {
      // Ensure updates are drawn before we sync the tooltip
      this.updateComplete.then(() => this.syncTooltip(percent));
    }
  }

  private handleInvalid(event: Event) {
    this.formControlController.setValidity(false);
    this.formControlController.emitInvalidEvent(event);
  }

  /** Sets focus on the range. */
  public override focus(options?: FocusOptions) {
    this.input.focus(options);
  }

  /** Removes focus from the range. */
  public override blur() {
    this.input.blur();
  }

  /** Increments the value of the range by the value of the step attribute. */
  public stepUp() {
    this.input.stepUp();
    if (this.value !== Number(this.input.value)) {
      this.value = Number(this.input.value);
    }
  }

  /** Decrements the value of the range by the value of the step attribute. */
  public stepDown() {
    this.input.stepDown();
    if (this.value !== Number(this.input.value)) {
      this.value = Number(this.input.value);
    }
  }

  /** Checks for validity but does not show a validation message. Returns `true` when valid and `false` when invalid. */
  public checkValidity() {
    return this.input.checkValidity();
  }

  /** Gets the associated form, if one exists. */
  public getForm(): HTMLFormElement | null {
    return this.formControlController.getForm();
  }

  /** Checks for validity and shows the browser's validation message if the control is invalid. */
  public reportValidity() {
    return this.input.reportValidity();
  }

  /** Sets a custom validation message. Pass an empty string to restore validity. */
  public setCustomValidity(message: string) {
    this.input.setCustomValidity(message);
    this.formControlController.updateValidity();
  }

  protected override render() {
    const hasLabelSlot = this.hasSlotController.test('label');
    const hasHelpTextSlot = this.hasSlotController.test('help-text');
    const hasLabel = this.label ? true : !!hasLabelSlot;
    const hasHelpText = this.helpText ? true : !!hasHelpTextSlot;

    // NOTE - always bind value after min/max, otherwise it will be clamped
    return html`
      <div
        part="form-control"
        class=${classMap({
          'form-control': true,
          'form-control--medium': true, // range only has one size
          'form-control--has-label': hasLabel,
          'form-control--has-help-text': hasHelpText,
        })}
      >
        <label
          part="form-control-label"
          class="form-control__label"
          for="input"
          aria-hidden=${hasLabel ? 'false' : 'true'}
        >
          <slot name="label">${this.label}</slot>
        </label>

        <div part="form-control-input" class="form-control-input">
          <div
            part="base"
            class=${classMap({
              range: true,
              'range--disabled': this.disabled,
              'range--focused': this.hasFocus,
              'range--rtl': this.direction() === 'rtl',
              'range--tooltip-visible': this.hasTooltip,
              'range--tooltip-top': this.tooltip === 'top',
              'range--tooltip-bottom': this.tooltip === 'bottom',
            })}
            @mousedown=${this.handleThumbDragStart}
            @mouseup=${this.handleThumbDragEnd}
            @touchstart=${this.handleThumbDragStart}
            @touchend=${this.handleThumbDragEnd}
          >
            <input
              part="input"
              id="input"
              class="range__control"
              title=${this.title /* An empty title prevents browser validation tooltips from appearing on hover */}
              type="range"
              name=${ifDefined(this.name)}
              ?disabled=${this.disabled}
              min=${ifDefined(this.min)}
              max=${ifDefined(this.max)}
              step=${ifDefined(this.step)}
              .value=${live(this.value.toString())}
              aria-describedby="help-text"
              @change=${this.handleChange}
              @focus=${this.handleFocus}
              @input=${this.handleInput}
              @invalid=${this.handleInvalid}
              @blur=${this.handleBlur}
            />
            ${this.tooltip !== 'none' && !this.disabled
              ? html`
                  <output part="tooltip" class="range__tooltip">
                    ${typeof this.tooltipFormatter === 'function' ? this.tooltipFormatter(this.value) : this.value}
                  </output>
                `
              : ''}
          </div>
        </div>

        <div
          part="form-control-help-text"
          id="help-text"
          class="form-control__help-text"
          aria-hidden=${hasHelpText ? 'false' : 'true'}
        >
          <slot name="help-text">${this.helpText}</slot>
        </div>
      </div>
    `;
  }
}

export default VelcroRange;
