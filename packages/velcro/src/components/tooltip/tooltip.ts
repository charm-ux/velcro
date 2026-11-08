// Adapted from Shoelace v2.20.1 (src/components/tooltip/tooltip.component.ts, the `watch` decorator in
// src/internal/watch.ts and the reflected-property restore in src/internal/shoelace-element.ts), Copyright (c) 2020 A
// Beautiful Site, LLC, MIT License. See THIRD_PARTY_NOTICES.md.
// The API documentation wording, the rendered structure (an <sl-popup> `base` whose anchor is the default slot and whose
// `body` holds the `content` slot), the triggers, the delays, the events, the animations and the Escape handling follow
// Shoelace. Velcro changes: built on the @charm-ux/core tooltip (core-only extras are kept, see the class comment).
import { type PropertyValues, html } from 'lit';
import { property, query } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { CharmElement } from '@charm-ux/core/dist/base/charm-element/charm-element.js';
import { animateTo, parseDuration, stopAnimations } from '../../internal/animate.js';
import { waitForEvent } from '../../internal/event.js';
import { getAnimation, setDefaultAnimation } from '../../utilities/animation-registry.js';
import { LocalizeController } from '../../utilities/localize.js';
import { defineVelcroComponent, type VelcroComponentConstructor } from '../../utilities/registration.js';
import { VelcroPopup } from '../popup/class.js';
import { CoreTooltipTyping } from './core-typing.js';
import styles from './tooltip.styles.js';

type TooltipPlacement =
  | 'top'
  | 'top-start'
  | 'top-end'
  | 'right'
  | 'right-start'
  | 'right-end'
  | 'bottom'
  | 'bottom-start'
  | 'bottom-end'
  | 'left'
  | 'left-start'
  | 'left-end';

// The CloseWatcher API (Escape and the platform's close request), which TypeScript's DOM library does not declare yet.
// Used only when the browser has it, as in Shoelace.
interface CloseWatcher {
  onclose: (() => void) | null;
  destroy(): void;
}
declare const CloseWatcher: { new (): CloseWatcher };

/**
 * Tooltips display additional information based on a specific action.
 *
 * The tooltip is positioned by an `<sl-popup>` (Velcro's), as in Shoelace. Like Shoelace's, constructing a tooltip
 * defines its dependency `<sl-popup>` when no element owns that tag yet, so the class-only entry needs no extra step.
 * The show and hide animations come from the animation registry (`tooltip.show` and `tooltip.hide`); change them with
 * `setAnimation()` or `setDefaultAnimation()` from `@charm-ux/velcro/utilities/animation-registry`.
 *
 * Velcro extensions inherited from the core tooltip: `fixed-placement` (uses the fixed positioning strategy, like
 * `hoist`) and `toggle()` (shows a hidden tooltip and hides an open one) work. The core `arrow` and `anchor`
 * properties are accepted but have no effect: the arrow always shows and the tooltip always anchors to its default
 * slot, as in Shoelace.
 *
 * @tag sl-tooltip
 * @status prototype
 *
 * @dependency sl-popup
 *
 * @slot - The tooltip's target element. Avoid slotting in more than one element, as subsequent ones will be ignored.
 * @slot content - The content to render in the tooltip. Alternatively, you can use the `content` attribute.
 *
 * @event sl-show - Emitted when the tooltip begins to show.
 * @event sl-after-show - Emitted after the tooltip has shown and all animations are complete.
 * @event sl-hide - Emitted when the tooltip begins to hide.
 * @event sl-after-hide - Emitted after the tooltip has hidden and all animations are complete.
 *
 * @inheritedEventDropped tooltip-show - Never emitted: Shoelace's `sl-show` is emitted instead.
 * @inheritedEventDropped tooltip-after-show - Never emitted: Shoelace's `sl-after-show` is emitted instead.
 * @inheritedEventDropped tooltip-hide - Never emitted: Shoelace's `sl-hide` is emitted instead.
 * @inheritedEventDropped tooltip-after-hide - Never emitted: Shoelace's `sl-after-hide` is emitted instead.
 *
 * @csspart base - The component's base wrapper, an `<sl-popup>` element.
 * @csspart base__popup - The popup's exported `popup` part. Use this to target the tooltip's popup container.
 * @csspart base__arrow - The popup's exported `arrow` part. Use this to target the tooltip's arrow.
 * @csspart body - The tooltip's body where its content is rendered.
 *
 * @cssproperty --max-width - The maximum width of the tooltip before its content will wrap.
 * @cssproperty --hide-delay - The amount of time to wait before hiding the tooltip when hovering.
 * @cssproperty --show-delay - The amount of time to wait before showing the tooltip when hovering.
 *
 * @animation tooltip.show - The animation to use when showing the tooltip.
 * @animation tooltip.hide - The animation to use when hiding the tooltip.
 */
