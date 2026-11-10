// Adapted from Shoelace v2.20.1 (src/components/dropdown/dropdown.component.ts, the `watch` decorator in
// src/internal/watch.ts and the dependency definition and reflected-property restore in src/internal/shoelace-element.ts),
// Copyright (c) 2020 A Beautiful Site, LLC, MIT License. See THIRD_PARTY_NOTICES.md. The API documentation wording, the
// rendered structure (an `<sl-popup part="base">` around the `trigger` slot and an `aria-hidden` panel wrapper around the
// default slot), the open and close handling (the `sl-show`, `sl-after-show`, `sl-hide` and `sl-after-hide` events, the
// `dropdown.show` and `dropdown.hide` animations and their registry defaults), the trigger's keyboard handling, the
// document listeners that close the panel, the accessible-trigger bookkeeping, the focus handling and the public methods
// follow Shoelace. Velcro changes: built on the @charm-ux/core base element (core has no dropdown; its menu component is a
// different model), the `@watch` handler runs from `update()`, and the dependency on <sl-popup> is defined when a dropdown
// is constructed through Velcro's registration helper rather than Shoelace's `static dependencies`. Shoelace's behavior is
// matched exactly, including its quirks; each one is marked "Upstream quirk" below and listed on the docs page.
import { html, type PropertyValues } from 'lit';
import { property, query } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { CharmElement } from '@charm-ux/core/dist/base/charm-element/charm-element.js';
import { ShoelaceCompat, restoreReflectedProperties } from '../../internal/shoelace-compat.js';
import { getDeepestActiveElement } from '../../internal/active-elements.js';
import { animateTo, stopAnimations } from '../../internal/animate.js';
import { waitForEvent } from '../../internal/event.js';
import { documentDir } from '../../internal/localize.js';
import { getTabbableBoundary } from '../../internal/tabbable.js';
import { getAnimation, setDefaultAnimation } from '../../utilities/animation-registry.js';
import { LocalizeController } from '../../utilities/localize.js';
import { defineVelcroComponent, type VelcroComponentConstructor } from '../../utilities/registration.js';
import type { VelcroButton } from '../button/class.js';
import type { VelcroIconButton } from '../icon-button/class.js';
import type { VelcroMenu } from '../menu/class.js';
import type { VelcroMenuItem } from '../menu-item/class.js';
import { VelcroPopup } from '../popup/class.js';
import styles from './dropdown.styles.js';

// The CloseWatcher API (Escape and the platform's close request), which TypeScript's DOM library does not declare yet.
// Used only when the browser has it, as in Shoelace.
interface CloseWatcher {
  onclose: (() => void) | null;
  destroy(): void;
}
declare const CloseWatcher: { new (): CloseWatcher };

// Built on the @charm-ux/core base element: core has no dropdown component, and its menu component (a trigger, a popup and
// `menu-show` / `menu-hide` events) is a different model from Shoelace's trigger slot, default slot and `sl-show` /
// `sl-hide` events. The only core extension that remains is the non-bubbling `ready` event on first update.
/**
 * Dropdowns expose additional content that "drops down" in a panel. API modelled on Shoelace's `sl-dropdown`.
 *
 * The panel is positioned by an `<sl-popup>` (Velcro's), as in Shoelace. Like Shoelace's, constructing a dropdown defines
 * its dependency `<sl-popup>` when no element owns that tag yet, so the class-only entry needs no extra step. The show and
 * hide animations come from the animation registry (`dropdown.show` and `dropdown.hide`); change them with
 * `setAnimation()` or `setDefaultAnimation()` from `@charm-ux/velcro/utilities/animation-registry`.
 *
 * @property {string} lang - The element's language, as set by the `lang` attribute or property. Not reflected.
 *
 * @tag sl-dropdown
 * @status prototype
 *
 * @dependency sl-popup
 *
 * @slot - The dropdown's main content.
 * @slot trigger - The dropdown's trigger, usually a `<sl-button>` element.
 *
 * @event sl-show - Emitted when the dropdown opens.
 * @event sl-after-show - Emitted after the dropdown opens and all animations are complete.
 * @event sl-hide - Emitted when the dropdown closes.
 * @event sl-after-hide - Emitted after the dropdown closes and all animations are complete.
 *
 * @csspart base - The component's base wrapper, an `<sl-popup>` element.
 * @csspart base__popup - The popup's exported `popup` part. Use this to target the tooltip's popup container.
 * @csspart trigger - The container that wraps the trigger.
 * @csspart panel - The panel that gets shown when the dropdown is open.
 *
 * @animation dropdown.show - The animation to use when showing the dropdown.
 * @animation dropdown.hide - The animation to use when hiding the dropdown.
 */
