// Adapted from Shoelace v2.20.1 (src/components/menu/menu.component.ts and src/events/sl-select.ts), Copyright (c) 2020
// A Beautiful Site, LLC, MIT License. See THIRD_PARTY_NOTICES.md. The API documentation wording, the rendered structure
// (one slot that carries the click, keydown, mousedown and slotchange handlers), the `role="menu"` host, the click
// routing (a click is handled only by the closest menu, a checkbox item is toggled, `sl-select` is emitted), the
// keyboard handling (Enter and Space click the current item, ArrowDown, ArrowUp, Home and End move it), the roving
// tabindex and the public item helpers follow Shoelace. Velcro changes: built on the @charm-ux/core base element (core's
// menu component is not used, see the class comment). Shoelace's behavior is matched exactly, including its quirks; each
// one is marked "Upstream quirk" below and listed on the docs page.
import { html } from 'lit';
import { property, query } from 'lit/decorators.js';
import { CharmElement } from '@charm-ux/core/dist/base/charm-element/charm-element.js';
import { ShoelaceCompat } from '../../internal/shoelace-compat.js';
import type { VelcroMenuItem } from '../menu-item/class.js';
import styles from './menu.styles.js';

// Built on the @charm-ux/core base element. Core's menu component is not extended: it is a dropdown (a trigger slot, a
// popup, `placement`, `fixed-placement`, `menu-show` and `menu-hide` events and a `menu-request-close` event) that
// manages its items through marker attributes, which is a different model from Shoelace's inline list that is always
// visible, carries `role="menu"` and emits `sl-select`. The only core extension that remains is the non-bubbling `ready`
// event on first update.
/**
 * Menus provide a list of options for the user to choose from. API modelled on Shoelace's `sl-menu`.
 *
 * @property {string} lang - The element's language, as set by the `lang` attribute or property. Not reflected.
 *
 * @tag sl-menu
 * @status prototype
 *
 * @slot - The menu's content, including menu items, menu labels, and dividers.
 *
 * @event {{ item: SlMenuItem }} sl-select - Emitted when a menu item is selected.
 */
export class VelcroMenu extends ShoelaceCompat(CharmElement, { lang: true, dir: true }) {
  public static override baseName = 'menu';

  // Core's base styles are replaced by Shoelace's own (see the styles file).
  public static override styles = [styles];

  // Shoelace's public `@query('slot')` field: the default slot.
  @query('slot')
  public defaultSlot!: HTMLSlotElement;

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

  // Upstream quirk: `role` is always set to `menu` on connect, replacing any role the page gave the element.
  public override connectedCallback() {
    super.connectedCallback();
    this.setAttribute('role', 'menu');
  }

  private handleClick(event: MouseEvent) {
    const menuItemTypes = ['menuitem', 'menuitemcheckbox'];

    const composedPath = event.composedPath();
    const target = composedPath.find((el: EventTarget) => menuItemTypes.includes((el as Element)?.getAttribute?.('role') || ''));

    if (!target) return;

    const closestMenu = composedPath.find((el: EventTarget) => (el as Element)?.getAttribute?.('role') === 'menu');
    const clickHasSubmenu = closestMenu !== this;

    // Make sure we're the menu thats supposed to be handling the click event.
    if (clickHasSubmenu) return;

    // This isn't true. But we use it for TypeScript checks below.
    const item = target as VelcroMenuItem;

    if (item.type === 'checkbox') {
      item.checked = !item.checked;
    }

    this.emit('sl-select', { detail: { item } });
  }

  private handleKeyDown(event: KeyboardEvent) {
    // Make a selection when pressing enter or space
    if (event.key === 'Enter' || event.key === ' ') {
      const item = this.getCurrentItem();
      event.preventDefault();
      event.stopPropagation();

      // Simulate a click to support @click handlers on menu items that also work with the keyboard
      item?.click();
    }

    // Move the selection when pressing down or up
    else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      const items = this.getAllItems();
      const activeItem = this.getCurrentItem();
      let index = activeItem ? items.indexOf(activeItem) : 0;

      if (items.length > 0) {
        event.preventDefault();
        event.stopPropagation();

        if (event.key === 'ArrowDown') {
          index++;
        } else if (event.key === 'ArrowUp') {
          index--;
        } else if (event.key === 'Home') {
          index = 0;
        } else if (event.key === 'End') {
          index = items.length - 1;
        }

        if (index < 0) {
          index = items.length - 1;
        }
        if (index > items.length - 1) {
          index = 0;
        }

        this.setCurrentItem(items[index]);
        items[index].focus();
      }
    }
  }

  private handleMouseDown(event: MouseEvent) {
    const target = event.target as HTMLElement;

    if (this.isMenuItem(target)) {
      this.setCurrentItem(target as VelcroMenuItem);
    }
  }

  private handleSlotChange() {
    const items = this.getAllItems();

    // Reset the roving tab index when the slotted items change
    if (items.length > 0) {
      this.setCurrentItem(items[0]);
    }
  }

  private isMenuItem(item: HTMLElement) {
    return (
      item.tagName.toLowerCase() === 'sl-menu-item' ||
      ['menuitem', 'menuitemcheckbox', 'menuitemradio'].includes(item.getAttribute('role') ?? '')
    );
  }

  /** @internal Gets all slotted menu items, ignoring dividers, headers, and other elements. */
  public getAllItems() {
    return [...this.defaultSlot.assignedElements({ flatten: true })].filter((el: Element) => {
      if ((el as HTMLElement).inert || !this.isMenuItem(el as HTMLElement)) {
        return false;
      }
      return true;
    }) as VelcroMenuItem[];
  }

  /**
   * @internal Gets the current menu item, which is the menu item that has `tabindex="0"` within the roving tab index.
   * The menu item may or may not have focus, but for keyboard interaction purposes it's considered the "active" item.
   */
  public getCurrentItem() {
    return this.getAllItems().find(i => i.getAttribute('tabindex') === '0');
  }

  /**
   * @internal Sets the current menu item to the specified element. This sets `tabindex="0"` on the target element and
   * `tabindex="-1"` to all other items. This method must be called prior to setting focus on a menu item.
   */
  public setCurrentItem(item: VelcroMenuItem) {
    const items = this.getAllItems();

    // Update tab indexes
    items.forEach(i => {
      i.setAttribute('tabindex', i === item ? '0' : '-1');
    });
  }

  protected override render() {
    return html`
      <slot
        @slotchange=${this.handleSlotChange}
        @click=${this.handleClick}
        @keydown=${this.handleKeyDown}
        @mousedown=${this.handleMouseDown}
      ></slot>
    `;
  }
}

export default VelcroMenu;
