// Adapted from Shoelace v2.20.1 (src/components/tab-group/tab-group.component.ts and the reflected-property restore and
// dependency definition in src/internal/shoelace-element.ts), Copyright (c) 2020 A Beautiful Site, LLC, MIT License. See
// THIRD_PARTY_NOTICES.md. The API documentation wording, the rendered structure, the tab and panel syncing, the keyboard
// handling, the activation, placement, indicator and scroll-control logic, the mutation, resize and intersection
// observers and the `sl-tab-show` / `sl-tab-hide` events follow Shoelace. Velcro changes: built on the @charm-ux/core base
// element (core's tabs component is not used, see the class comment), the `@watch` handlers run from `update()`, and
// the dependencies on <sl-icon-button> and <sl-resize-observer> are defined when a tab group is constructed through
// Velcro's registration helper rather than Shoelace's `static dependencies`. Shoelace's behavior is matched exactly,
// including its quirks; each one is marked "Upstream quirk" below and listed on the docs page.
import './scrollend-polyfill.js';
import { html, type PropertyValues } from 'lit';
import { eventOptions, property, query, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { CharmElement } from '@charm-ux/core/dist/base/charm-element/charm-element.js';
import { defineVelcroComponent, type VelcroComponentConstructor } from '../../utilities/registration.js';
import { LocalizeController } from '../../utilities/localize.js';
import { VelcroIconButton } from '../icon-button/class.js';
import { VelcroResizeObserver } from '../resize-observer/class.js';
import type { VelcroTab } from '../tab/class.js';
import type { VelcroTabPanel } from '../tab-panel/class.js';
import { scrollIntoView } from '../../internal/scroll.js';
import styles from './tab-group.styles.js';

/**
 * Tab groups organize content into a container that shows one section at a time. API modelled on Shoelace's
 * `sl-tab-group`. It renders `<sl-icon-button>` scroll buttons and an `<sl-resize-observer>`, as in Shoelace; like
 * Shoelace's, constructing a tab group defines those dependencies (Velcro's) when no element owns their tags yet.
 *
 * Built on the @charm-ux/core base element. Core's tabs component is not extended: its model differs from Shoelace's
 * (tabs in the default slot and panels in a `tabpanel` slot, selection by an `active-id` attribute, `layout` and
 * `manual-activation` attributes and a `tabs-change` event), and its `tabs` member is a slot query that Shoelace's tab
 * list cannot share. The only core extension is the non-bubbling `ready` event on first update.
 *
 * @tag sl-tab-group
 * @status prototype
 *
 * @dependency sl-icon-button
 *
 * @slot - Used for grouping tab panels in the tab group. Must be `<sl-tab-panel>` elements.
 * @slot nav - Used for grouping tabs in the tab group. Must be `<sl-tab>` elements.
 *
 * @event {{ name: String }} sl-tab-show - Emitted when a tab is shown.
 * @event {{ name: String }} sl-tab-hide - Emitted when a tab is hidden.
 *
 * @csspart base - The component's base wrapper.
 * @csspart nav - The tab group's navigation container where tabs are slotted in.
 * @csspart tabs - The container that wraps the tabs.
 * @csspart active-tab-indicator - The line that highlights the currently selected tab.
 * @csspart body - The tab group's body where tab panels are slotted in.
 * @csspart scroll-button - The previous/next scroll buttons that show when tabs are scrollable, an `<sl-icon-button>`.
 * @csspart scroll-button--start - The starting scroll button.
 * @csspart scroll-button--end - The ending scroll button.
 * @csspart scroll-button__base - The scroll button's exported `base` part.
 *
 * @cssproperty --indicator-color - The color of the active tab indicator.
 * @cssproperty --track-color - The color of the indicator's track (the line that separates tabs from panels).
 * @cssproperty --track-width - The width of the indicator's track (the line that separates tabs from panels).
 */
export class VelcroTabGroup extends CharmElement {
  public static override baseName = 'tab-group';

  // Core's base styles are replaced by Shoelace's own (see the styles file).
  public static override styles = [styles];

  // Shoelace's `static dependencies` for the tab group: the elements its template renders. Shoelace keys them by tag;
  // here the tag is derived from each class's `baseName`, the same tag `defineVelcroComponent` defines and the template
  // renders. As in Shoelace's base element, each one that is not defined yet is defined when a tab group is
  // constructed, and a tag that another constructor already owns is left alone (with Shoelace's warning when the
  // versions differ). If the platform refuses the class itself (for example because it is already registered under
  // another tag), an anonymous subclass is defined instead, as Shoelace does. Core's own array-typed `dependencies`
  // (registration in core's scope) stays empty.
  private static readonly shoelaceDependencies: readonly VelcroComponentConstructor[] = [
    VelcroIconButton,
    VelcroResizeObserver,
  ];

  public constructor() {
    super();
    for (const component of VelcroTabGroup.shoelaceDependencies) defineVelcroComponent(component);
  }

  // Shoelace's base element restores a reflected property's initial value when its attribute is removed. The tab group
  // has no reflected property, so nothing is ever restored; the hook is kept so that the behavior stays Shoelace's if
  // one is added.
  private readonly initialReflectedProperties = new Map<string, unknown>();

  private hasRecordedInitialProperties = false;

  private velcroDir?: string;

  private activeTab?: VelcroTab;

  private mutationObserver!: MutationObserver;

  private resizeObserver!: ResizeObserver;

  private tabs: VelcroTab[] = [];

  private focusableTabs: VelcroTab[] = [];

  private panels: VelcroTabPanel[] = [];

  private readonly localize = new LocalizeController(this);

  // Shoelace's public `@query('.tab-group')` field: tab group's base wrapper.
  @query('.tab-group')
  public tabGroup!: HTMLElement;

  // Shoelace's public `@query('.tab-group__body')` field: body slot.
  @query('.tab-group__body')
  public body!: HTMLSlotElement;

  // Shoelace's public `@query('.tab-group__nav')` field: scrolling nav wrapper.
  @query('.tab-group__nav')
  public nav!: HTMLElement;

  // Shoelace's public `@query('.tab-group__indicator')` field: active tab indicator.
  @query('.tab-group__indicator')
  public indicator!: HTMLElement;

  @state()
  private hasScrollControls = false;

  @state()
  private shouldHideScrollStartButton = false;

  @state()
  private shouldHideScrollEndButton = false;

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

  // Upstream quirk: placement is not reflected, so `sl-tab-group[placement=...]` selectors only match the attribute as
  // written in markup.
  /** The placement of the tabs. */
  @property()
  public placement: 'top' | 'bottom' | 'start' | 'end' = 'top';

  /**
   * When set to auto, navigating tabs with the arrow keys will instantly show the corresponding tab panel. When set to
   * manual, the tab will receive focus but will not show until the user presses spacebar or enter.
   */
  @property()
  public activation: 'auto' | 'manual' = 'auto';

  /** Disables the scroll arrows that appear when tabs overflow. */
  @property({ attribute: 'no-scroll-controls', type: Boolean })
  public noScrollControls = false;

  /** Prevent scroll buttons from being hidden when inactive. */
  @property({ attribute: 'fixed-scroll-controls', type: Boolean })
  public fixedScrollControls = false;

  public override attributeChangedCallback(name: string, previous: string | null, next: string | null) {
    if (!this.hasRecordedInitialProperties) {
      (this.constructor as typeof VelcroTabGroup).elementProperties.forEach((options, prop) => {
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

  public override connectedCallback() {
    const whenAllDefined = Promise.all([customElements.whenDefined('sl-tab'), customElements.whenDefined('sl-tab-panel')]);

    super.connectedCallback();

    this.resizeObserver = new ResizeObserver(() => {
      this.repositionIndicator();
      this.updateScrollControls();
    });

    this.mutationObserver = new MutationObserver(mutations => {
      // Make sure to only observe the direct children of the tab group
      // instead of other sub elements that might be slotted in.
      // @see https://github.com/shoelace-style/shoelace/issues/2320
      const instanceMutations = mutations.filter(({ target }) => {
        if (target === this) return true; // Allow self updates
        if ((target as HTMLElement).closest('sl-tab-group') !== this) return false; // We are not direct children

        // We should only care about changes to the tab or tab panel
        const tagName = (target as HTMLElement).tagName.toLowerCase();
        return tagName === 'sl-tab' || tagName === 'sl-tab-panel';
      });

      if (instanceMutations.length === 0) {
        return;
      }

      // Update aria labels when the DOM changes
      if (instanceMutations.some(m => !['aria-labelledby', 'aria-controls'].includes(m.attributeName!))) {
        setTimeout(() => this.setAriaLabels());
      }

      // Sync tabs when disabled states change
      if (instanceMutations.some(m => m.attributeName === 'disabled')) {
        this.syncTabsAndPanels();
        // sync tabs when active state on tab changes
      } else if (instanceMutations.some(m => m.attributeName === 'active')) {
        const tabs = instanceMutations
          .filter(m => m.attributeName === 'active' && (m.target as HTMLElement).tagName.toLowerCase() === 'sl-tab')
          .map(m => m.target as VelcroTab);
        const newActiveTab = tabs.find(tab => tab.active);

        if (newActiveTab) {
          this.setActiveTab(newActiveTab);
        }
      }
    });

    // After the first update...
    void this.updateComplete.then(() => {
      this.syncTabsAndPanels();

      this.mutationObserver.observe(this, {
        attributes: true,
        attributeFilter: ['active', 'disabled', 'name', 'panel'],
        childList: true,
        subtree: true,
      });

      this.resizeObserver.observe(this.nav);

      // Wait for tabs and tab panels to be registered
      void whenAllDefined.then(() => {
        // Set initial tab state when the tabs become visible
        const intersectionObserver = new IntersectionObserver((entries, observer) => {
          if (entries[0].intersectionRatio > 0) {
            this.setAriaLabels();
            this.setActiveTab(this.getActiveTab() ?? this.tabs[0], { emitEvents: false });
            observer.unobserve(entries[0].target);
          }
        });
        intersectionObserver.observe(this.tabGroup);
      });
    });
  }

  public override disconnectedCallback() {
    super.disconnectedCallback();
    this.mutationObserver?.disconnect();

    if (this.nav) {
      this.resizeObserver?.unobserve(this.nav);
    }
  }

  protected override willUpdate(changed: PropertyValues<this>) {
    super.willUpdate(changed);
    this.initialReflectedProperties.forEach((value, prop) => {
      const self = this as unknown as Record<string, unknown>;
      if (changed.has(prop as keyof VelcroTabGroup) && self[prop] == null) {
        self[prop] = value;
      }
    });
  }

  // Shoelace's `@watch('noScrollControls', { waitUntilFirstUpdate: true })` and `@watch('placement', { waitUntilFirstUpdate:
  // true })`: they run before the render, from the second update on. Shoelace applies the decorators in declaration order
  // and each wraps `update`, so the later one (`placement`) runs first.
  protected override update(changed: PropertyValues<this>) {
    if (this.hasUpdated) {
      if (changed.has('placement') && changed.get('placement') !== this.placement) {
        this.syncIndicator();
      }
      if (changed.has('noScrollControls') && changed.get('noScrollControls') !== this.noScrollControls) {
        this.updateScrollControls();
      }
    }

    super.update(changed);
  }

  // Shoelace's localization controller resolves the direction from the host's `dir` property, else the document's
  // (`<html dir>`, else ltr). Velcro's shared controller reads the host's `dir` attribute instead (core's `dir` getter
  // returns the computed direction), which would miss a direction set only through the property; this component's `dir`
  // returns what was set, by attribute or property, so it resolves the direction the way Shoelace does.
  private direction() {
    return `${this.velcroDir || document.documentElement.dir || 'ltr'}`.toLowerCase();
  }

  private getAllTabs() {
    const slot = this.shadowRoot!.querySelector<HTMLSlotElement>('slot[name="nav"]')!;

    return slot.assignedElements() as VelcroTab[];
  }

  private getAllPanels() {
    return [...this.body.assignedElements()].filter(el => el.tagName.toLowerCase() === 'sl-tab-panel') as [
      VelcroTabPanel,
    ];
  }

  private getActiveTab() {
    return this.tabs.find(el => el.active);
  }

  private handleClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    const tab = target.closest<VelcroTab>('sl-tab');
    const tabGroup = tab?.closest('sl-tab-group');

    // Ensure the target tab is in this tab group
    if (tabGroup !== this) {
      return;
    }

    if (tab !== null) {
      this.setActiveTab(tab, { scrollBehavior: 'smooth' });
    }
  }

  private handleKeyDown(event: KeyboardEvent) {
    const target = event.target as HTMLElement;
    const tab = target.closest<VelcroTab>('sl-tab');
    const tabGroup = tab?.closest('sl-tab-group');

    // Ensure the target tab is in this tab group
    if (tabGroup !== this) {
      return;
    }

    // Activate a tab
    if (['Enter', ' '].includes(event.key)) {
      if (tab !== null) {
        this.setActiveTab(tab, { scrollBehavior: 'smooth' });
        event.preventDefault();
      }
    }

    // Move focus left or right
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) {
      const activeEl = this.tabs.find(t => t.matches(':focus'));
      const isRtl = this.direction() === 'rtl';
      let nextTab: null | VelcroTab = null;

      if (activeEl?.tagName.toLowerCase() === 'sl-tab') {
        if (event.key === 'Home') {
          nextTab = this.focusableTabs[0];
        } else if (event.key === 'End') {
          nextTab = this.focusableTabs[this.focusableTabs.length - 1];
        } else if (
          (['top', 'bottom'].includes(this.placement) && event.key === (isRtl ? 'ArrowRight' : 'ArrowLeft')) ||
          (['start', 'end'].includes(this.placement) && event.key === 'ArrowUp')
        ) {
          const currentIndex = this.tabs.findIndex(el => el === activeEl);
          nextTab = this.findNextFocusableTab(currentIndex, 'backward');
        } else if (
          (['top', 'bottom'].includes(this.placement) && event.key === (isRtl ? 'ArrowLeft' : 'ArrowRight')) ||
          (['start', 'end'].includes(this.placement) && event.key === 'ArrowDown')
        ) {
          const currentIndex = this.tabs.findIndex(el => el === activeEl);
          nextTab = this.findNextFocusableTab(currentIndex, 'forward');
        }

        if (!nextTab) {
          return;
        }

        nextTab.tabIndex = 0;
        nextTab.focus({ preventScroll: true });

        if (this.activation === 'auto') {
          this.setActiveTab(nextTab, { scrollBehavior: 'smooth' });
        } else {
          this.tabs.forEach(tabEl => {
            tabEl.tabIndex = tabEl === nextTab ? 0 : -1;
          });
        }

        if (['top', 'bottom'].includes(this.placement)) {
          scrollIntoView(nextTab, this.nav, 'horizontal');
        }

        event.preventDefault();
      }
    }
  }

  private handleScrollToStart() {
    this.nav.scroll({
      left:
        this.direction() === 'rtl'
          ? this.nav.scrollLeft + this.nav.clientWidth
          : this.nav.scrollLeft - this.nav.clientWidth,
      behavior: 'smooth',
    });
  }

  private handleScrollToEnd() {
    this.nav.scroll({
      left:
        this.direction() === 'rtl'
          ? this.nav.scrollLeft - this.nav.clientWidth
          : this.nav.scrollLeft + this.nav.clientWidth,
      behavior: 'smooth',
    });
  }

  private setActiveTab(tab: VelcroTab, options?: { emitEvents?: boolean; scrollBehavior?: 'auto' | 'smooth' }) {
    options = {
      emitEvents: true,
      scrollBehavior: 'auto',
      ...options,
    };

    if (tab !== this.activeTab && !tab.disabled) {
      const previousTab = this.activeTab;
      this.activeTab = tab;

      // Sync active tab and panel
      this.tabs.forEach(el => {
        el.active = el === this.activeTab;
        el.tabIndex = el === this.activeTab ? 0 : -1;
      });
      this.panels.forEach(el => (el.active = el.name === this.activeTab?.panel));
      this.syncIndicator();

      if (['top', 'bottom'].includes(this.placement)) {
        scrollIntoView(this.activeTab, this.nav, 'horizontal', options.scrollBehavior);
      }

      // Emit events
      if (options.emitEvents) {
        if (previousTab) {
          this.emit('sl-tab-hide', { detail: { name: previousTab.panel } });
        }

        this.emit('sl-tab-show', { detail: { name: this.activeTab.panel } });
      }
    }
  }

  private setAriaLabels() {
    // Link each tab with its corresponding panel
    this.tabs.forEach(tab => {
      const panel = this.panels.find(el => el.name === tab.panel);
      if (panel) {
        tab.setAttribute('aria-controls', panel.getAttribute('id')!);
        panel.setAttribute('aria-labelledby', tab.getAttribute('id')!);
      }
    });
  }

  private repositionIndicator() {
    const currentTab = this.getActiveTab();

    if (!currentTab) {
      return;
    }

    const width = currentTab.clientWidth;
    const height = currentTab.clientHeight;
    const isRtl = this.direction() === 'rtl';

    // We can't used offsetLeft/offsetTop here due to a shadow parent issue where neither can getBoundingClientRect
    // because it provides invalid values for animating elements: https://bugs.chromium.org/p/chromium/issues/detail?id=920069
    const allTabs = this.getAllTabs();
    const precedingTabs = allTabs.slice(0, allTabs.indexOf(currentTab));
    const offset = precedingTabs.reduce(
      (previous, current) => ({
        left: previous.left + current.clientWidth,
        top: previous.top + current.clientHeight,
      }),
      { left: 0, top: 0 }
    );

    switch (this.placement) {
      case 'top':
      case 'bottom':
        this.indicator.style.width = `${width}px`;
        this.indicator.style.height = 'auto';
        this.indicator.style.translate = isRtl ? `${-1 * offset.left}px` : `${offset.left}px`;
        break;

      case 'start':
      case 'end':
        this.indicator.style.width = 'auto';
        this.indicator.style.height = `${height}px`;
        this.indicator.style.translate = `0 ${offset.top}px`;
        break;
    }
  }

  // This stores tabs and panels so we can refer to a cache instead of calling querySelectorAll() multiple times.
  private syncTabsAndPanels() {
    this.tabs = this.getAllTabs();
    this.focusableTabs = this.tabs.filter(el => !el.disabled);

    this.panels = this.getAllPanels();
    this.syncIndicator();

    // After updating, show or hide scroll controls as needed
    void this.updateComplete.then(() => this.updateScrollControls());
  }

  private findNextFocusableTab(currentIndex: number, direction: 'forward' | 'backward') {
    let nextTab = null;
    const iterator = direction === 'forward' ? 1 : -1;
    let nextIndex = currentIndex + iterator;

    while (currentIndex < this.tabs.length) {
      nextTab = this.tabs[nextIndex] || null;

      if (nextTab === null) {
        // This is where wrapping happens. If we're moving forward and get to the end, then we jump to the beginning. If
        // we're moving backward and get to the start, then we jump to the end.
        if (direction === 'forward') {
          nextTab = this.focusableTabs[0];
        } else {
          nextTab = this.focusableTabs[this.focusableTabs.length - 1];
        }
        break;
      }

      if (!nextTab.disabled) {
        break;
      }

      nextIndex += iterator;
    }

    return nextTab;
  }

  /**
   * The reality of the browser means that we can't expect the scroll position to be exactly what we want it to be, so
   * we add one pixel of wiggle room to our calculations.
   */
  private scrollOffset = 1;

  @eventOptions({ passive: true })
  private updateScrollButtons() {
    if (this.hasScrollControls && !this.fixedScrollControls) {
      this.shouldHideScrollStartButton = this.scrollFromStart() <= this.scrollOffset;
      this.shouldHideScrollEndButton = this.isScrolledToEnd();
    }
  }

  private isScrolledToEnd() {
    return this.scrollFromStart() + this.nav.clientWidth >= this.nav.scrollWidth - this.scrollOffset;
  }

  private scrollFromStart() {
    return this.direction() === 'rtl' ? -this.nav.scrollLeft : this.nav.scrollLeft;
  }

  // Public and undocumented, as in Shoelace: shows or hides the scroll controls for the current overflow.
  public updateScrollControls() {
    if (this.noScrollControls) {
      this.hasScrollControls = false;
    } else {
      // In most cases, we can compare scrollWidth to clientWidth to determine if scroll controls should show. However,
      // Safari appears to calculate this incorrectly when zoomed at 110%, causing the controls to toggle indefinitely.
      // Adding a single pixel to the comparison seems to resolve it.
      //
      // See https://github.com/shoelace-style/shoelace/issues/1839
      this.hasScrollControls =
        ['top', 'bottom'].includes(this.placement) && this.nav.scrollWidth > this.nav.clientWidth + 1;
    }

    this.updateScrollButtons();
  }

  // Public and undocumented, as in Shoelace: shows and positions the active tab indicator.
  public syncIndicator() {
    const tab = this.getActiveTab();

    if (tab) {
      this.indicator.style.display = 'block';
      this.repositionIndicator();
    } else {
      this.indicator.style.display = 'none';
    }
  }

  /** Shows the specified tab panel. */
  public show(panel: string) {
    const tab = this.tabs.find(el => el.panel === panel);

    if (tab) {
      this.setActiveTab(tab, { scrollBehavior: 'smooth' });
    }
  }

  protected override render() {
    const isRtl = this.direction() === 'rtl';

    return html`
      <div
        part="base"
        class=${classMap({
          'tab-group': true,
          'tab-group--top': this.placement === 'top',
          'tab-group--bottom': this.placement === 'bottom',
          'tab-group--start': this.placement === 'start',
          'tab-group--end': this.placement === 'end',
          'tab-group--rtl': this.direction() === 'rtl',
          'tab-group--has-scroll-controls': this.hasScrollControls,
        })}
        @click=${this.handleClick}
        @keydown=${this.handleKeyDown}
      >
        <div class="tab-group__nav-container" part="nav">
          ${this.hasScrollControls
            ? html`
                <sl-icon-button
                  part="scroll-button scroll-button--start"
                  exportparts="base:scroll-button__base"
                  class=${classMap({
                    'tab-group__scroll-button': true,
                    'tab-group__scroll-button--start': true,
                    'tab-group__scroll-button--start--hidden': this.shouldHideScrollStartButton,
                  })}
                  name=${isRtl ? 'chevron-right' : 'chevron-left'}
                  library="system"
                  tabindex="-1"
                  aria-hidden="true"
                  label=${this.localize.term('scrollToStart')}
                  @click=${this.handleScrollToStart}
                ></sl-icon-button>
              `
            : ''}

          <div class="tab-group__nav" @scrollend=${this.updateScrollButtons}>
            <div part="tabs" class="tab-group__tabs" role="tablist">
              <div part="active-tab-indicator" class="tab-group__indicator"></div>
              <sl-resize-observer @sl-resize=${this.syncIndicator}>
                <slot name="nav" @slotchange=${this.syncTabsAndPanels}></slot>
              </sl-resize-observer>
            </div>
          </div>

          ${this.hasScrollControls
            ? html`
                <sl-icon-button
                  part="scroll-button scroll-button--end"
                  exportparts="base:scroll-button__base"
                  class=${classMap({
                    'tab-group__scroll-button': true,
                    'tab-group__scroll-button--end': true,
                    'tab-group__scroll-button--end--hidden': this.shouldHideScrollEndButton,
                  })}
                  name=${isRtl ? 'chevron-left' : 'chevron-right'}
                  library="system"
                  tabindex="-1"
                  aria-hidden="true"
                  label=${this.localize.term('scrollToEnd')}
                  @click=${this.handleScrollToEnd}
                ></sl-icon-button>
              `
            : ''}
        </div>

        <slot part="body" class="tab-group__body" @slotchange=${this.syncTabsAndPanels}></slot>
      </div>
    `;
  }
}

export default VelcroTabGroup;