export class VelcroTooltip extends CoreTooltipTyping {
  // Only Shoelace's styles: core's tooltip styles and tokens do not apply.
  public static override styles = [styles];

  // Core's array of dependencies registers core's popup in core's scope; this template renders Velcro's `<sl-popup>`
  // instead, defined by the constructor below (Shoelace's `static dependencies`).
  public static override get dependencies() {
    return [];
  }

  // Shoelace's `static dependencies` for the tooltip: the elements its template renders. Shoelace keys them by tag; here
  // the tag is derived from each class's `baseName` (`sl-popup` for `VelcroPopup`), the same tag `defineVelcroComponent`
  // defines and the template renders. As in Shoelace's base element, each one that is not defined yet is defined when a
  // tooltip is constructed, and a tag that another constructor already owns is left alone, without the warning Shoelace
  // logs when the registered version differs from its own. If the platform refuses the class itself (for example
  // because it is already registered under another tag), an anonymous subclass is defined instead, as Shoelace does.
  // Not part of the documented API (Shoelace's manifest lists `dependencies` without a description).
  private static readonly shoelaceDependencies: readonly VelcroComponentConstructor[] = [VelcroPopup];

  private readonly localize = new LocalizeController(this);
  private closeWatcher: CloseWatcher | null = null;

  private hasRecordedInitialProperties = false;
  private readonly initialReflectedProperties = new Map<string, unknown>();
  private velcroDir?: string;
  private velcroContent = '';
  private velcroPlacement: TooltipPlacement = 'top';
  private velcroDisabled = false;
  private velcroDistance = 8;
  private velcroOpen = false;
  private velcroSkidding = 0;
  private velcroAnchor?: string | Element;
  private velcroFixedPlacement = false;

  // Shoelace's host listeners, added once in the constructor as upstream does. They call the handlers below, which
  // override core's protected handlers of the same names (core's own listener setup does not run, see connectedCallback).
  private readonly blurListener = () => this.handleBlur();
  private readonly focusListener = () => this.handleFocus();
  private readonly clickListener = () => this.handleClick();
  private readonly mouseOverListener = () => this.handleMouseOver();
  private readonly mouseOutListener = () => this.handleMouseOut();

  public constructor() {
    super();
    for (const component of VelcroTooltip.shoelaceDependencies) {
      if (customElements.get(`sl-${component.baseName}`)) continue;
      try {
        defineVelcroComponent(component);
      } catch {
        defineVelcroComponent(class extends component {});
      }
    }
    this.addEventListener('blur', this.blurListener, true);
    this.addEventListener('focus', this.focusListener, true);
    this.addEventListener('click', this.clickListener);
    this.addEventListener('mouseover', this.mouseOverListener);
    this.addEventListener('mouseout', this.mouseOutListener);
  }

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

  @query('slot:not([name])')
  public defaultSlot!: HTMLSlotElement;

  @query('.tooltip__body')
  public override body!: HTMLElement;

  @query('sl-popup')
  public override popup!: VelcroPopup;

  /**
   * The tooltip's content. If you need to display HTML, use the `content` slot instead.
   * @default ''
   */
  @property()
  public override get content(): string {
    return this.velcroContent;
  }
  public override set content(value: string) {
    this.velcroContent = value;
  }

  /**
   * The preferred placement of the tooltip. Note that the actual placement may vary as needed to keep the tooltip
   * inside of the viewport.
   * @default 'top'
   */
  @property()
  public override get placement():
    | 'top'
    | 'top-start'
    | 'top-end'
    | 'right'
    | 'right-start'
    | 'right-end'
    | 'bottom'
    | 'bottom-start'
    | 'bottom-end'
    | 'left'
    | 'left-start'
    | 'left-end' {
    return this.velcroPlacement;
  }
  public override set placement(
    value:
      | 'top'
      | 'top-start'
      | 'top-end'
      | 'right'
      | 'right-start'
      | 'right-end'
      | 'bottom'
      | 'bottom-start'
      | 'bottom-end'
      | 'left'
      | 'left-start'
      | 'left-end',
  ) {
    this.velcroPlacement = value;
  }

  /**
   * Disables the tooltip so it won't show when triggered.
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
   * The distance in pixels from which to offset the tooltip away from its target.
   * @default 8
   */
  @property({ type: Number })
  public override get distance(): number {
    return this.velcroDistance;
  }
  public override set distance(value: number) {
    this.velcroDistance = value;
  }

  /**
   * Indicates whether or not the tooltip is open. You can use this in lieu of the show/hide methods.
   * @default false
   */
  @property({ type: Boolean, reflect: true })
  public override get open(): boolean {
    return this.velcroOpen;
  }
  public override set open(value: boolean) {
    this.velcroOpen = value;
  }

