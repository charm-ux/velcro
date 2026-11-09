// Adapted from Shoelace v2.20.1 (src/components/option/option.component.ts and the reflected-property restore in
// src/internal/shoelace-element.ts), Copyright (c) 2020 A Beautiful Site, LLC, MIT License. See THIRD_PARTY_NOTICES.md.
// The API documentation wording, the rendered structure (a `base` <div> with the `option` / `option--*` class names
// around the check icon and the prefix, label and suffix slots), the ARIA attributes the option sets on itself and
// `getTextLabel()` follow Shoelace. Velcro changes: built on the @charm-ux/core base element (there is no core option),
// Shoelace's `@watch` handlers are called from `update()` with the same timing, and the dependency on <sl-icon> is
// defined when an option is constructed rather than through Shoelace's `static dependencies` (see the class).
import { html, type PropertyValues } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { CharmElement } from '@charm-ux/core/dist/base/charm-element/charm-element.js';
import { defineVelcroComponent, type VelcroComponentConstructor } from '../../utilities/registration.js';
import { LocalizeController } from '../../utilities/localize.js';
import { VelcroIcon } from '../icon/class.js';
import styles from './option.styles.js';

/** The part of `<sl-select>` an option talks to when its label changes. */
interface OptionController extends HTMLElement {
  handleDefaultSlotChange(): void;
}

/**
 * Options define the selectable items within various form controls such as select. API modelled on Shoelace's
 * `sl-option`. There is no core counterpart, so it extends the core base element. The check mark is an `<sl-icon>`, as in
 * Shoelace; like Shoelace's, constructing an option defines its dependency `<sl-icon>` (Velcro's) when no element owns
 * that tag yet, so the class-only entry needs no extra step.
 *
 * Velcro extension inherited from the core base element and kept: the non-bubbling `ready` event, emitted on the first
 * update. Shoelace's option does not emit it.
 *
 * @tag sl-option
 * @status prototype
 *
 * @slot - The option's label.
 * @slot prefix - Used to prepend an icon or similar element to the menu item.
 * @slot suffix - Used to append an icon or similar element to the menu item.
 *
 * @csspart checked-icon - The checked icon, an `<sl-icon>` element.
 * @csspart base - The component's base wrapper.
 * @csspart label - The option's label.
 * @csspart prefix - The container that wraps the prefix.
 * @csspart suffix - The container that wraps the suffix.
 */
export class VelcroOption extends CharmElement {
  public static override baseName = 'option';

  // The core base styles are replaced by Shoelace's own (see the styles file). Core's add a `:host([hidden]) { display:
  // none !important }` rule, focus outlines and form-control resets that Shoelace's option does not have.
  public static override styles = [styles];

  // Shoelace's `static dependencies` for the option: the elements its template renders. Shoelace keys them by tag; here
  // the tag is derived from each class's `baseName` (`sl-icon` for `VelcroIcon`), the same tag `defineVelcroComponent`
  // defines and the template renders. As in Shoelace's base element, each one that is not defined yet is defined when an
  // option is constructed, and a tag that another constructor already owns is left alone (with Shoelace's warning when
  // the versions differ). If the platform refuses the class itself, an anonymous subclass is defined instead, as
  // Shoelace does. Core's own array-typed `dependencies` (registration in core's scope) stays empty. Not part of the
  // documented API (Shoelace's manifest lists `dependencies` without a description).
  private static readonly shoelaceDependencies: readonly VelcroComponentConstructor[] = [VelcroIcon];

  public constructor() {
    super();
    for (const component of VelcroOption.shoelaceDependencies) defineVelcroComponent(component);
  }

  // Shoelace's base element restores a reflected property's initial value when its attribute is removed (see
  // attributeChangedCallback). `value` and `disabled` are the reflected properties here.
  private readonly initialReflectedProperties = new Map<string, unknown>();
  private hasRecordedInitialProperties = false;

  // Unused by the template, as in Shoelace (whose option creates one too); it re-renders the option when its `lang` or
  // the document's changes.
  private readonly localize = new LocalizeController(this);

  private isInitialized = false;

  // Shoelace's base element declares `lang` and `dir` as reactive properties with no initial value and no reflection,
  // which also makes them observed attributes. Without the `lang` declaration, `lang` would be the native one, which
  // reflects: assigning it would change the attribute and reading it would give '' instead of undefined. Core declares
  // `dir` as a reactive property whose getter computes the direction (`ltr` or `rtl`) when it is unset or `auto`;
  // Shoelace's returns the value as set (undefined when unset), so the accessor is replaced.
  // Types: Shoelace declares `dir: string`. The setter accepts any string, as Shoelace's does. The getter must keep core's
  // declared type, because TypeScript does not let a subclass widen an inherited property's read type; at runtime it
  // returns whatever was set.
  /** The element's language, as set by the `lang` attribute or property. Not reflected. */
  @property()
  public override lang!: string;

  private shoelaceDir?: string;

  /**
   * The element's text direction, as set by the `dir` attribute or property and returned as set. Not reflected. Any
   * string can be assigned; the declared read type stays core's `'ltr' | 'rtl' | 'auto'`.
   */
  @property()
  public override get dir(): 'ltr' | 'rtl' | 'auto' {
    return this.shoelaceDir as 'ltr' | 'rtl' | 'auto';
  }