export class VelcroDropdown extends ShoelaceCompat(CharmElement, { lang: true, dir: true, reflected: true }) {
  public static override baseName = 'dropdown';

  // Core's base styles are replaced by Shoelace's own (see the styles file).
  public static override styles = [styles];

  // Shoelace's `static dependencies` for the dropdown: the elements its template renders. Shoelace keys them by tag; here
  // the tag is derived from each class's `baseName` (`sl-popup` for `VelcroPopup`), the same tag `defineVelcroComponent`
  // defines and the template renders. As in Shoelace's base element, each one that is not defined yet is defined when a
  // dropdown is constructed, and a tag that another constructor already owns is left alone (with Shoelace's warning when
  // the versions differ). If the platform refuses the class itself (for example because it is already registered under
  // another tag), an anonymous subclass is defined instead, as Shoelace does. Core's own array-typed `dependencies`
  // (registration in core's scope) stays empty. Not part of the documented API (Shoelace's manifest lists `dependencies`
  // without a description).
  private static readonly shoelaceDependencies: readonly VelcroComponentConstructor[] = [VelcroPopup];

  public constructor() {
    super();
    for (const component of VelcroDropdown.shoelaceDependencies) defineVelcroComponent(component);
  }

  // Shoelace's public `@query` fields: the popup, the trigger slot and the panel (default) slot.
  @query('.dropdown')
  public popup!: VelcroPopup;

  @query('.dropdown__trigger')
  public trigger!: HTMLSlotElement;

  @query('.dropdown__panel')
  public panel!: HTMLSlotElement;

  // As in Shoelace: the controller re-renders the dropdown when the document's language or direction changes. The
  // animations' direction is resolved by animationDirection(), as Shoelace's controller resolves it.
  private readonly localize = new LocalizeController(this);

  private closeWatcher: CloseWatcher | null = null;

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

  /**
   * Indicates whether or not the dropdown is open. You can toggle this attribute to show and hide the dropdown, or you
   * can use the `show()` and `hide()` methods and this attribute will reflect the dropdown's open state.
   */
  @property({ type: Boolean, reflect: true })
  public open = false;

  /**
   * The preferred placement of the dropdown panel. Note that the actual placement may vary as needed to keep the panel
   * inside of the viewport.
   */
  @property({ reflect: true })
  public placement:
    | 'top'
    | 'top-start'
    | 'top-end'
    | 'bottom'
    | 'bottom-start'
    | 'bottom-end'
    | 'right'
    | 'right-start'
    | 'right-end'
    | 'left'
    | 'left-start'
    | 'left-end' = 'bottom-start';

  /** Disables the dropdown so the panel will not open. */
  @property({ type: Boolean, reflect: true })
  public disabled = false;

  /**
   * By default, the dropdown is closed when an item is selected. This attribute will keep it open instead. Useful for
   * dropdowns that allow for multiple interactions.
   */
  @property({ attribute: 'stay-open-on-select', type: Boolean, reflect: true })
  public stayOpenOnSelect = false;

  /**
   * The dropdown will close when the user interacts outside of this element (e.g. clicking). Useful for composing other
   * components that use a dropdown internally.
   */
  @property({ attribute: false })
  public containingElement?: HTMLElement;

  /** The distance in pixels from which to offset the panel away from its trigger. */
  @property({ type: Number })
  public distance = 0;

  /** The distance in pixels from which to offset the panel along its trigger. */
  @property({ type: Number })
  public skidding = 0;

  /**
   * Enable this option to prevent the panel from being clipped when the component is placed inside a container with
   * `overflow: auto|scroll`. Hoisting uses a fixed positioning strategy that works in many, but not all, scenarios.
   */
  @property({ type: Boolean })
  public hoist = false;