  /**
   * The distance in pixels from which to offset the tooltip along its target.
   * @default 0
   */
  @property({ type: Number })
  public override get skidding(): number {
    return this.velcroSkidding;
  }
  public override set skidding(value: number) {
    this.velcroSkidding = value;
  }

  /**
   * Controls how the tooltip is activated. Possible options include `click`, `hover`, `focus`, and `manual`. Multiple
   * options can be passed by separating them with a space. When manual is used, the tooltip must be activated
   * programmatically.
   */
  @property()
  public override trigger = 'hover focus';

  /**
   * Enable this option to prevent the tooltip from being clipped when the component is placed inside a container with
   * `overflow: auto|hidden|scroll`. Hoisting uses a fixed positioning strategy that works in many, but not all,
   * scenarios.
   */
  @property({ type: Boolean })
  public hoist = false;

  /**
   * Velcro extension (core): uses the fixed positioning strategy, as `hoist` does. Reflected.
   * @default false
   */
  @property({ attribute: 'fixed-placement', type: Boolean, reflect: true })
  public override get fixedPlacement(): boolean {
    return this.velcroFixedPlacement;
  }
  public override set fixedPlacement(value: boolean) {
    this.velcroFixedPlacement = value;
  }

  /**
   * Velcro extension (core), inert: accepted and reflected for compatibility with the core tooltip, without effect. The
   * arrow always shows, as in Shoelace.
   */
  @property({ type: Boolean, reflect: true })
  public override arrow?: boolean;

  /**
   * Velcro extension (core), inert: accepted for compatibility with the core tooltip (an element or the id of one),
   * without effect. The tooltip always anchors to the element in its default slot, as in Shoelace.
   */
  @property()
  public override get anchor(): string | Element | undefined {
    return this.velcroAnchor;
  }
  public override set anchor(value: string | Element | undefined) {
    this.velcroAnchor = value;
  }

  // Skips core's tooltip and dismissible connectedCallback (core's anchor lookup and listeners, and its transition
  // probe); core's base element setup still runs.
  public override connectedCallback() {
    CharmElement.prototype.connectedCallback.call(this);
  }

  // Skips core's tooltip disconnectedCallback (core's listener removal); Shoelace's cleanup runs instead.
  public override disconnectedCallback() {
    CharmElement.prototype.disconnectedCallback.call(this);
    // Cleanup this event in case the tooltip is removed while open
    this.closeWatcher?.destroy();
    document.removeEventListener('keydown', this.handleDocumentKeyDown);
  }