  public override set dir(value: string) {
    this.shoelaceDir = value;
  }

  /** @internal The label slot (Shoelace's public but undocumented `defaultSlot`). */
  @query('.option__label')
  public defaultSlot!: HTMLSlotElement;

  /**
   * @internal The user has keyed into the option, but hasn't selected it yet (shows a highlight). Set by the select.
   * Shoelace's public but undocumented member.
   */
  @state()
  public current = false;

  /** @internal The option is selected and has aria-selected="true". Set by the select (Shoelace's undocumented member). */
  @state()
  public selected = false;

  /** @internal Whether the pointer is over the option (Safari doesn't honor :hover styles while dragging). */
  @state()
  public hasHover = false;

  /**
   * The option's value. When selected, the containing form control will receive this value. The value must be unique
   * from other options in the same group. Values may not contain spaces, as spaces are used as delimiters when listing
   * multiple values.
   */
  @property({ reflect: true })
  public value = '';

  /** Draws the option in a disabled state, preventing selection. */
  @property({ type: Boolean, reflect: true })
  public disabled = false;

  public override connectedCallback() {
    super.connectedCallback();
    this.setAttribute('role', 'option');
    this.setAttribute('aria-selected', 'false');
  }

  // Records the reflected properties' values the first time any attribute changes (during upgrade, before the
  // attribute values are applied), so that removing a reflected attribute later restores that value instead of
  // leaving the property null. Same timing and rule as Shoelace's base element.
  public override attributeChangedCallback(name: string, previous: string | null, next: string | null) {
    if (!this.hasRecordedInitialProperties) {
      (this.constructor as typeof VelcroOption).elementProperties.forEach((options, prop) => {
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
      if (changed.has(prop as keyof VelcroOption) && self[prop] == null) {
        self[prop] = value;
      }
    });
  }

  // Shoelace's `@watch('disabled')`, `@watch('selected')` and `@watch('value')` handlers run before each update in which
  // the property changed, the first update included. Shoelace's decorators wrap `update()` in declaration order, so the
  // last-declared watcher (value) runs first.
  protected override update(changed: PropertyValues<this>) {
    if (changed.has('value') && changed.get('value') !== this.value) this.handleValueChange();
    if (changed.has('selected') && changed.get('selected') !== this.selected) this.handleSelectedChange();
    if (changed.has('disabled') && changed.get('disabled') !== this.disabled) this.handleDisabledChange();
    super.update(changed);
  }

  private handleDefaultSlotChange() {
    if (this.isInitialized) {
      // When the label changes, tell the controller to update
      customElements.whenDefined('sl-select').then(() => {
        const controller = this.closest('sl-select') as OptionController | null;
        if (controller) {
          controller.handleDefaultSlotChange();
        }
      });
    } else {
      this.isInitialized = true;
    }
  }

  private handleMouseEnter() {
    this.hasHover = true;
  }

  private handleMouseLeave() {
    this.hasHover = false;
  }

  /** @internal Shoelace's public `@watch` handler: mirrors `disabled` to `aria-disabled`. */
  public handleDisabledChange() {
    this.setAttribute('aria-disabled', this.disabled ? 'true' : 'false');
  }

  /** @internal Shoelace's public `@watch` handler: mirrors `selected` to `aria-selected`. */
  public handleSelectedChange() {
    this.setAttribute('aria-selected', this.selected ? 'true' : 'false');
  }

  /** @internal Shoelace's public `@watch` handler: converts the value to a string and replaces spaces. */
  public handleValueChange() {
    // Ensure the value is a string. This ensures the next line doesn't error and allows framework users to pass numbers
    // instead of requiring them to cast the value to a string.
    if (typeof this.value !== 'string') {
      this.value = String(this.value);
    }

    if (this.value.includes(' ')) {
      console.error(`Option values cannot include a space. All spaces have been replaced with underscores.`, this);
      this.value = this.value.replace(/ /g, '_');
    }
  }

  /** Returns a plain text label based on the option's content. */
  public getTextLabel() {
    const nodes = this.childNodes;
    let label = '';

    [...nodes].forEach(node => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        if (!(node as HTMLElement).hasAttribute('slot')) {
          label += (node as HTMLElement).textContent;
        }
      }

      if (node.nodeType === Node.TEXT_NODE) {
        label += node.textContent;
      }
    });

    return label.trim();
  }

  protected override render() {
    return html`
      <div
        part="base"
        class=${classMap({
          option: true,
          'option--current': this.current,
          'option--disabled': this.disabled,
          'option--selected': this.selected,
          'option--hover': this.hasHover,
        })}
        @mouseenter=${this.handleMouseEnter}
        @mouseleave=${this.handleMouseLeave}
      >
        <sl-icon part="checked-icon" class="option__check" name="check" library="system" aria-hidden="true"></sl-icon>
        <slot part="prefix" name="prefix" class="option__prefix"></slot>
        <slot part="label" class="option__label" @slotchange=${this.handleDefaultSlotChange}></slot>
        <slot part="suffix" name="suffix" class="option__suffix"></slot>
      </div>
    `;
  }
}

export default VelcroOption;
