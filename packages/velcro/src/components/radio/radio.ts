// Adapted from Shoelace v2.20.1 (src/components/radio/radio.component.ts and the reflected-property restore in
// src/internal/shoelace-element.ts), Copyright (c) 2020 A Beautiful Site, LLC, MIT License. See THIRD_PARTY_NOTICES.md.
// The API documentation wording, the rendered structure (a `base` <span> with `radio` / `radio--*` class names around the
// `control` circle, the `checked-icon` <sl-icon> and the `label` slot), the host's role, tabindex and ARIA handling, the
// click and focus behaviour and the restore of reflected properties' initial values follow Shoelace. Velcro changes:
// built on the @charm-ux/core radio through Velcro's local scope resolver (core-only extras are kept, see the class
// comment). Shoelace's behaviour is matched exactly, including its quirks; each one is marked "Upstream quirk" below
// and listed on the docs page.
import { html, nothing, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { CharmElement } from '@charm-ux/core/dist/base/charm-element/charm-element.js';
import { CoreRadio } from '@charm-ux/core/dist/components/radio/radio.js';
import { useVelcroScope } from '../../internal/scope.js';
import styles from './radio.styles.js';

/** Upstream `@watch` handlers receive the previous and the current value. */
type WatchHandler = (oldValue: unknown, newValue: unknown) => void;

/**
 * Radios allow the user to select a single option from a group.
 *
 * Velcro extensions inherited from the core radio and kept working, none of which changes anything unless it is set:
 * `readonly` (a click does not check the radio), `label` (label text shown when the default slot is empty), `hide-label`
 * (visually hides the label, which stays accessible), `vertical` (stacks the label under the control) and the core
 * `selected` event, emitted whenever the radio becomes checked. Core's Space-key handling, its unchecking of a radio
 * that becomes disabled, its reactive `autofocus` property (the platform's own is used, as in Shoelace), its `blur` /
 * `focus` events and its `radio-*` parts and `--radio-*` custom properties conflict with Shoelace's radio or do not
 * apply to its structure, so they are not used.
 *
 * @tag sl-radio
 * @status prototype
 *
 * @slot - The radio's label.
 *
 * @event sl-blur - Emitted when the control loses focus.
 * @event sl-focus - Emitted when the control gains focus.
 *
 * @inheritedEventDropped blur - Never emitted by the radio: Shoelace's `sl-blur` is emitted instead (the host still
 * receives the platform's own `blur` event).
 * @inheritedEventDropped focus - Never emitted by the radio: Shoelace's `sl-focus` is emitted instead (the host still
 * receives the platform's own `focus` event).
 *
 * @csspart base - The component's base wrapper.
 * @csspart control - The circular container that wraps the radio's checked state.
 * @csspart control--checked - The radio control when the radio is checked.
 * @csspart checked-icon - The checked icon, an `<sl-icon>` element.
 * @csspart label - The container that wraps the radio's label.
 */
export class VelcroRadio extends CoreRadio {
  // Only Shoelace's styles (with its shared component styles): core's base and radio styles add rules Shoelace does not
  // have, such as hiding the host for the `hidden` attribute and styling core's `radio-*` structure.
  public static override styles = [styles];

  // Core's radio declares no dependencies; the <sl-icon> this template renders is registered by the radio's entry.
  public static override get dependencies() {
    return [];
  }

  private hasRecordedInitialProperties = false;

  private readonly initialReflectedProperties = new Map<string, unknown>();

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

  // Upstream quirk: `checked` is internal state, not an attribute. A `checked` attribute is ignored and the property is
  // never reflected (core's reflected `checked` attribute is switched off); a radio group, or script, sets it.
  // `attribute: false` is what Shoelace's `@state()` does at runtime; it also tells the manifest analyzer that core's
  // `checked` attribute is gone, which `@state()` does not.
  /** Whether the radio is checked. A property only, not an attribute: a radio group, or script, sets it. */
  @property({ attribute: false })
  public override checked = false;

  @state()
  protected override hasFocus = false;

  /** The radio's value. When selected, the radio group will receive this value. */
  @property()
  public override value!: string;

  /**
   * The radio's size. When used inside a radio group, the size will be determined by the radio group's size so this
   * attribute can typically be omitted.
   */
  @property({ reflect: true })
  public size: 'small' | 'medium' | 'large' = 'medium';

  /** Disables the radio. */
  @property({ type: Boolean, reflect: true })
  public override disabled = false;

  /** Velcro extension (core): a click does not check the radio. */
  @property({ type: Boolean, reflect: true })
  public override readonly = false;

  /** Velcro extension (core): label text rendered as the default slot's fallback content when the slot is empty. */
  @property({ reflect: true })
  public override label?: string;

  /** Velcro extension (core): visually hides the label, which stays accessible. */
  @property({ type: Boolean, attribute: 'hide-label', reflect: true })
  public override hideLabel = false;

  /** Velcro extension (core): stacks the label under the control. */
  @property({ type: Boolean, reflect: true })
  public override vertical = false;

  // `autofocus` is the platform's own property, as in Shoelace (see the accessor installed after the class): core's
  // reactive, asynchronously reflected `autofocus` and its observed attribute are not used.
  public static override get observedAttributes() {
    return super.observedAttributes.filter(name => name !== 'autofocus');
  }

  public constructor() {
    super();
    constructed.add(this);
    // Shoelace binds its listeners on the host in the constructor. Core's keydown (Space) and click listeners, added by
    // its connectedCallback, are not used: Shoelace's radio does not handle keys itself (its radio group does).
    this.addEventListener('blur', this.handleBlur);
    this.addEventListener('click', this.handleClick);
    this.addEventListener('focus', this.handleFocus);
  }

  protected override handleBlur = () => {
    this.hasFocus = false;
    this.emit('sl-blur');
  };

  // The `readonly` check is the Velcro extension; without it this is Shoelace's handler.
  protected override handleClick = () => {
    if (!this.disabled && !this.readonly) {
      this.checked = true;
    }
  };

  protected override handleFocus = () => {
    this.hasFocus = true;
    this.emit('sl-focus');
  };

  // Not `super.connectedCallback()`: core's radio would add its own keydown and click listeners on every connect and set
  // `tabindex="0"` and `aria-checked`. The core base element's own callback still runs.
  public override connectedCallback() {
    CharmElement.prototype.connectedCallback.call(this);
    this.setInitialAttributes();
  }

  // Upstream quirk: every connect sets `tabindex="-1"`, also on a checked radio, until `checked` next changes.
  protected override setInitialAttributes() {
    this.setAttribute('role', 'radio');
    this.setAttribute('tabindex', '-1');
    this.setAttribute('aria-disabled', this.disabled ? 'true' : 'false');
  }

  // Core's listener setup is not used (see connectedCallback).
  protected override addEventListeners() {}

  // Upstream behavior: the first time any observed attribute changes (including `dir` and `lang`), the values of all
  // reflected properties that are not null are recorded, and when one of them later becomes null (its attribute was
  // removed) it is set back to the recorded value.
  public override attributeChangedCallback(name: string, previous: string | null, next: string | null) {
    if (!this.hasRecordedInitialProperties) {
      (this.constructor as typeof VelcroRadio).elementProperties.forEach((options, prop) => {
        // Reflection is checked first, as upstream does, so that a non-reflected property's getter is not read here.
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

  // Core's own willUpdate (which unchecks a radio that becomes disabled and rewrites `tabindex` and `aria-*`) is not
  // called: it conflicts with Shoelace's radio.
  protected override willUpdate(changed: PropertyValues<this>) {
    this.initialReflectedProperties.forEach((value, prop) => {
      const self = this as unknown as Record<string, unknown>;
      if (changed.has(prop as keyof VelcroRadio) && self[prop] == null) {
        self[prop] = value;
      }
    });
  }

  // Shoelace's `@watch('checked')` (also on the first update) and `@watch('disabled', { waitUntilFirstUpdate: true })`,
  // run before the render. Each upstream `@watch` wraps `update` in turn, so the watcher declared last runs first:
  // `disabled`, then `checked`. Each handler is called with the previous and the current value, as upstream does.
  protected override update(changed: PropertyValues<this>) {
    if (changed.has('disabled') && changed.get('disabled') !== this.disabled && this.hasUpdated) {
      (this.handleDisabledChange as WatchHandler).call(this, changed.get('disabled'), this.disabled);
    }
    if (changed.has('checked') && changed.get('checked') !== this.checked) {
      (this.handleCheckedChange as WatchHandler).call(this, changed.get('checked'), this.checked);
      // Velcro extension (core): the `selected` event.
      if (this.checked) this.emit('selected');
    }
    super.update(changed);
  }

  public handleCheckedChange() {
    this.setAttribute('aria-checked', this.checked ? 'true' : 'false');
    this.setAttribute('tabindex', this.checked ? '0' : '-1');
  }

  // Upstream quirk: a disabled radio keeps its checked state and its tab stop.
  public override handleDisabledChange() {
    this.setAttribute('aria-disabled', this.disabled ? 'true' : 'false');
  }

  protected override render() {
    return html`
      <span
        part="base"
        class=${classMap({
          radio: true,
          'radio--checked': this.checked,
          'radio--disabled': this.disabled,
          'radio--focused': this.hasFocus,
          'radio--small': this.size === 'small',
          'radio--medium': this.size === 'medium',
          'radio--large': this.size === 'large',
        })}
      >
        <span part="${`control${this.checked ? ' control--checked' : ''}`}" class="radio__control">
          ${this.checked
            ? html` <sl-icon part="checked-icon" class="radio__checked-icon" library="system" name="radio"></sl-icon> `
            : ''}
        </span>

        <slot part="label" class=${this.hideLabel ? 'radio__label visually-hidden' : 'radio__label'}
          >${this.label ?? nothing}</slot
        >
      </span>
    `;
  }
}

// Upstream behavior: `autofocus` is HTMLElement's own property, which reflects the attribute synchronously. The
// accessor on this prototype hides core's reactive one. Core's constructor assigns `autofocus = false`, which would
// remove an `autofocus` attribute the element is upgraded with, so writes are ignored until the radio's own constructor
// has run.
const constructed = new WeakSet<object>();
const nativeAutofocus = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'autofocus');
if (nativeAutofocus?.get && nativeAutofocus.set) {
  const { get, set } = nativeAutofocus;
  Object.defineProperty(VelcroRadio.prototype, 'autofocus', {
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

// Defensive, as for sl-switch: core's radio has no dependencies and its (unused) template asks no scope for a tag, but
// without a scope of its own the radio could pick up core's scope if a page configured core with the `sl` prefix.
useVelcroScope(VelcroRadio);

export default VelcroRadio;