  /**
   * Syncs the popup width or height to that of the trigger element.
   */
  @property({ reflect: true })
  public sync: 'width' | 'height' | 'both' | undefined = undefined;

  public override connectedCallback() {
    super.connectedCallback();

    if (!this.containingElement) {
      this.containingElement = this;
    }
  }

  protected override firstUpdated() {
    // Core's base element emits its non-bubbling `ready` event here.
    super.firstUpdated();

    this.panel.hidden = !this.open;

    // If the dropdown is visible on init, update its position
    if (this.open) {
      this.addOpenListeners();
      this.popup.active = true;
    }
  }

  public override disconnectedCallback() {
    super.disconnectedCallback();
    this.removeOpenListeners();
    void this.hide();
  }

  protected override willUpdate(changed: PropertyValues<this>) {
    restoreReflectedProperties(this, changed);
  }

  // Shoelace's `@watch('open', { waitUntilFirstUpdate: true })`: it runs before the render, and only after the first update.
  protected override update(changed: PropertyValues<this>) {
    if (this.hasUpdated && changed.has('open') && changed.get('open') !== this.open) {
      void this.handleOpenChange();
    }

    super.update(changed);
  }

  /**
   * The direction the show and hide animations use, as Shoelace's localization controller resolves it: the host's `dir`
   * property (set directly or through the attribute), else the controller's document-direction snapshot (`<html dir>`
   * as of the last observer callback or translation registration, not a live read; else `ltr`), lower-cased. Velcro's
   * shared controller reads the host attribute instead, which misses a direction set only through the property.
   */
  private animationDirection(): string {
    void this.localize;
    return `${super.dir || documentDir()}`.toLowerCase();
  }

  public focusOnTrigger() {
    const trigger = this.trigger.assignedElements({ flatten: true })[0] as HTMLElement | undefined;
    if (typeof trigger?.focus === 'function') {
      trigger.focus();
    }
  }

  public getMenu() {
    return this.panel.assignedElements({ flatten: true }).find(el => el.tagName.toLowerCase() === 'sl-menu') as
      | VelcroMenu
      | undefined;
  }

  // Upstream quirk: when the browser has the CloseWatcher API, Escape is handled by the watcher alone. The panel's keydown
  // handler is then never attached (addOpenListeners), so an Escape keydown inside the panel is not stopped and reaches the
  // page's listeners; without the API the handler below stops it. Listed on the docs page and covered by
  // tests/product/dropdown.spec.mjs (the propagation). Internal note, not observable beyond that propagation: the reference
  // to a destroyed watcher is never cleared either, which keeps the document handler's Escape branch off from the first
  // open on.
  private handleKeyDown = (event: KeyboardEvent) => {
    // Close when escape is pressed inside an open dropdown. We need to listen on the panel itself and stop propagation
    // in case any ancestors are also listening for this key.
    if (this.open && event.key === 'Escape') {
      event.stopPropagation();
      void this.hide();
      this.focusOnTrigger();
    }
  };

  private handleDocumentKeyDown = (event: KeyboardEvent) => {
    // Close when escape or tab is pressed
    if (event.key === 'Escape' && this.open && !this.closeWatcher) {
      event.stopPropagation();
      this.focusOnTrigger();
      void this.hide();
      return;
    }

    // Handle tabbing
    if (event.key === 'Tab') {
      // Tabbing within an open menu should close the dropdown and refocus the trigger
      if (this.open && document.activeElement?.tagName.toLowerCase() === 'sl-menu-item') {
        event.preventDefault();
        void this.hide();
        this.focusOnTrigger();
        return;
      }

      const computeClosestContaining = (element: Element | null | undefined, tagName: string): Element | null => {
        if (!element) return null;

        const closest = element.closest(tagName);
        if (closest) return closest;

        const rootNode = element.getRootNode();
        if (rootNode instanceof ShadowRoot) {
          return computeClosestContaining(rootNode.host, tagName);
        }

        return null;
      };

      // Tabbing outside of the containing element closes the panel
      //
      // If the dropdown is used within a shadow DOM, we need to obtain the activeElement within that shadowRoot,
      // otherwise `document.activeElement` will only return the name of the parent shadow DOM element.
      setTimeout(() => {
        const activeElement =
          this.containingElement?.getRootNode() instanceof ShadowRoot ? getDeepestActiveElement() : document.activeElement;

        if (
          !this.containingElement ||
          computeClosestContaining(activeElement, this.containingElement.tagName.toLowerCase()) !== this.containingElement
        ) {
          void this.hide();
        }
      });
    }
  };

