// Adapted from Shoelace v2.20.1 (src/components/color-picker/color-picker.component.ts, the `@watch` timing of
// src/internal/watch.ts, the `defaultValue` decorator in src/internal/default-value.ts and the dependency definition,
// reflected-property restore and the `dir` and `lang` declarations in src/internal/shoelace-element.ts), Copyright (c)
// 2020 A Beautiful Site, LLC, MIT License. See THIRD_PARTY_NOTICES.md. The API documentation wording, the rendered
// structure (an `<sl-dropdown>` whose trigger is a round color button and whose panel is the picker, or the picker alone
// when inline: the saturation/brightness grid, the hue and opacity sliders, the copy preview, the `<sl-input>` with the
// format and eye dropper buttons, and the swatches), the pointer, touch and keyboard handling, the color parsing and
// formatting, the events and the validation and form participation API follow Shoelace. Velcro changes: built on the
// @charm-ux/core base element (core has no color picker), the color model comes from Velcro's color adapter
// (`internal/color.ts`) instead of importing `@ctrl/tinycolor` directly, Shoelace's `@watch` handlers run from
// `update()` with the same timing and its dependencies are defined through Velcro's registration helper. Shoelace's
// behavior is matched exactly, including its quirks; each one is marked "Upstream quirk" below and listed on the docs page.
import { html, type PropertyValues } from 'lit';
import { eventOptions, property, query, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { styleMap } from 'lit/directives/style-map.js';
import { CharmElement } from '@charm-ux/core/dist/base/charm-element/charm-element.js';
import { TinyColor } from '../../internal/color.js';
import { drag } from '../../internal/drag.js';
import { FormControlController } from '../../internal/form.js';
import { clamp } from '../../internal/math.js';
import { LocalizeController } from '../../utilities/localize.js';
import { defineVelcroComponent, type VelcroComponentConstructor } from '../../utilities/registration.js';
import { VelcroButtonGroup } from '../button-group/class.js';
import { VelcroButton } from '../button/class.js';
import { VelcroDropdown } from '../dropdown/class.js';
import { VelcroIcon } from '../icon/class.js';
import { VelcroInput } from '../input/class.js';
import { VelcroVisuallyHidden } from '../visually-hidden/class.js';
import styles from './color-picker.styles.js';

// As in Shoelace, the EyeDropper API is detected once, when the module loads. The `typeof window` guard only keeps the
// module importable where there is no window; in a browser the result is Shoelace's.
const hasEyeDropper = typeof window !== 'undefined' && 'EyeDropper' in window;

interface EyeDropperConstructor {
  new (): EyeDropperInterface;
}

interface EyeDropperInterface {
  open: () => Promise<{ sRGBHex: string }>;
}

declare const EyeDropper: EyeDropperConstructor;

type ColorFormat = 'hex' | 'rgb' | 'hsl' | 'hsv';

// Built on the @charm-ux/core base element: @charm-ux/core has no color picker to extend. The only core extension that
// remains is the non-bubbling `ready` event on first update.
/**
 * Color pickers allow the user to select a color. API modelled on Shoelace's `sl-color-picker`.
 *
 * Velcro extension inherited from the core base element and kept: the non-bubbling `ready` event, emitted on the first
 * update.
 *
 * @tag sl-color-picker
 * @status prototype
 *
 * @dependency sl-button
 * @dependency sl-button-group
 * @dependency sl-dropdown
 * @dependency sl-input
 * @dependency sl-visually-hidden
 *
 * @slot label - The color picker's form label. Alternatively, you can use the `label` attribute.
 *
 * @event sl-blur - Emitted when the color picker loses focus.
 * @event sl-change - Emitted when the color picker's value changes.
 * @event sl-focus - Emitted when the color picker receives focus.
 * @event sl-input - Emitted when the color picker receives input.
 * @event sl-invalid - Emitted when the form control has been checked for validity and its constraints aren't satisfied.
 *
 * @csspart base - The component's base wrapper.
 * @csspart trigger - The color picker's dropdown trigger.
 * @csspart swatches - The container that holds the swatches.
 * @csspart swatch - Each individual swatch.
 * @csspart grid - The color grid.
 * @csspart grid-handle - The color grid's handle.
 * @csspart slider - Hue and opacity sliders.
 * @csspart slider-handle - Hue and opacity slider handles.
 * @csspart hue-slider - The hue slider.
 * @csspart hue-slider-handle - The hue slider's handle.
 * @csspart opacity-slider - The opacity slider.
 * @csspart opacity-slider-handle - The opacity slider's handle.
 * @csspart preview - The preview color.
 * @csspart input - The text input.
 * @csspart eye-dropper-button - The eye dropper button.
 * @csspart eye-dropper-button__base - The eye dropper button's exported `button` part.
 * @csspart eye-dropper-button__prefix - The eye dropper button's exported `prefix` part.
 * @csspart eye-dropper-button__label - The eye dropper button's exported `label` part.
 * @csspart eye-dropper-button__suffix - The eye dropper button's exported `suffix` part.
 * @csspart eye-dropper-button__caret - The eye dropper button's exported `caret` part.
 * @csspart format-button - The format button.
 * @csspart format-button__base - The format button's exported `button` part.
 * @csspart format-button__prefix - The format button's exported `prefix` part.
 * @csspart format-button__label - The format button's exported `label` part.
 * @csspart format-button__suffix - The format button's exported `suffix` part.
 * @csspart format-button__caret - The format button's exported `caret` part.
 *
 * @cssproperty --grid-width - The width of the color grid.
 * @cssproperty --grid-height - The height of the color grid.
 * @cssproperty --grid-handle-size - The size of the color grid's handle.
 * @cssproperty --slider-height - The height of the hue and alpha sliders.
 * @cssproperty --slider-handle-size - The diameter of the slider's handle.
 * @cssproperty --swatch-size - The size of each predefined color swatch.
 */
export class VelcroColorPicker extends CharmElement {
  public static override baseName = 'color-picker';

  // Core's base styles are replaced by Shoelace's own (see the styles file).
  public static override styles = [styles];

  // Shoelace's `static dependencies` for the color picker: the elements its template renders. Shoelace keys them by tag;
  // here the tag is derived from each class's `baseName`, the same tag `defineVelcroComponent` defines and the template
  // renders. As in Shoelace's base element, each one that is not defined yet is defined when a color picker is
  // constructed, and a tag that another constructor already owns is left alone (with Shoelace's warning when the versions
  // differ). If the platform refuses the class itself, an anonymous subclass is defined instead, as Shoelace does. The
  // dropdown in turn defines `<sl-popup>` when it is constructed. Not part of the documented API (Shoelace's manifest
  // lists `dependencies` without a description).
  private static readonly shoelaceDependencies: readonly VelcroComponentConstructor[] = [
    VelcroButtonGroup,
    VelcroButton,
    VelcroDropdown,
    VelcroIcon,
    VelcroInput,
    VelcroVisuallyHidden,
  ];

  public constructor() {
    super();
    for (const component of VelcroColorPicker.shoelaceDependencies) defineVelcroComponent(component);
    this.addEventListener('focusin', this.handleFocusIn);
    this.addEventListener('focusout', this.handleFocusOut);
  }

  private readonly formControlController = new FormControlController(this);
  private isSafeValue = false;
  private readonly localize = new LocalizeController(this);

  private velcroDir?: string;

  // Shoelace's base element restores a reflected property's initial value when it becomes null or undefined (see
  // attributeChangedCallback). `inline`, `size`, `disabled`, `form` and `required` are the reflected properties here.
  private readonly initialReflectedProperties = new Map<string, unknown>();

  private hasRecordedInitialProperties = false;

  @query('[part~="base"]')
  public base!: HTMLElement;

  @query('[part~="input"]')
  public input!: VelcroInput;

  @query('.color-dropdown')
  public dropdown!: VelcroDropdown;

  @query('[part~="preview"]')
  public previewButton!: HTMLButtonElement;

  @query('[part~="trigger"]')
  public trigger!: HTMLButtonElement;

  @state() private hasFocus = false;
  @state() private isDraggingGridHandle = false;
  @state() private isEmpty = false;
  @state() private inputValue = '';
  @state() private hue = 0;
  @state() private saturation = 100;
  @state() private brightness = 100;
  @state() private alpha = 100;

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
   * The current value of the color picker. The value's format will vary based the `format` attribute. To get the value
   * in a specific format, use the `getFormattedValue()` method. The value is submitted as a name/value pair with form
   * data.
   */
  @property()
  public value = '';

  /** The default value of the form control. Primarily used for resetting the form control. */
  public defaultValue = '';

  /**
   * The color picker's label. This will not be displayed, but it will be announced by assistive devices. If you need to
   * display HTML, you can use the `label` slot` instead.
   */
  @property()
  public label = '';

  /**
   * The format to use. If opacity is enabled, these will translate to HEXA, RGBA, HSLA, and HSVA respectively. The color
   * picker will accept user input in any format (including CSS color names) and convert it to the desired format.
   */
  @property()
  public format: 'hex' | 'rgb' | 'hsl' | 'hsv' = 'hex';

  /** Renders the color picker inline rather than in a dropdown. */
  @property({ type: Boolean, reflect: true })
  public inline = false;

  /** Determines the size of the color picker's trigger. This has no effect on inline color pickers. */
  @property({ reflect: true })
  public size: 'small' | 'medium' | 'large' = 'medium';

  /** Removes the button that lets users toggle between format.   */
  @property({ attribute: 'no-format-toggle', type: Boolean })
  public noFormatToggle = false;

  /** The name of the form control, submitted as a name/value pair with form data. */
  @property()
  public name = '';

  /** Disables the color picker. */
  @property({ type: Boolean, reflect: true })
  public disabled = false;

  /**
   * Enable this option to prevent the panel from being clipped when the component is placed inside a container with
   * `overflow: auto|scroll`. Hoisting uses a fixed positioning strategy that works in many, but not all, scenarios.
   */
  @property({ type: Boolean })
  public hoist = false;

  /** Shows the opacity slider. Enabling this will cause the formatted value to be HEXA, RGBA, or HSLA. */
  @property({ type: Boolean })
  public opacity = false;

  /** By default, values are lowercase. With this attribute, values will be uppercase instead. */
  @property({ type: Boolean })
  public uppercase = false;

  /**
   * One or more predefined color swatches to display as presets in the color picker. Can include any format the color
   * picker can parse, including HEX(A), RGB(A), HSL(A), HSV(A), and CSS color names. Each color must be separated by a
   * semicolon (`;`). Alternatively, you can pass an array of color values to this property using JavaScript.
   */
  @property()
  public swatches: string | string[] = '';

  /**
   * By default, form controls are associated with the nearest containing `<form>` element. This attribute allows you
   * to place the form control outside of a form and associate it with the form that has this `id`. The form must be in
   * the same document or shadow root for this to work.
   */
  @property({ reflect: true })
  public form = '';

  /** Makes the color picker a required field. */
  @property({ type: Boolean, reflect: true })
  public required = false;

  // Upstream quirk: the form controller reads this after every update, so changing `inline` after the first render (which
  // renders a new inner input that has not rendered yet) makes that update throw a TypeError.
  /** Gets the validity state object */
  public get validity() {
    return this.input.validity;
  }

  /** Gets the validation message */
  public get validationMessage() {
    return this.input.validationMessage;
  }

  // Records the reflected properties' values the first time any attribute changes (during upgrade, before the
  // attribute values are applied), so that a reflected property set to null or undefined later gets that value back
  // instead. Same timing and rule as Shoelace's base element. A change of the `value` attribute also sets
  // `defaultValue`, as Shoelace's `defaultValue()` decorator does (it runs before the base element's callback).
  public override attributeChangedCallback(name: string, previous: string | null, next: string | null) {
    if (name === 'value' && this.value !== next) {
      this.defaultValue = next as string;
    }
    if (!this.hasRecordedInitialProperties) {
      (this.constructor as typeof VelcroColorPicker).elementProperties.forEach((options, prop) => {
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
      if (changed.has(prop as keyof VelcroColorPicker) && self[prop] == null) {
        self[prop] = value;
      }
    });
  }

  // Shoelace's three `@watch` handlers. Its `watch` decorator runs a handler in `update()`, before the render, whenever
  // the watched property changed to a different value (the `format` and `opacity` handlers only after the first
  // update). The decorators are applied in declaration order, each wrapping the previous `update`, so the handler
  // declared last (`value`) runs first, then `opacity`, then `format`; the same order is kept here.
  protected override update(changed: PropertyValues<this>) {
    const differs = (key: 'value' | 'opacity' | 'format') =>
      changed.has(key as keyof VelcroColorPicker) && changed.get(key as keyof VelcroColorPicker) !== this[key];
    if (differs('value')) {
      this.handleValueChange(changed.get('value' as keyof VelcroColorPicker) as string | undefined, this.value);
    }
    if (differs('opacity') && this.hasUpdated) this.handleOpacityChange();
    if (differs('format') && this.hasUpdated) this.handleFormatChange();
    super.update(changed);
  }

  protected override firstUpdated() {
    // Core's base element emits its `ready` event here (a Velcro extension).
    super.firstUpdated();
    this.input.updateComplete.then(() => {
      this.formControlController.updateValidity();
    });
  }

  private handleCopy() {
    this.input.select();
    document.execCommand('copy');
    this.previewButton.focus();

    // Show copied animation
    this.previewButton.classList.add('color-picker__preview-color--copied');
    this.previewButton.addEventListener('animationend', () => {
      this.previewButton.classList.remove('color-picker__preview-color--copied');
    });
  }

  private handleFocusIn = () => {
    this.hasFocus = true;
    this.emit('sl-focus');
  };

  private handleFocusOut = () => {
    this.hasFocus = false;
    this.emit('sl-blur');
  };

  // Upstream quirk: the new format is computed from the rounded value string, so a full cycle of formats can drift.
  private handleFormatToggle() {
    const formats = ['hex', 'rgb', 'hsl', 'hsv'];
    const nextIndex = (formats.indexOf(this.format) + 1) % formats.length;
    this.format = formats[nextIndex] as ColorFormat;
    this.setColor(this.value);
    this.emit('sl-change');
    this.emit('sl-input');
  }

  private handleAlphaDrag(event: PointerEvent) {
    const container = this.shadowRoot!.querySelector<HTMLElement>('.color-picker__slider.color-picker__alpha')!;
    const handle = container.querySelector<HTMLElement>('.color-picker__slider-handle')!;
    const { width } = container.getBoundingClientRect();
    let initialValue = this.value;
    let currentValue = this.value;

    handle.focus();
    event.preventDefault();

    drag(container, {
      onMove: x => {
        this.alpha = clamp((x / width) * 100, 0, 100);
        this.syncValues();

        if (this.value !== currentValue) {
          currentValue = this.value;
          this.emit('sl-input');
        }
      },
      onStop: () => {
        if (this.value !== initialValue) {
          initialValue = this.value;
          this.emit('sl-change');
        }
      },
      initialEvent: event,
    });
  }

  private handleHueDrag(event: PointerEvent) {
    const container = this.shadowRoot!.querySelector<HTMLElement>('.color-picker__slider.color-picker__hue')!;
    const handle = container.querySelector<HTMLElement>('.color-picker__slider-handle')!;
    const { width } = container.getBoundingClientRect();
    let initialValue = this.value;
    let currentValue = this.value;

    handle.focus();
    event.preventDefault();

    drag(container, {
      onMove: x => {
        this.hue = clamp((x / width) * 360, 0, 360);
        this.syncValues();

        if (this.value !== currentValue) {
          currentValue = this.value;
          this.emit('sl-input');
        }
      },
      onStop: () => {
        if (this.value !== initialValue) {
          initialValue = this.value;
          this.emit('sl-change');
        }
      },
      initialEvent: event,
    });
  }

  private handleGridDrag(event: PointerEvent) {
    const grid = this.shadowRoot!.querySelector<HTMLElement>('.color-picker__grid')!;
    const handle = grid.querySelector<HTMLElement>('.color-picker__grid-handle')!;
    const { width, height } = grid.getBoundingClientRect();
    let initialValue = this.value;
    let currentValue = this.value;

    handle.focus();
    event.preventDefault();

    this.isDraggingGridHandle = true;

    drag(grid, {
      onMove: (x, y) => {
        this.saturation = clamp((x / width) * 100, 0, 100);
        this.brightness = clamp(100 - (y / height) * 100, 0, 100);
        this.syncValues();

        if (this.value !== currentValue) {
          currentValue = this.value;
          this.emit('sl-input');
        }
      },
      onStop: () => {
        this.isDraggingGridHandle = false;
        if (this.value !== initialValue) {
          initialValue = this.value;
          this.emit('sl-change');
        }
      },
      initialEvent: event,
    });
  }

  private handleAlphaKeyDown(event: KeyboardEvent) {
    const increment = event.shiftKey ? 10 : 1;
    const oldValue = this.value;

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.alpha = clamp(this.alpha - increment, 0, 100);
      this.syncValues();
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.alpha = clamp(this.alpha + increment, 0, 100);
      this.syncValues();
    }

    if (event.key === 'Home') {
      event.preventDefault();
      this.alpha = 0;
      this.syncValues();
    }

    if (event.key === 'End') {
      event.preventDefault();
      this.alpha = 100;
      this.syncValues();
    }

    if (this.value !== oldValue) {
      this.emit('sl-change');
      this.emit('sl-input');
    }
  }

  private handleHueKeyDown(event: KeyboardEvent) {
    const increment = event.shiftKey ? 10 : 1;
    const oldValue = this.value;

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.hue = clamp(this.hue - increment, 0, 360);
      this.syncValues();
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.hue = clamp(this.hue + increment, 0, 360);
      this.syncValues();
    }

    if (event.key === 'Home') {
      event.preventDefault();
      this.hue = 0;
      this.syncValues();
    }

    if (event.key === 'End') {
      event.preventDefault();
      this.hue = 360;
      this.syncValues();
    }

    if (this.value !== oldValue) {
      this.emit('sl-change');
      this.emit('sl-input');
    }
  }

  private handleGridKeyDown(event: KeyboardEvent) {
    const increment = event.shiftKey ? 10 : 1;
    const oldValue = this.value;

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.saturation = clamp(this.saturation - increment, 0, 100);
      this.syncValues();
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.saturation = clamp(this.saturation + increment, 0, 100);
      this.syncValues();
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.brightness = clamp(this.brightness + increment, 0, 100);
      this.syncValues();
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.brightness = clamp(this.brightness - increment, 0, 100);
      this.syncValues();
    }

    if (this.value !== oldValue) {
      this.emit('sl-change');
      this.emit('sl-input');
    }
  }

  private handleInputChange(event: CustomEvent) {
    const target = event.target as HTMLInputElement;
    const oldValue = this.value;

    // Prevent the <sl-input>'s sl-change event from bubbling up
    event.stopPropagation();

    if (this.input.value) {
      this.setColor(target.value);
      target.value = this.value;
    } else {
      this.value = '';
    }

    if (this.value !== oldValue) {
      this.emit('sl-change');
      this.emit('sl-input');
    }
  }

  private handleInputInput(event: CustomEvent) {
    this.formControlController.updateValidity();

    // Prevent the <sl-input>'s sl-input event from bubbling up
    event.stopPropagation();
  }

  private handleInputKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      const oldValue = this.value;

      if (this.input.value) {
        this.setColor(this.input.value as string);
        this.input.value = this.value;

        if (this.value !== oldValue) {
          this.emit('sl-change');
          this.emit('sl-input');
        }

        setTimeout(() => this.input.select());
      } else {
        this.hue = 0;
      }
    }
  }

  private handleInputInvalid(event: Event) {
    this.formControlController.setValidity(false);
    this.formControlController.emitInvalidEvent(event);
  }

  @eventOptions({ passive: false })
  private handleTouchMove(event: TouchEvent) {
    event.preventDefault();
  }

  private parseColor(colorString: string) {
    const color = new TinyColor(colorString);
    if (!color.isValid) {
      return null;
    }

    const hslColor = color.toHsl();
    // Adjust saturation and lightness from 0-1 to 0-100
    const hsl = {
      h: hslColor.h,
      s: hslColor.s * 100,
      l: hslColor.l * 100,
      a: hslColor.a,
    };

    const rgb = color.toRgb();

    const hex = color.toHexString();
    const hexa = color.toHex8String();

    const hsvColor = color.toHsv();
    // Adjust saturation and value from 0-1 to 0-100
    const hsv = {
      h: hsvColor.h,
      s: hsvColor.s * 100,
      v: hsvColor.v * 100,
      a: hsvColor.a,
    };

    return {
      hsl: {
        h: hsl.h,
        s: hsl.s,
        l: hsl.l,
        string: this.setLetterCase(`hsl(${Math.round(hsl.h)}, ${Math.round(hsl.s)}%, ${Math.round(hsl.l)}%)`),
      },
      hsla: {
        h: hsl.h,
        s: hsl.s,
        l: hsl.l,
        a: hsl.a,
        string: this.setLetterCase(
          `hsla(${Math.round(hsl.h)}, ${Math.round(hsl.s)}%, ${Math.round(hsl.l)}%, ${hsl.a.toFixed(2).toString()})`,
        ),
      },
      hsv: {
        h: hsv.h,
        s: hsv.s,
        v: hsv.v,
        string: this.setLetterCase(`hsv(${Math.round(hsv.h)}, ${Math.round(hsv.s)}%, ${Math.round(hsv.v)}%)`),
      },
      hsva: {
        h: hsv.h,
        s: hsv.s,
        v: hsv.v,
        a: hsv.a,
        string: this.setLetterCase(
          `hsva(${Math.round(hsv.h)}, ${Math.round(hsv.s)}%, ${Math.round(hsv.v)}%, ${hsv.a.toFixed(2).toString()})`,
        ),
      },
      rgb: {
        r: rgb.r,
        g: rgb.g,
        b: rgb.b,
        string: this.setLetterCase(`rgb(${Math.round(rgb.r)}, ${Math.round(rgb.g)}, ${Math.round(rgb.b)})`),
      },
      rgba: {
        r: rgb.r,
        g: rgb.g,
        b: rgb.b,
        a: rgb.a,
        string: this.setLetterCase(
          `rgba(${Math.round(rgb.r)}, ${Math.round(rgb.g)}, ${Math.round(rgb.b)}, ${rgb.a.toFixed(2).toString()})`,
        ),
      },
      hex: this.setLetterCase(hex),
      hexa: this.setLetterCase(hexa),
    };
  }

  private setColor(colorString: string) {
    const newColor = this.parseColor(colorString);

    if (newColor === null) {
      return false;
    }

    this.hue = newColor.hsva.h;
    this.saturation = newColor.hsva.s;
    this.brightness = newColor.hsva.v;
    this.alpha = this.opacity ? newColor.hsva.a * 100 : 100;

    this.syncValues();

    return true;
  }

  private setLetterCase(string: string) {
    if (typeof string !== 'string') {
      return '';
    }
    return this.uppercase ? string.toUpperCase() : string.toLowerCase();
  }

  private async syncValues() {
    const currentColor = this.parseColor(
      `hsva(${this.hue}, ${this.saturation}%, ${this.brightness}%, ${this.alpha / 100})`,
    );

    if (currentColor === null) {
      return;
    }

    // Update the value
    if (this.format === 'hsl') {
      this.inputValue = this.opacity ? currentColor.hsla.string : currentColor.hsl.string;
    } else if (this.format === 'rgb') {
      this.inputValue = this.opacity ? currentColor.rgba.string : currentColor.rgb.string;
    } else if (this.format === 'hsv') {
      this.inputValue = this.opacity ? currentColor.hsva.string : currentColor.hsv.string;
    } else {
      this.inputValue = this.opacity ? currentColor.hexa : currentColor.hex;
    }

    // Setting this.value will trigger the watcher which parses the new value. We want to bypass that behavior because
    // we've already parsed the color here and conversion/rounding can lead to values changing slightly. When this
    // happens, dragging the grid handle becomes jumpy. After the next update, the usual behavior is restored.
    this.isSafeValue = true;
    this.value = this.inputValue;
    await this.updateComplete;
    this.isSafeValue = false;
  }

  private handleAfterHide() {
    this.previewButton.classList.remove('color-picker__preview-color--copied');
  }

  private handleEyeDropper() {
    if (!hasEyeDropper) {
      return;
    }

    const eyeDropper = new EyeDropper();

    eyeDropper
      .open()
      .then(colorSelectionResult => {
        const oldValue = this.value;

        this.setColor(colorSelectionResult.sRGBHex);

        if (this.value !== oldValue) {
          this.emit('sl-change');
          this.emit('sl-input');
        }
      })
      .catch(() => {
        // The user canceled, do nothing
      });
  }

  private selectSwatch(color: string) {
    const oldValue = this.value;

    if (!this.disabled) {
      this.setColor(color);

      if (this.value !== oldValue) {
        this.emit('sl-change');
        this.emit('sl-input');
      }
    }
  }

  /** Generates a hex string from HSV values. Hue must be 0-360. All other arguments must be 0-100. */
  private getHexString(hue: number, saturation: number, brightness: number, alpha = 100) {
    const color = new TinyColor(`hsva(${hue}, ${saturation}%, ${brightness}%, ${alpha / 100})`);
    if (!color.isValid) {
      return '';
    }

    return color.toHex8String();
  }

  // Prevents nested components from leaking events
  private stopNestedEventPropagation(event: CustomEvent) {
    event.stopImmediatePropagation();
  }

  // Shoelace's public `@watch('format', { waitUntilFirstUpdate: true })` handler.
  public handleFormatChange() {
    this.syncValues();
  }

  // Shoelace's public `@watch('opacity', { waitUntilFirstUpdate: true })` handler.
  public handleOpacityChange() {
    this.alpha = 100;
  }

  // Shoelace's public `@watch('value')` handler. Upstream quirks: an unparsable value is kept while the input shows the
  // previous color, and the alpha of a parsed value is kept even without `opacity` (the value is rewritten without it).
  public handleValueChange(oldValue: string | undefined, newValue: string) {
    this.isEmpty = !newValue;

    if (!newValue) {
      this.hue = 0;
      this.saturation = 0;
      this.brightness = 100;
      this.alpha = 100;
    }

    if (!this.isSafeValue) {
      const newColor = this.parseColor(newValue);

      if (newColor !== null) {
        this.inputValue = this.value;
        this.hue = newColor.hsva.h;
        this.saturation = newColor.hsva.s;
        this.brightness = newColor.hsva.v;
        this.alpha = newColor.hsva.a * 100;
        this.syncValues();
      } else {
        this.inputValue = oldValue ?? '';
      }
    }
  }

  /** Sets focus on the color picker. */
  public override focus(options?: FocusOptions) {
    if (this.inline) {
      this.base.focus(options);
    } else {
      this.trigger.focus(options);
    }
  }

  /** Removes focus from the color picker. */
  public override blur() {
    const elementToBlur = this.inline ? this.base : this.trigger;

    if (this.hasFocus) {
      // We don't know which element in the color picker has focus, so we'll move it to the trigger or base (inline) and
      // blur that instead. This results in document.activeElement becoming the <body>. This doesn't cause another focus
      // event because we're using focusin and something inside the color picker already has focus.
      elementToBlur.focus({ preventScroll: true });
      elementToBlur.blur();
    }

    if (this.dropdown?.open) {
      this.dropdown.hide();
    }
  }

  /** Returns the current value as a string in the specified format. */
  public getFormattedValue(format: 'hex' | 'hexa' | 'rgb' | 'rgba' | 'hsl' | 'hsla' | 'hsv' | 'hsva' = 'hex') {
    const currentColor = this.parseColor(
      `hsva(${this.hue}, ${this.saturation}%, ${this.brightness}%, ${this.alpha / 100})`,
    );

    if (currentColor === null) {
      return '';
    }

    switch (format) {
      case 'hex':
        return currentColor.hex;
      case 'hexa':
        return currentColor.hexa;
      case 'rgb':
        return currentColor.rgb.string;
      case 'rgba':
        return currentColor.rgba.string;
      case 'hsl':
        return currentColor.hsl.string;
      case 'hsla':
        return currentColor.hsla.string;
      case 'hsv':
        return currentColor.hsv.string;
      case 'hsva':
        return currentColor.hsva.string;
      default:
        return '';
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
    if (!this.inline && !this.validity.valid) {
      // If the input is inline and invalid, show the dropdown so the browser can focus on it
      this.dropdown.show();
      this.addEventListener('sl-after-show', () => this.input.reportValidity(), { once: true });

      if (!this.disabled) {
        // By standards we have to emit a `sl-invalid` event here synchronously.
        this.formControlController.emitInvalidEvent();
      }

      return false;
    }

    return this.input.reportValidity();
  }

  /** Sets a custom validation message. Pass an empty string to restore validity. */
  public setCustomValidity(message: string) {
    this.input.setCustomValidity(message);
    this.formControlController.updateValidity();
  }

  protected override render() {
    const gridHandleX = this.saturation;
    const gridHandleY = 100 - this.brightness;
    const swatches = Array.isArray(this.swatches)
      ? this.swatches // allow arrays for legacy purposes
      : this.swatches.split(';').filter(color => color.trim() !== '');

    // Upstream quirk: the base's `aria-labelledby="label"` names an element that exists only inline, so in the dropdown
    // it names nothing.
    const colorPicker = html`
      <div
        part="base"
        class=${classMap({
          'color-picker': true,
          'color-picker--inline': this.inline,
          'color-picker--disabled': this.disabled,
          'color-picker--focused': this.hasFocus,
        })}
        aria-disabled=${this.disabled ? 'true' : 'false'}
        aria-labelledby="label"
        tabindex=${this.inline ? '0' : '-1'}
      >
        ${this.inline
          ? html`
              <sl-visually-hidden id="label">
                <slot name="label">${this.label}</slot>
              </sl-visually-hidden>
            `
          : null}

        <div
          part="grid"
          class="color-picker__grid"
          style=${styleMap({ backgroundColor: this.getHexString(this.hue, 100, 100) })}
          @pointerdown=${this.handleGridDrag}
          @touchmove=${this.handleTouchMove}
        >
          <span
            part="grid-handle"
            class=${classMap({
              'color-picker__grid-handle': true,
              'color-picker__grid-handle--dragging': this.isDraggingGridHandle,
            })}
            style=${styleMap({
              top: `${gridHandleY}%`,
              left: `${gridHandleX}%`,
              backgroundColor: this.getHexString(this.hue, this.saturation, this.brightness, this.alpha),
            })}
            role="application"
            aria-label="HSV"
            tabindex=${ifDefined(this.disabled ? undefined : '0')}
            @keydown=${this.handleGridKeyDown}
          ></span>
        </div>

        <div class="color-picker__controls">
          <div class="color-picker__sliders">
            <div
              part="slider hue-slider"
              class="color-picker__hue color-picker__slider"
              @pointerdown=${this.handleHueDrag}
              @touchmove=${this.handleTouchMove}
            >
              <span
                part="slider-handle hue-slider-handle"
                class="color-picker__slider-handle"
                style=${styleMap({
                  left: `${this.hue === 0 ? 0 : 100 / (360 / this.hue)}%`,
                })}
                role="slider"
                aria-label="hue"
                aria-orientation="horizontal"
                aria-valuemin="0"
                aria-valuemax="360"
                aria-valuenow=${`${Math.round(this.hue)}`}
                tabindex=${ifDefined(this.disabled ? undefined : '0')}
                @keydown=${this.handleHueKeyDown}
              ></span>
            </div>

            ${this.opacity
              ? html`
                  <div
                    part="slider opacity-slider"
                    class="color-picker__alpha color-picker__slider color-picker__transparent-bg"
                    @pointerdown="${this.handleAlphaDrag}"
                    @touchmove=${this.handleTouchMove}
                  >
                    <div
                      class="color-picker__alpha-gradient"
                      style=${styleMap({
                        backgroundImage: `linear-gradient(
                          to right,
                          ${this.getHexString(this.hue, this.saturation, this.brightness, 0)} 0%,
                          ${this.getHexString(this.hue, this.saturation, this.brightness, 100)} 100%
                        )`,
                      })}
                    ></div>
                    <span
                      part="slider-handle opacity-slider-handle"
                      class="color-picker__slider-handle"
                      style=${styleMap({
                        left: `${this.alpha}%`,
                      })}
                      role="slider"
                      aria-label="alpha"
                      aria-orientation="horizontal"
                      aria-valuemin="0"
                      aria-valuemax="100"
                      aria-valuenow=${Math.round(this.alpha)}
                      tabindex=${ifDefined(this.disabled ? undefined : '0')}
                      @keydown=${this.handleAlphaKeyDown}
                    ></span>
                  </div>
                `
              : ''}
          </div>

          <button
            type="button"
            part="preview"
            class="color-picker__preview color-picker__transparent-bg"
            aria-label=${this.localize.term('copy')}
            style=${styleMap({
              '--preview-color': this.getHexString(this.hue, this.saturation, this.brightness, this.alpha),
            })}
            @click=${this.handleCopy}
          ></button>
        </div>

        <div class="color-picker__user-input" aria-live="polite">
          <sl-input
            part="input"
            type="text"
            name=${this.name}
            autocomplete="off"
            autocorrect="off"
            autocapitalize="off"
            spellcheck="false"
            value=${this.isEmpty ? '' : this.inputValue}
            ?required=${this.required}
            ?disabled=${this.disabled}
            aria-label=${this.localize.term('currentValue')}
            @keydown=${this.handleInputKeyDown}
            @sl-change=${this.handleInputChange}
            @sl-input=${this.handleInputInput}
            @sl-invalid=${this.handleInputInvalid}
            @sl-blur=${this.stopNestedEventPropagation}
            @sl-focus=${this.stopNestedEventPropagation}
          ></sl-input>

          <sl-button-group>
            ${!this.noFormatToggle
              ? html`
                  <sl-button
                    part="format-button"
                    aria-label=${this.localize.term('toggleColorFormat')}
                    exportparts="
                      base:format-button__base,
                      prefix:format-button__prefix,
                      label:format-button__label,
                      suffix:format-button__suffix,
                      caret:format-button__caret
                    "
                    @click=${this.handleFormatToggle}
                    @sl-blur=${this.stopNestedEventPropagation}
                    @sl-focus=${this.stopNestedEventPropagation}
                  >
                    ${this.setLetterCase(this.format)}
                  </sl-button>
                `
              : ''}
            ${hasEyeDropper
              ? html`
                  <sl-button
                    part="eye-dropper-button"
                    exportparts="
                      base:eye-dropper-button__base,
                      prefix:eye-dropper-button__prefix,
                      label:eye-dropper-button__label,
                      suffix:eye-dropper-button__suffix,
                      caret:eye-dropper-button__caret
                    "
                    @click=${this.handleEyeDropper}
                    @sl-blur=${this.stopNestedEventPropagation}
                    @sl-focus=${this.stopNestedEventPropagation}
                  >
                    <sl-icon
                      library="system"
                      name="eyedropper"
                      label=${this.localize.term('selectAColorFromTheScreen')}
                    ></sl-icon>
                  </sl-button>
                `
              : ''}
          </sl-button-group>
        </div>

        ${swatches.length > 0
          ? html`
              <div part="swatches" class="color-picker__swatches">
                ${swatches.map(swatch => {
                  const parsedColor = this.parseColor(swatch);

                  // If we can't parse it, skip it
                  if (!parsedColor) {
                    console.error(`Unable to parse swatch color: "${swatch}"`, this);
                    return '';
                  }

                  // Upstream quirk: Enter applies the swatch without emitting sl-change or sl-input (a click emits both).
                  return html`
                    <div
                      part="swatch"
                      class="color-picker__swatch color-picker__transparent-bg"
                      tabindex=${ifDefined(this.disabled ? undefined : '0')}
                      role="button"
                      aria-label=${swatch}
                      @click=${() => this.selectSwatch(swatch)}
                      @keydown=${(event: KeyboardEvent) =>
                        !this.disabled && event.key === 'Enter' && this.setColor(parsedColor.hexa)}
                    >
                      <div
                        class="color-picker__swatch-color"
                        style=${styleMap({ backgroundColor: parsedColor.hexa })}
                      ></div>
                    </div>
                  `;
                })}
              </div>
            `
          : ''}
      </div>
    `;

    // Render inline
    if (this.inline) {
      return colorPicker;
    }

    // Render as a dropdown
    return html`
      <sl-dropdown
        class="color-dropdown"
        aria-disabled=${this.disabled ? 'true' : 'false'}
        .containingElement=${this}
        ?disabled=${this.disabled}
        ?hoist=${this.hoist}
        @sl-after-hide=${this.handleAfterHide}
      >
        <button
          part="trigger"
          slot="trigger"
          class=${classMap({
            'color-dropdown__trigger': true,
            'color-dropdown__trigger--disabled': this.disabled,
            'color-dropdown__trigger--small': this.size === 'small',
            'color-dropdown__trigger--medium': this.size === 'medium',
            'color-dropdown__trigger--large': this.size === 'large',
            'color-dropdown__trigger--empty': this.isEmpty,
            'color-dropdown__trigger--focused': this.hasFocus,
            'color-picker__transparent-bg': true,
          })}
          style=${styleMap({
            color: this.getHexString(this.hue, this.saturation, this.brightness, this.alpha),
          })}
          type="button"
        >
          <sl-visually-hidden>
            <slot name="label">${this.label}</slot>
          </sl-visually-hidden>
        </button>
        ${colorPicker}
      </sl-dropdown>
    `;
  }
}

export default VelcroColorPicker;
