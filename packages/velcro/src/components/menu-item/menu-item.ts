// Adapted from Shoelace v2.20.1 (src/components/menu-item/menu-item.component.ts and the reflected-property restore and
// dependency definition in src/internal/shoelace-element.ts), Copyright (c) 2020 A Beautiful Site, LLC, MIT License. See
// THIRD_PARTY_NOTICES.md. The API documentation wording, the rendered structure (a `base` <div> with the `menu-item` /
// `menu-item--*` class names around the checked icon, the `prefix`, default and `suffix` slots, the submenu icon, the
// submenu popup and the loading spinner), the `role`, `aria-checked`, `aria-disabled`, `aria-haspopup` and `aria-expanded`
// handling, the host's click and mouseover handling, the `slotchange` event emitted when the label changes, `getTextLabel`,
// `isSubmenu` and the restore of reflected properties' initial values follow Shoelace. Velcro changes: built on the
// @charm-ux/core base element (core's menu item is not used, see the class comment), the `@watch` handlers run from
// `update()`, and the dependencies on <sl-icon>, <sl-popup> and <sl-spinner> are defined when a menu item is constructed
// through Velcro's registration helper rather than Shoelace's `static dependencies`. Shoelace's behavior is matched
// exactly, including its quirks; each one is marked "Upstream quirk" below and listed on the docs page.
import { html, type PropertyValues } from 'lit';
import { property, query } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { CharmElement } from '@charm-ux/core/dist/base/charm-element/charm-element.js';
import { ShoelaceCompat, restoreReflectedProperties } from '../../internal/shoelace-compat.js';
import { getTextContent, HasSlotController } from '../../internal/slot.js';
import { LocalizeController } from '../../utilities/localize.js';
import { defineVelcroComponent, type VelcroComponentConstructor } from '../../utilities/registration.js';
import { VelcroIcon } from '../icon/class.js';
import { VelcroPopup } from '../popup/class.js';
import { VelcroSpinner } from '../spinner/class.js';
import styles from './menu-item.styles.js';
import { SubmenuController } from './submenu-controller.js';

// Built on the @charm-ux/core base element. Core's menu item component is not extended: it renders its own link-or-span
// structure with a `role` property, `href`, `current`, `expanded` and `sub-menu-placement` attributes and its own submenu
// handling keyed on marker attributes, which conflicts with Shoelace's `type`, `checked`, `value` and `loading` model.
// The only core extension that remains is the non-bubbling `ready` event on first update.
/**
 * Menu items provide options for the user to pick from in a menu. API modelled on Shoelace's `sl-menu-item`. It renders
 * `<sl-icon>`, `<sl-popup>` (for a submenu) and `<sl-spinner>` (while loading), as in Shoelace; like Shoelace's,
 * constructing a menu item defines those dependencies (Velcro's) when no element owns their tags yet, so the class-only
 * entry needs no extra step.
 *
 * @property {string} lang - The element's language, as set by the `lang` attribute or property. Not reflected.
 *
 * @tag sl-menu-item
 * @status prototype
 *
 * @dependency sl-icon
 * @dependency sl-popup
 * @dependency sl-spinner
 *
 * @slot - The menu item's label.
 * @slot prefix - Used to prepend an icon or similar element to the menu item.
 * @slot suffix - Used to append an icon or similar element to the menu item.
 * @slot submenu - Used to denote a nested menu.
 *
 * @csspart base - The component's base wrapper.
 * @csspart checked-icon - The checked icon, which is only visible when the menu item is checked.
 * @csspart prefix - The prefix container.
 * @csspart label - The menu item label.
 * @csspart suffix - The suffix container.
 * @csspart spinner - The spinner that shows when the menu item is in the loading state.
 * @csspart spinner__base - The spinner's base part.
 * @csspart submenu-icon - The submenu icon, visible only when the menu item has a submenu (not yet implemented).
 *
 * @cssproperty [--submenu-offset=-2px] - The distance submenus shift to overlap the parent menu.
 */