  private handleDocumentMouseDown = (event: MouseEvent) => {
    // Close when clicking outside of the containing element
    const path = event.composedPath();
    if (this.containingElement && !path.includes(this.containingElement)) {
      void this.hide();
    }
  };

  private handlePanelSelect = (event: CustomEvent<{ item: VelcroMenuItem }>) => {
    const target = event.target as HTMLElement;

    // Hide the dropdown when a menu item is selected
    if (!this.stayOpenOnSelect && target.tagName.toLowerCase() === 'sl-menu') {
      void this.hide();
      this.focusOnTrigger();
    }
  };

  public handleTriggerClick() {
    if (this.open) {
      void this.hide();
    } else {
      void this.show();
      this.focusOnTrigger();
    }
  }

  public async handleTriggerKeyDown(event: KeyboardEvent) {
    // When spacebar/enter is pressed, show the panel but don't focus on the menu. This let's the user press the same
    // key again to hide the menu in case they don't want to make a selection.
    if ([' ', 'Enter'].includes(event.key)) {
      event.preventDefault();
      this.handleTriggerClick();
      return;
    }

    const menu = this.getMenu();

    if (menu) {
      const menuItems = menu.getAllItems();
      const firstMenuItem = menuItems[0];
      const lastMenuItem = menuItems[menuItems.length - 1];

      // When up/down is pressed, we make the assumption that the user is familiar with the menu and plans to make a
      // selection. Rather than toggle the panel, we focus on the menu (if one exists) and activate the first item for
      // faster navigation.
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        event.preventDefault();

        // Show the menu if it's not already open
        if (!this.open) {
          void this.show();

          // Wait for the dropdown to open before focusing, but not the animation
          await this.updateComplete;
        }

        if (menuItems.length > 0) {
          // Focus on the first/last menu item after showing
          void this.updateComplete.then(() => {
            if (event.key === 'ArrowDown' || event.key === 'Home') {
              menu.setCurrentItem(firstMenuItem);
              firstMenuItem.focus();
            }

            if (event.key === 'ArrowUp' || event.key === 'End') {
              menu.setCurrentItem(lastMenuItem);
              lastMenuItem.focus();
            }
          });
        }
      }
    }
  }

  public handleTriggerKeyUp(event: KeyboardEvent) {
    // Prevent space from triggering a click event in Firefox
    if (event.key === ' ') {
      event.preventDefault();
    }
  }

  public handleTriggerSlotChange() {
    this.updateAccessibleTrigger();
  }

  //
  // Slotted triggers can be arbitrary content, but we need to link them to the dropdown panel with `aria-haspopup` and
  // `aria-expanded`. These must be applied to the "accessible trigger" (the tabbable portion of the trigger element
  // that gets slotted in) so screen readers will understand them. The accessible trigger could be the slotted element,
  // a child of the slotted element, or an element in the slotted element's shadow root.
  //
  // For example, the accessible trigger of an <sl-button> is a <button> located inside its shadow root.
  //
  // To determine this, we assume the first tabbable element in the trigger slot is the "accessible trigger."
  //
  public updateAccessibleTrigger() {
    const assignedElements = this.trigger.assignedElements({ flatten: true }) as HTMLElement[];
    const accessibleTrigger = assignedElements.find(el => getTabbableBoundary(el).start);
    let target: HTMLElement;

    if (accessibleTrigger) {
      switch (accessibleTrigger.tagName.toLowerCase()) {
        // Shoelace buttons have to update the internal button so it's announced correctly by screen readers
        case 'sl-button':
        case 'sl-icon-button':
          target = (accessibleTrigger as VelcroButton | VelcroIconButton).button;
          break;

        default:
          target = accessibleTrigger;
      }

      target.setAttribute('aria-haspopup', 'true');
      target.setAttribute('aria-expanded', this.open ? 'true' : 'false');
    }
  }

  /** Shows the dropdown panel. */
  public async show() {
    if (this.open) {
      return undefined;
    }

    this.open = true;
    return waitForEvent(this, 'sl-after-show');
  }

  /** Hides the dropdown panel */
  public async hide() {
    if (!this.open) {
      return undefined;
    }

    this.open = false;
    return waitForEvent(this, 'sl-after-hide');
  }

  /**
   * Instructs the dropdown menu to reposition. Useful when the position or size of the trigger changes when the menu
   * is activated.
   */
  public reposition() {
    this.popup.reposition();
  }

  public addOpenListeners() {
    this.panel.addEventListener('sl-select', this.handlePanelSelect as EventListener);
    if ('CloseWatcher' in window) {
      this.closeWatcher?.destroy();
      this.closeWatcher = new CloseWatcher();
      this.closeWatcher.onclose = () => {
        void this.hide();
        this.focusOnTrigger();
      };
    } else {
      this.panel.addEventListener('keydown', this.handleKeyDown);
    }
    document.addEventListener('keydown', this.handleDocumentKeyDown);
    document.addEventListener('mousedown', this.handleDocumentMouseDown);
  }

  public removeOpenListeners() {
    if (this.panel) {
      this.panel.removeEventListener('sl-select', this.handlePanelSelect as EventListener);
      this.panel.removeEventListener('keydown', this.handleKeyDown);
    }
    document.removeEventListener('keydown', this.handleDocumentKeyDown);
    document.removeEventListener('mousedown', this.handleDocumentMouseDown);
    this.closeWatcher?.destroy();
  }

  // Upstream quirk: a dropdown that is disabled cannot be opened (`open` is set back to false and nothing is emitted, so the
  // promise `show()` returned never settles), but disabling one that is already open does not close it.
  public async handleOpenChange() {
    if (this.disabled) {
      this.open = false;
      return;
    }

    this.updateAccessibleTrigger();

    if (this.open) {
      // Show
      this.emit('sl-show');
      this.addOpenListeners();

      await stopAnimations(this);
      this.panel.hidden = false;
      this.popup.active = true;
      const { keyframes, options } = getAnimation(this, 'dropdown.show', { dir: this.animationDirection() });
      await animateTo(this.popup.popup, keyframes, options);

      this.emit('sl-after-show');
    } else {
      // Hide
      this.emit('sl-hide');
      this.removeOpenListeners();

      await stopAnimations(this);
      const { keyframes, options } = getAnimation(this, 'dropdown.hide', { dir: this.animationDirection() });
      await animateTo(this.popup.popup, keyframes, options);
      this.panel.hidden = true;
      this.popup.active = false;

      this.emit('sl-after-hide');
    }
  }

  protected override render() {
    return html`
      <sl-popup
        part="base"
        exportparts="popup:base__popup"
        id="dropdown"
        placement=${this.placement}
        distance=${this.distance}
        skidding=${this.skidding}
        strategy=${this.hoist ? 'fixed' : 'absolute'}
        flip
        shift
        auto-size="vertical"
        auto-size-padding="10"
        sync=${ifDefined(this.sync ? this.sync : undefined)}
        class=${classMap({
          dropdown: true,
          'dropdown--open': this.open,
        })}
      >
        <slot
          name="trigger"
          slot="anchor"
          part="trigger"
          class="dropdown__trigger"
          @click=${this.handleTriggerClick}
          @keydown=${this.handleTriggerKeyDown}
          @keyup=${this.handleTriggerKeyUp}
          @slotchange=${this.handleTriggerSlotChange}
        ></slot>

        <div aria-hidden=${this.open ? 'false' : 'true'} aria-labelledby="dropdown">
          <slot part="panel" class="dropdown__panel"></slot>
        </div>
      </sl-popup>
    `;
  }
}

setDefaultAnimation('dropdown.show', {
  keyframes: [
    { opacity: 0, scale: 0.9 },
    { opacity: 1, scale: 1 },
  ],
  options: { duration: 100, easing: 'ease' },
});

setDefaultAnimation('dropdown.hide', {
  keyframes: [
    { opacity: 1, scale: 1 },
    { opacity: 0, scale: 0.9 },
  ],
  options: { duration: 100, easing: 'ease' },
});

export default VelcroDropdown;