  // Records the reflected properties' values the first time any attribute changes (during upgrade, before the
  // attribute values are applied), so that removing a reflected attribute later restores that value instead of
  // leaving the property null. Same timing and rule as Shoelace's base element.
  public override attributeChangedCallback(name: string, previous: string | null, next: string | null) {
    if (!this.hasRecordedInitialProperties) {
      (this.constructor as typeof VelcroTooltip).elementProperties.forEach((options, prop) => {
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
      if (changed.has(prop as keyof VelcroTooltip) && self[prop] == null) {
        self[prop] = value;
      }
    });
  }

  protected override update(changed: PropertyValues<this>) {
    // Shoelace's `@watch` handlers run before render, the last-declared watcher first: `disabled`, then the options
    // (once for each watched option that changed; `fixedPlacement` is Velcro's), then `open` (after the first update).
    if (changed.has('disabled') && changed.get('disabled') !== this.disabled) {
      this.handleDisabledChange();
    }
    for (const prop of ['content', 'distance', 'hoist', 'placement', 'skidding', 'fixedPlacement'] as const) {
      if (changed.has(prop) && changed.get(prop) !== this[prop]) {
        void this.handleOptionsChange();
      }
    }
    if (this.hasUpdated && changed.has('open') && changed.get('open') !== this.open) {
      void this.handleOpenChange();
    }
    super.update(changed);
  }

  // Skips core's tooltip and dismissible firstUpdated (core's anchor lookup and open handling); core's base element
  // still emits `ready`.
  public override firstUpdated() {
    (CharmElement.prototype as unknown as { firstUpdated(): void }).firstUpdated.call(this);
    this.body.hidden = !this.open;

    // If the tooltip is visible on init, update its position
    if (this.open) {
      this.popup.active = true;
      this.popup.reposition();
    }
  }

  protected override handleBlur() {
    if (this.hasTrigger('focus')) {
      void this.hide();
    }
  }

  protected override handleClick() {
    if (this.hasTrigger('click')) {
      if (this.open) {
        void this.hide();
      } else {
        void this.show();
      }
    }
  }

  protected override handleFocus() {
    if (this.hasTrigger('focus')) {
      void this.show();
    }
  }

  private readonly handleDocumentKeyDown = (event: KeyboardEvent) => {
    // Pressing escape when a tooltip is open should dismiss it
    if (event.key === 'Escape') {
      event.stopPropagation();
      void this.hide();
    }
  };

  protected override handleMouseOver() {
    if (this.hasTrigger('hover')) {
      const delay = parseDuration(getComputedStyle(this).getPropertyValue('--show-delay'));
      clearTimeout(this.hoverTimeout);
      this.hoverTimeout = window.setTimeout(() => this.show(), delay);
    }
  }

  protected override handleMouseOut() {
    if (this.hasTrigger('hover')) {
      const delay = parseDuration(getComputedStyle(this).getPropertyValue('--hide-delay'));
      clearTimeout(this.hoverTimeout);
      this.hoverTimeout = window.setTimeout(() => this.hide(), delay);
    }
  }

  protected override hasTrigger(triggerType: string) {
    const triggers = this.trigger.split(' ');
    return triggers.includes(triggerType);
  }

  public async handleOpenChange() {
    if (this.open) {
      if (this.disabled) {
        return;
      }

      // Show
      this.emit('sl-show');
      if ('CloseWatcher' in window) {
        this.closeWatcher?.destroy();
        this.closeWatcher = new CloseWatcher();
        this.closeWatcher.onclose = () => {
          void this.hide();
        };
      } else {
        document.addEventListener('keydown', this.handleDocumentKeyDown);
      }

      await stopAnimations(this.body);
      this.body.hidden = false;
      this.popup.active = true;
      const { keyframes, options } = getAnimation(this, 'tooltip.show', { dir: this.localize.dir() });
      await animateTo(this.popup.popup, keyframes, options);
      this.popup.reposition();

      this.emit('sl-after-show');
    } else {
      // Hide
      this.emit('sl-hide');
      this.closeWatcher?.destroy();
      document.removeEventListener('keydown', this.handleDocumentKeyDown);

      await stopAnimations(this.body);
      const { keyframes, options } = getAnimation(this, 'tooltip.hide', { dir: this.localize.dir() });
      await animateTo(this.popup.popup, keyframes, options);
      this.popup.active = false;
      this.body.hidden = true;

      this.emit('sl-after-hide');
    }
  }

  public override async handleOptionsChange() {
    if (this.hasUpdated) {
      await this.updateComplete;
      this.popup.reposition();
    }
  }

  public handleDisabledChange() {
    if (this.disabled && this.open) {
      void this.hide();
    }
  }

  /** Shows the tooltip. */
  public override async show() {
    if (this.open) {
      return undefined;
    }

    this.open = true;
    return waitForEvent(this, 'sl-after-show');
  }

  /** Hides the tooltip */
  public override async hide() {
    if (!this.open) {
      return undefined;
    }

    this.open = false;
    return waitForEvent(this, 'sl-after-hide');
  }

  /** Velcro extension (core): shows the tooltip when it is hidden and hides it when it is open. */
  public override toggle() {
    void (this.open ? this.hide() : this.show());
  }

  //
  // NOTE: Tooltip is a bit unique in that we're using aria-live instead of aria-labelledby to trick screen readers into
  // announcing the content. It works really well, but it violates an accessibility rule. We're also adding the
  // aria-describedby attribute to a slot, which is required by <sl-popup> to correctly locate the first assigned
  // element, otherwise positioning is incorrect.
  //
  protected override render() {
    return html`
      <sl-popup
        part="base"
        exportparts="
          popup:base__popup,
          arrow:base__arrow
        "
        class=${classMap({
          tooltip: true,
          'tooltip--open': this.open,
        })}
        placement=${this.placement}
        distance=${this.distance}
        skidding=${this.skidding}
        strategy=${this.hoist || this.fixedPlacement ? 'fixed' : 'absolute'}
        flip
        shift
        arrow
        hover-bridge
      >
        <slot slot="anchor" aria-describedby="tooltip"></slot>

        <div part="body" id="tooltip" class="tooltip__body" role="tooltip" aria-live=${this.open ? 'polite' : 'off'}>
          <slot name="content">${this.content}</slot>
        </div>
      </sl-popup>
    `;
  }
}

setDefaultAnimation('tooltip.show', {
  keyframes: [
    { opacity: 0, scale: 0.8 },
    { opacity: 1, scale: 1 },
  ],
  options: { duration: 150, easing: 'ease' },
});

setDefaultAnimation('tooltip.hide', {
  keyframes: [
    { opacity: 1, scale: 1 },
    { opacity: 0, scale: 0.8 },
  ],
  options: { duration: 150, easing: 'ease' },
});

export default VelcroTooltip;
