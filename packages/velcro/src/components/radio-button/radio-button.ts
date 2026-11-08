// Portions of the API documentation wording in this file, the rendered structure (a `base` wrapper around a
// `role="radio"` button with the `prefix`, `label` and `suffix` slots and the `button` / `button--checked` parts), the
// behavior (the click that checks the radio button unless it is disabled, the focus and blur events, the host's
// `role="presentation"` and `aria-disabled`) and the restore of reflected properties' initial values are adapted from
// Shoelace v2.20.1 (src/components/radio-button/radio-button.component.ts and src/internal/shoelace-element.ts),
// Copyright (c) 2020 A Beautiful Site, LLC, MIT License. See THIRD_PARTY_NOTICES.md. No Shoelace source file or runtime
// is included.
import { html, type PropertyValues } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { CharmElement } from '@charm-ux/core/dist/base/charm-element/charm-element.js';
import { HasSlotController } from '@charm-ux/core/dist/controller/index.js';
import styles from './radio-button.styles.js';

/**
 * Radios buttons allow the user to select a single option from a group using a button-like control. API modelled on
 * Shoelace's `sl-radio-button`. There is no core counterpart, so it extends the core base element. Place radio buttons
 * in an `<sl-radio-group>`, which manages the checked state, the size and the keyboard.
 *
 * Velcro extension inherited from the core base element and kept: the non-bubbling `ready` event, emitted on the first
 * update.
 *
 * @tag sl-radio-button
 * @status prototype
 *
 * @slot - The radio button's label.
 * @slot prefix - A presentational prefix icon or similar element.
 * @slot suffix - A presentational suffix icon or similar element.
 *
 * @event sl-blur - Emitted when the button loses focus.
 * @event sl-focus - Emitted when the button gains focus.
 *
 * @csspart base - The component's base wrapper.
 * @csspart button - The internal `<button>` element.
 * @csspart button--checked - The internal button element when the radio button is checked.
 * @csspart prefix - The container that wraps the prefix.
 * @csspart label - The container that wraps the radio button's label.
 * @csspart suffix - The container that wraps the suffix.
 */
export class VelcroRadioButton extends CharmElement {
  public static override baseName = 'radio-button';

  // Core's base styles are replaced by Shoelace's own (see the styles file). Core adds a `:host([hidden]) { display: none
  // !important }` rule and focus outlines that Shoelace's radio button does not have.
  public static override styles = [styles];

  private readonly hasSlotController = new HasSlotController(this, '[default]', 'prefix', 'suffix');

  // Shoelace's base element restores a reflected property's initial value when its attribute is removed.
  private readonly initialReflectedProperties = new Map<string, unknown>();
  private hasRecordedInitialProperties = false;
  private velcroDir?: string;

  /** The internal `<button>` element. Typed as Shoelace types it. */
  @query('.button')
  public input!: HTMLInputElement;

  /** Shoelace declares this query, but its template renders no `.hidden-input`, so it is always null. */
  @query('.hidden-input')
  public hiddenInput!: HTMLInputElement;

  @state()
  protected hasFocus = false;

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
   * @internal The radio button's checked state. This is exposed as an "internal" attribute so we can reflect it, making
   * it easier to style in button groups.
   */
  @property({ type: Boolean, reflect: true })
  public checked = false;

  /** The radio's value. When selected, the radio group will receive this value. */
  @property()
  public value!: string;

  /** Disables the radio button. */
  @property({ type: Boolean, reflect: true })
  public disabled = false;

  /**
   * The radio button's size. When used inside a radio group, the size will be determined by the radio group's size so
   * this attribute can typically be omitted.
   */
  @property({ reflect: true })
  public size: 'small' | 'medium' | 'large' = 'medium';

  /** Draws a pill-style radio button with rounded edges. */
  @property({ type: Boolean, reflect: true })
  public pill = false;

  public override connectedCallback() {
    super.connectedCallback();
    this.setAttribute('role', 'presentation');
  }

  // Records the reflected properties' values the first time any observed attribute changes, so that removing a reflected
  // attribute later restores that value instead of leaving the property null. Same timing and rule as Shoelace's base.
  public override attributeChangedCallback(name: string, previous: string | null, next: string | null) {
    if (!this.hasRecordedInitialProperties) {
      (this.constructor as typeof VelcroRadioButton).elementProperties.forEach((options, prop) => {
        if (options.reflect) {
          const current = (this as unknown as Record<PropertyKey, unknown>)[prop];
          if (current != null) {
            this.initialReflectedProperties.set(prop as string, current);
          }
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
      if (changed.has(prop as keyof VelcroRadioButton) && self[prop] == null) {
        self[prop] = value;
      }
    });
  }

  protected override update(changed: PropertyValues<this>) {
    // Shoelace's `@watch('disabled', { waitUntilFirstUpdate: true })` handler runs before render.
    if (this.hasUpdated && changed.has('disabled') && changed.get('disabled') !== this.disabled) {
      this.handleDisabledChange();
    }
    super.update(changed);
  }

  private handleBlur() {
    this.hasFocus = false;
    this.emit('sl-blur');
  }

  private handleClick(e: MouseEvent) {
    if (this.disabled) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    this.checked = true;
  }

  private handleFocus() {
    this.hasFocus = true;
    this.emit('sl-focus');
  }

  /** Sets `aria-disabled` on the host when `disabled` changes after the first update, as Shoelace does. */
  public handleDisabledChange() {
    this.setAttribute('aria-disabled', this.disabled ? 'true' : 'false');
  }

  /** Sets focus on the radio button. */
  public override focus(options?: FocusOptions) {
    this.input.focus(options);
  }

  /** Removes focus from the radio button. */
  public override blur() {
    this.input.blur();
  }

  protected override render() {
    return html`
      <div part="base" role="presentation">
        <button
          part="${`button${this.checked ? ' button--checked' : ''}`}"
          role="radio"
          aria-checked="${this.checked}"
          class=${classMap({
            button: true,
            'button--default': true,
            'button--small': this.size === 'small',
            'button--medium': this.size === 'medium',
            'button--large': this.size === 'large',
            'button--checked': this.checked,
            'button--disabled': this.disabled,
            'button--focused': this.hasFocus,
            'button--outline': true,
            'button--pill': this.pill,
            'button--has-label': this.hasSlotController.test('[default]'),
            'button--has-prefix': this.hasSlotController.test('prefix'),
            'button--has-suffix': this.hasSlotController.test('suffix'),
          })}
          aria-disabled=${this.disabled}
          type="button"
          value=${ifDefined(this.value)}
          @blur=${this.handleBlur}
          @focus=${this.handleFocus}
          @click=${this.handleClick}
        >
          <slot name="prefix" part="prefix" class="button__prefix"></slot>
          <slot part="label" class="button__label"></slot>
          <slot name="suffix" part="suffix" class="button__suffix"></slot>
        </button>
      </div>
    `;
  }
}

export default VelcroRadioButton;