export class VelcroMenuItem extends ShoelaceCompat(CharmElement, { lang: true, dir: true, reflected: true }) {
  public static override baseName = 'menu-item';

  // Core's base styles are replaced by Shoelace's own (see the styles file).
  public static override styles = [styles];

  // Shoelace's `static dependencies` for the menu item: the elements its template renders. Shoelace keys them by tag; here
  // the tag is derived from each class's `baseName`, the same tag `defineVelcroComponent` defines and the template renders.
  // As in Shoelace's base element, each one that is not defined yet is defined when a menu item is constructed, and a tag
  // that another constructor already owns is left alone (with Shoelace's warning when the versions differ). If the
  // platform refuses the class itself (for example because it is already registered under another tag), an anonymous
  // subclass is defined instead, as Shoelace does. Core's own array-typed `dependencies` (registration in core's scope)
  // stays empty.
  private static readonly shoelaceDependencies: readonly VelcroComponentConstructor[] = [
    VelcroIcon,
    VelcroPopup,
    VelcroSpinner,
  ];

  public constructor() {
    super();
    for (const component of VelcroMenuItem.shoelaceDependencies) defineVelcroComponent(component);
  }

  private cachedTextLabel!: string;

  private readonly localize = new LocalizeController(this);

  // Shoelace's public `@query('slot:not([name])')` field: the default slot.
  @query('slot:not([name])')
  public defaultSlot!: HTMLSlotElement;

  // Shoelace's public `@query('.menu-item')` field: the item's base wrapper.
  @query('.menu-item')
  public menuItem!: HTMLElement;

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

  /** The type of menu item to render. To use `checked`, this value must be set to `checkbox`. */
  @property()
  public type: 'normal' | 'checkbox' = 'normal';

  /** Draws the item in a checked state. */
  @property({ type: Boolean, reflect: true })
  public checked = false;

  /** A unique value to store in the menu item. This can be used as a way to identify menu items when selected. */
  @property()
  public value = '';

  /** Draws the menu item in a loading state. */
  @property({ type: Boolean, reflect: true })
  public loading = false;

  /** Draws the menu item in a disabled state, preventing selection. */
  @property({ type: Boolean, reflect: true })
  public disabled = false;

  private readonly hasSlotController = new HasSlotController(this, 'submenu');

  private submenuController: SubmenuController = new SubmenuController(this, this.hasSlotController);

  public override connectedCallback() {
    super.connectedCallback();
    this.addEventListener('click', this.handleHostClick);
    this.addEventListener('mouseover', this.handleMouseOver);
  }

  public override disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener('click', this.handleHostClick);
    this.removeEventListener('mouseover', this.handleMouseOver);
  }

  protected override willUpdate(changed: PropertyValues<this>) {
    restoreReflectedProperties(this, changed);
  }

  // Shoelace's `@watch('checked')`, `@watch('disabled')` and `@watch('type')`: they run before the render, including on the
  // first update. Shoelace applies the decorators in declaration order and each wraps `update`, so the last one (`type`)
  // runs first, then `disabled`, then `checked`.
  protected override update(changed: PropertyValues<this>) {
    if (changed.has('type') && changed.get('type') !== this.type) {
      this.handleTypeChange();
    }
    if (changed.has('disabled') && changed.get('disabled') !== this.disabled) {
      this.handleDisabledChange();
    }
    if (changed.has('checked') && changed.get('checked') !== this.checked) {
      this.handleCheckedChange();
    }

    super.update(changed);
  }

  private handleDefaultSlotChange() {
    const textLabel = this.getTextLabel();

    // Ignore the first time the label is set
    if (typeof this.cachedTextLabel === 'undefined') {
      this.cachedTextLabel = textLabel;
      return;
    }

    // When the label changes, emit a slotchange event so parent controls see it
    if (textLabel !== this.cachedTextLabel) {
      this.cachedTextLabel = textLabel;
      this.emit('slotchange', { bubbles: true, composed: false, cancelable: false });
    }
  }

  // Upstream quirk: only `disabled` suppresses the click (the comment upstream says "disabled or loading"), so a loading
  // item still emits click and `sl-select` events.
  private handleHostClick = (event: MouseEvent) => {
    // Prevent the click event from being emitted when the button is disabled or loading
    if (this.disabled) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  };

  private handleMouseOver = (event: MouseEvent) => {
    this.focus();
    event.stopPropagation();
  };

  // Upstream quirk: `checked` on a menu item whose type is not `checkbox` is set back to false and logged with
  // `console.error`. This runs when `checked` changes, not when `type` does, so changing the type of a checked item to
  // `normal` leaves `checked` set (see `update`).
  public handleCheckedChange() {
    // For proper accessibility, users have to use type="checkbox" to use the checked attribute
    if (this.checked && this.type !== 'checkbox') {
      this.checked = false;
      console.error('The checked attribute can only be used on menu items with type="checkbox"', this);
      return;
    }

    // Only checkbox types can receive the aria-checked attribute
    if (this.type === 'checkbox') {
      this.setAttribute('aria-checked', this.checked ? 'true' : 'false');
    } else {
      this.removeAttribute('aria-checked');
    }
  }

  public handleDisabledChange() {
    this.setAttribute('aria-disabled', this.disabled ? 'true' : 'false');
  }

  public handleTypeChange() {
    if (this.type === 'checkbox') {
      this.setAttribute('role', 'menuitemcheckbox');
      this.setAttribute('aria-checked', this.checked ? 'true' : 'false');
    } else {
      this.setAttribute('role', 'menuitem');
      this.removeAttribute('aria-checked');
    }
  }

  /** Returns a text label based on the contents of the menu item's default slot. */
  public getTextLabel() {
    return getTextContent(this.defaultSlot);
  }

  public isSubmenu() {
    return this.hasSlotController.test('submenu');
  }

  // The localization controller is kept because it re-renders the item when the document's direction changes. Shoelace's
  // controller resolves the direction from the host's `dir` property, else the document's (`<html dir>`, else ltr). Velcro's
  // shared controller reads the host's `dir` attribute instead (core's `dir` getter returns the computed direction), which
  // would miss a direction set only through the property; this component's `dir` returns what was set, by attribute or
  // property, so it resolves the direction the way Shoelace does.
  private direction() {
    void this.localize;
    return `${super.dir || document.documentElement.dir || 'ltr'}`.toLowerCase();
  }

  protected override render() {
    const isRtl = this.direction() === 'rtl';
    const isSubmenuExpanded = this.submenuController.isExpanded();

    return html`
      <div
        id="anchor"
        part="base"
        class=${classMap({
          'menu-item': true,
          'menu-item--rtl': isRtl,
          'menu-item--checked': this.checked,
          'menu-item--disabled': this.disabled,
          'menu-item--loading': this.loading,
          'menu-item--has-submenu': this.isSubmenu(),
          'menu-item--submenu-expanded': isSubmenuExpanded,
        })}
        ?aria-haspopup="${this.isSubmenu()}"
        ?aria-expanded="${isSubmenuExpanded ? true : false}"
      >
        <span part="checked-icon" class="menu-item__check">
          <sl-icon name="check" library="system" aria-hidden="true"></sl-icon>
        </span>

        <slot name="prefix" part="prefix" class="menu-item__prefix"></slot>

        <slot part="label" class="menu-item__label" @slotchange=${this.handleDefaultSlotChange}></slot>

        <slot name="suffix" part="suffix" class="menu-item__suffix"></slot>

        <span part="submenu-icon" class="menu-item__chevron">
          <sl-icon name=${isRtl ? 'chevron-left' : 'chevron-right'} library="system" aria-hidden="true"></sl-icon>
        </span>

        ${this.submenuController.renderSubmenu()}
        ${this.loading ? html` <sl-spinner part="spinner" exportparts="base:spinner__base"></sl-spinner> ` : ''}
      </div>
    `;
  }
}

export default VelcroMenuItem;
