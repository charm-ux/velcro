// Portions of the API documentation wording and the behavior in this file (anchoring by slot, id, element or virtual
// element; `active`, `placement`, `strategy`, `distance`, `skidding`, the arrow, flip, shift, auto-size, sync and the
// hover bridge; the rendered `popup` / `popup__arrow` / `popup-hover-bridge` structure; `sl-reposition`; and the
// restore of reflected properties' initial values) are adapted from Shoelace v2.20.1 (src/components/popup/
// popup.component.ts and src/internal/shoelace-element.ts), Copyright (c) 2020 A Beautiful Site, LLC, MIT License. See
// THIRD_PARTY_NOTICES.md. No Shoelace source file or runtime is included. Shoelace's behavior is matched, including its
// quirks; each one is marked "Upstream quirk" below. Velcro changes: the positioning runs through the @charm-ux/core
// popup's Floating UI calls (see "Floating UI through core" below), and the gaps listed on the docs page.
import { html, type PropertyValues } from 'lit';
import { property, query } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { CharmElement } from '@charm-ux/core/dist/base/charm-element/charm-element.js';
import { CorePopup } from '@charm-ux/core/dist/components/popup/popup.js';
import { composedOffsetParent } from '../../internal/composed-offset-parent.js';
import { LocalizeController } from '../../utilities/localize.js';
import styles from './popup.styles.js';

export interface VirtualElement {
  getBoundingClientRect: () => DOMRect;
  contextElement?: Element;
}

function isVirtualElement(e: unknown): e is VirtualElement {
  return (
    e !== null &&
    typeof e === 'object' &&
    'getBoundingClientRect' in e &&
    ('contextElement' in e ? e.contextElement instanceof Element : true)
  );
}

//
// Floating UI through core.
//
// Velcro has no direct dependency on Floating UI; the copy it uses is the one @charm-ux/core's popup imports. Core's
// popup methods are called on small stand-in objects (never on the element), so that they create the same middleware,
// position and auto-update calls that Shoelace makes itself:
//
// - middleware: core's `configure*` methods create a Floating UI middleware, and its options object is then replaced
//   with Shoelace's options. Floating UI middleware read that object each time they run, so the result is the same
//   middleware the factory would return for Shoelace's options.
// - computePosition: core's `reposition` with the stand-in's placement, middleware and strategy. For the `absolute`
//   strategy the stand-in leaves `strategy` undefined, so core keeps Floating UI's own platform (core's replacement
//   offset-parent lookup, which tries the native `offsetParent` first, is only used for `absolute`) and Floating UI
//   applies its `absolute` default. Shoelace instead gives Floating UI's `getOffsetParent` the composed-offset-position
//   lookup for `absolute`. Floating UI's own platform reads `offsetParent` from the popup (and the arrow, for the arrow
//   middleware), so while a computation runs those two elements answer `offsetParent` with that lookup, including the
//   loop over static table elements that Floating UI would otherwise answer natively: the result is the one Shoelace's
//   platform gives.
//   Core awaits the stand-in's (absent) `updateComplete` before it calls Floating UI, one microtask later than
//   Shoelace. The only input Floating UI reads synchronously is the popup's direction (`platform.isRTL`); it is
//   sampled where Shoelace calls Floating UI and pinned on the popup for that synchronous call, so an `sl-reposition`
//   listener that changes the direction affects the next computation, as in Shoelace. Everything else (rects,
//   clipping, middleware) is read after at least one microtask in both, so after any listener has run.
// - autoUpdate: core's `start`, with a no-op for the window scroll listener that core adds (and removed with it).
//
type FloatingMiddleware = { name: string; options?: unknown; fn: (state: unknown) => unknown };
type FloatingPosition = {
  x: number;
  y: number;
  placement: string;
  middlewareData: { arrow?: { x?: number; y?: number } };
};
type StandIn = Record<string, unknown>;

const core = CorePopup.prototype as unknown as Record<
  'configureMiddleware' | 'configureSyncSize' | 'configureFlip' | 'configureShift' | 'configureAutoSize' | 'configureArrow',
  (this: StandIn, middleware?: FloatingMiddleware[]) => FloatingMiddleware[] | undefined
> &
  Record<'reposition' | 'start', (this: StandIn) => unknown>;

const noop = () => {};

function withOptions(created: FloatingMiddleware[], options: Record<string, unknown>): FloatingMiddleware {
  const middleware = created[created.length - 1];
  const target = middleware.options as Record<string, unknown>;
  for (const key of Object.keys(target)) delete target[key];
  Object.assign(target, options);
  return middleware;
}

function offset(options: Record<string, unknown>) {
  // Core's list starts with the offset middleware; the stand-in's no-op `configure*` methods add nothing after it.
  const standIn = { distance: 0, skidding: 0 } as StandIn;
  for (const step of ['configureSyncSize', 'configureFlip', 'configureShift', 'configureAutoSize', 'configureArrow']) standIn[step] = noop;
  return withOptions(core.configureMiddleware.call(standIn)!.slice(0, 1), options);
}

function size(options: Record<string, unknown>) {
  const created: FloatingMiddleware[] = [];
  core.configureSyncSize.call({ sync: 'both', popup: null }, created);
  return withOptions(created, options);
}

function flip(options: Record<string, unknown>) {
  const created: FloatingMiddleware[] = [];
  core.configureFlip.call({ flip: true }, created);
  return withOptions(created, options);
}

function shift(options: Record<string, unknown>) {
  const created: FloatingMiddleware[] = [];
  core.configureShift.call({ shift: true, arrow: false, arrowPadding: 0 }, created);
  return withOptions(created, options);
}

function arrow(options: Record<string, unknown>) {
  const created: FloatingMiddleware[] = [];
  core.configureArrow.call({ arrow: true, arrowEl: true }, created);
  return withOptions(created, options);
}

const nativeOffsetParent = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetParent')!.get!;
const composedLookups = new Map<HTMLElement, number>();

// What Floating UI's `getOffsetParent(element, polyfill)` takes from the polyfill: the first lookup, repeated while it
// gives a static table element (Floating UI's `getTrueOffsetParent` loop).
function shoelaceOffsetParent(element: HTMLElement): Element | null {
  let parent = composedOffsetParent(element);
  while (parent && /^(table|td|th)$/.test(parent.nodeName.toLowerCase()) && getComputedStyle(parent).position === 'static') {
    parent = parent instanceof HTMLElement ? composedOffsetParent(parent) : null;
  }
  return parent;
}

function useComposedOffsetParent(elements: HTMLElement[]): () => void {
  for (const element of elements) {
    if (!Object.prototype.hasOwnProperty.call(element, 'offsetParent')) {
      Object.defineProperty(element, 'offsetParent', {
        configurable: true,
        get(this: HTMLElement) {
          return composedLookups.has(this) ? shoelaceOffsetParent(this) : nativeOffsetParent.call(this);
        },
      });
    }
    composedLookups.set(element, (composedLookups.get(element) ?? 0) + 1);
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    for (const element of elements) {
      const count = composedLookups.get(element)! - 1;
      if (count) composedLookups.set(element, count);
      else composedLookups.delete(element);
    }
  };
}

// Pins the popup's direction to `direction` until the current synchronous run ends (see "Floating UI through core").
// Computations can overlap (an `sl-reposition` listener may start another), so pins on one element share a record: the
// first saves the element's own inline value and priority, later ones only override, and the last release restores
// the saved value. A computation whose direction already matches (possibly through another pin) pins nothing.
const directionPins = new Map<HTMLElement, { value: string; priority: string; count: number }>();

function pinDirection(floating: HTMLElement, direction: string) {
  if (getComputedStyle(floating).direction === direction) return;
  let pin = directionPins.get(floating);
  if (!pin) {
    pin = {
      value: floating.style.getPropertyValue('direction'),
      priority: floating.style.getPropertyPriority('direction'),
      count: 0,
    };
    directionPins.set(floating, pin);
  }
  const record = pin;
  record.count++;
  floating.style.setProperty('direction', direction, 'important');
  queueMicrotask(() => {
    if (--record.count) return;
    directionPins.delete(floating);
    floating.style.setProperty('direction', record.value, record.priority);
  });
}

function computePosition(
  reference: Element | VirtualElement,
  floating: HTMLElement,
  options: { placement: string; middleware: FloatingMiddleware[]; strategy: string; arrowElement?: HTMLElement },
): Promise<FloatingPosition> {
  // Shoelace's call to Floating UI reads the popup's direction here, synchronously.
  const direction = getComputedStyle(floating).direction;
  const release =
    options.strategy === 'absolute'
      ? useComposedOffsetParent(options.arrowElement ? [floating, options.arrowElement] : [floating])
      : noop;
  let popupReads = 0;
  return new Promise<FloatingPosition>((resolve, reject) => {
    const standIn: StandIn = {
      anchorEl: reference,
      // Core reads `popup` once before its await and once more as the argument of its Floating UI call.
      get popup() {
        if (++popupReads === 2) pinDirection(floating, direction);
        return floating;
      },
      placement: options.placement,
      strategy: options.strategy === 'absolute' ? undefined : options.strategy,
      distance: 0,
      floatingUIPlacement: (placement: string) => placement,
      configureMiddleware: () => options.middleware,
      setAttribute: noop,
      setPopupPosition: noop,
      setArrowPosition: (position: FloatingPosition) => resolve(position),
      emit: noop,
    };
    (core.reposition.call(standIn) as Promise<void>).catch(reject);
  }).finally(release);
}

function autoUpdate(reference: Element | VirtualElement, floating: HTMLElement, update: () => void): () => void {
  const standIn: StandIn = { anchorEl: reference, popup: floating, reposition: update, handleScrollDismiss: () => {} };
  core.start.call(standIn);
  return () => {
    (standIn.cleanup as (() => void) | undefined)?.();
    window.removeEventListener('scroll', standIn.handleScrollDismiss as () => void);
  };
}

/**
 * Popup is a utility that lets you declaratively anchor "popup" containers to another element.
 * API modelled on Shoelace's `sl-popup`. It extends the core base element, not the core popup: the core popup is a
 * dismissible surface (`open`, Escape and scroll dismissal, focus trapping, `popup-*` events) whose `anchor`,
 * `placement` and `reposition()` types cannot be narrowed or widened to Shoelace's in a subclass. Its Floating UI
 * positioning is reused (see "Floating UI through core" in the source).
 *
 * @tag sl-popup
 * @status prototype
 *
 * @event sl-reposition - Emitted when the popup is repositioned. This event can fire a lot, so avoid putting expensive
 *  operations in your listener or consider debouncing it.
 *
 * @slot - The popup's content.
 * @slot anchor - The element the popup will be anchored to. If the anchor lives outside of the popup, you can use the
 *  `anchor` attribute or property instead.
 *
 * @csspart arrow - The arrow's container. Avoid setting `top|bottom|left|right` properties, as these values are
 *  assigned dynamically as the popup moves. This is most useful for applying a background color to match the popup, and
 *  maybe a border or box shadow.
 * @csspart popup - The popup's container. Useful for setting a background color, box shadow, etc.
 * @csspart hover-bridge - The hover bridge element. Only available when the `hover-bridge` option is enabled.
 *
 * @cssproperty [--arrow-size=6px] - The size of the arrow. Note that an arrow won't be shown unless the `arrow`
 *  attribute is used.
 * @cssproperty [--arrow-color=var(--sl-color-neutral-0)] - The color of the arrow.
 * @cssproperty [--auto-size-available-width] - A read-only custom property that determines the amount of width the
 *  popup can be before overflowing. Useful for positioning child elements that need to overflow. This property is only
 *  available when using `auto-size`.
 * @cssproperty [--auto-size-available-height] - A read-only custom property that determines the amount of height the
 *  popup can be before overflowing. Useful for positioning child elements that need to overflow. This property is only
 *  available when using `auto-size`.
 */
export class VelcroPopup extends CharmElement {
  public static override baseName = 'popup';

  // Core's base styles are replaced by Shoelace's own (see the styles file).
  public static override styles = [styles];

  private anchorEl: Element | VirtualElement | null = null;
  private cleanup: (() => void) | undefined;
  private readonly localize = new LocalizeController(this);

  /** A reference to the internal popup container. Useful for animating and styling the popup with JavaScript. */
  @query('.popup')
  public popup!: HTMLElement;

  @query('.popup__arrow')
  private arrowEl!: HTMLElement;

  private velcroDir?: string;

  // `dir` and `lang` are declared as Shoelace's base element declares them: reactive, not reflected and without an
  // initial value (undefined). Core's `dir` would return the computed direction instead.
  /** The element's text direction, as set by the `dir` attribute or property. Not reflected. */
  @property()
  public override get dir(): 'ltr' | 'rtl' | 'auto' {
    return this.velcroDir as 'ltr' | 'rtl' | 'auto';
  }
  public override set dir(value: 'ltr' | 'rtl' | 'auto') {
    this.velcroDir = value;
  }

  /** The element's language, as set by the `lang` attribute or property. Not reflected. */
  @property()
  public override lang!: string;

  /**
   * The element the popup will be anchored to. If the anchor lives outside of the popup, you can provide the anchor
   * element `id`, a DOM element reference, or a `VirtualElement`. If the anchor lives inside the popup, use the
   * `anchor` slot instead.
   */
  @property()
  public anchor!: Element | string | VirtualElement;

  /**
   * Activates the positioning logic and shows the popup. When this attribute is removed, the positioning logic is torn
   * down and the popup will be hidden.
   */
  @property({ type: Boolean, reflect: true })
  public active = false;

  /**
   * The preferred placement of the popup. Note that the actual placement will vary as configured to keep the
   * panel inside of the viewport.
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
    | 'left-end' = 'top';

  /**
   * Determines how the popup is positioned. The `absolute` strategy works well in most cases, but if overflow is
   * clipped, using a `fixed` position strategy can often workaround it.
   */
  @property({ reflect: true })
  public strategy: 'absolute' | 'fixed' = 'absolute';

  /** The distance in pixels from which to offset the panel away from its anchor. */
  @property({ type: Number })
  public distance = 0;

  /** The distance in pixels from which to offset the panel along its anchor. */
  @property({ type: Number })
  public skidding = 0;

  /**
   * Attaches an arrow to the popup. The arrow's size and color can be customized using the `--arrow-size` and
   * `--arrow-color` custom properties. For additional customizations, you can also target the arrow using
   * `::part(arrow)` in your stylesheet.
   */
  @property({ type: Boolean })
  public arrow = false;

  /**
   * The placement of the arrow. The default is `anchor`, which will align the arrow as close to the center of the
   * anchor as possible, considering available space and `arrow-padding`. A value of `start`, `end`, or `center` will
   * align the arrow to the start, end, or center of the popover instead.
   */
  @property({ attribute: 'arrow-placement' })
  public arrowPlacement: 'start' | 'end' | 'center' | 'anchor' = 'anchor';

  /**
   * The amount of padding between the arrow and the edges of the popup. If the popup has a border-radius, for example,
   * this will prevent it from overflowing the corners.
   */
  @property({ attribute: 'arrow-padding', type: Number })
  public arrowPadding = 10;

  /**
   * When set, placement of the popup will flip to the opposite site to keep it in view. You can use
   * `flipFallbackPlacements` to further configure how the fallback placement is determined.
   */
  @property({ type: Boolean })
  public flip = false;

  /**
   * If the preferred placement doesn't fit, popup will be tested in these fallback placements until one fits. Must be a
   * string of any number of placements separated by a space, e.g. "top bottom left". If no placement fits, the flip
   * fallback strategy will be used instead.
   * */
  @property({
    attribute: 'flip-fallback-placements',
    converter: {
      fromAttribute: (value: string) => {
        return value
          .split(' ')
          .map(p => p.trim())
          .filter(p => p !== '');
      },
      toAttribute: (value: []) => {
        return value.join(' ');
      },
    },
  })
  public flipFallbackPlacements = '';

  /**
   * When neither the preferred placement nor the fallback placements fit, this value will be used to determine whether
   * the popup should be positioned using the best available fit based on available space or as it was initially
   * preferred.
   */
  @property({ attribute: 'flip-fallback-strategy' })
  public flipFallbackStrategy: 'best-fit' | 'initial' = 'best-fit';

  /**
   * The flip boundary describes clipping element(s) that overflow will be checked relative to when flipping. By
   * default, the boundary includes overflow ancestors that will cause the element to be clipped. If needed, you can
   * change the boundary by passing a reference to one or more elements to this property.
   */
  @property({ type: Object })
  public flipBoundary!: Element | Element[];

  /** The amount of padding, in pixels, to exceed before the flip behavior will occur. */
  @property({ attribute: 'flip-padding', type: Number })
  public flipPadding = 0;

  /** Moves the popup along the axis to keep it in view when clipped. */
  @property({ type: Boolean })
  public shift = false;

  /**
   * The shift boundary describes clipping element(s) that overflow will be checked relative to when shifting. By
   * default, the boundary includes overflow ancestors that will cause the element to be clipped. If needed, you can
   * change the boundary by passing a reference to one or more elements to this property.
   */
  @property({ type: Object })
  public shiftBoundary!: Element | Element[];

  /** The amount of padding, in pixels, to exceed before the shift behavior will occur. */
  @property({ attribute: 'shift-padding', type: Number })
  public shiftPadding = 0;

  /** When set, this will cause the popup to automatically resize itself to prevent it from overflowing. */
  @property({ attribute: 'auto-size' })
  public autoSize!: 'horizontal' | 'vertical' | 'both';

  /** Syncs the popup's width or height to that of the anchor element. */
  @property()
  public sync!: 'width' | 'height' | 'both';

  /**
   * The auto-size boundary describes clipping element(s) that overflow will be checked relative to when resizing. By
   * default, the boundary includes overflow ancestors that will cause the element to be clipped. If needed, you can
   * change the boundary by passing a reference to one or more elements to this property.
   */
  @property({ type: Object })
  public autoSizeBoundary!: Element | Element[];

  /** The amount of padding, in pixels, to exceed before the auto-size behavior will occur. */
  @property({ attribute: 'auto-size-padding', type: Number })
  public autoSizePadding = 0;

  /**
   * When a gap exists between the anchor and the popup element, this option will add a "hover bridge" that fills the
   * gap using an invisible element. This makes listening for events such as `mouseenter` and `mouseleave` more sane
   * because the pointer never technically leaves the element. The hover bridge will only be drawn when the popover is
   * active.
   */
  @property({ attribute: 'hover-bridge', type: Boolean })
  public hoverBridge = false;

  // Upstream behavior: the first time any observed attribute changes, the values of all reflected properties that are
  // not null are recorded, and when one of them later becomes null (its attribute was removed) it is set back to the
  // recorded value.
  private hasRecordedInitialProperties = false;

  private readonly initialReflectedProperties = new Map<string, unknown>();

  public override attributeChangedCallback(name: string, previous: string | null, next: string | null) {
    if (!this.hasRecordedInitialProperties) {
      (this.constructor as typeof VelcroPopup).elementProperties.forEach((options, prop) => {
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

  public override async connectedCallback() {
    super.connectedCallback();

    // Start the positioner after the first update
    await this.updateComplete;
    this.start();
  }

  public override disconnectedCallback() {
    super.disconnectedCallback();
    this.stop();
  }

  protected override willUpdate(changed: PropertyValues<this>) {
    super.willUpdate(changed);
    this.initialReflectedProperties.forEach((value, prop) => {
      const self = this as unknown as Record<string, unknown>;
      if (changed.has(prop as keyof VelcroPopup) && self[prop] == null) {
        self[prop] = value;
      }
    });
  }

  protected override async updated(changedProps: PropertyValues<this>) {
    super.updated(changedProps);

    // Start or stop the positioner when active changes
    if (changedProps.has('active')) {
      if (this.active) {
        this.start();
      } else {
        this.stop();
      }
    }

    // Update the anchor when anchor changes
    if (changedProps.has('anchor')) {
      this.handleAnchorChange();
    }

    // All other properties will trigger a reposition when active
    if (this.active) {
      await this.updateComplete;
      this.reposition();
    }
  }

  private async handleAnchorChange() {
    await this.stop();

    if (this.anchor && typeof this.anchor === 'string') {
      // Locate the anchor by id
      const root = this.getRootNode() as Document | ShadowRoot;
      this.anchorEl = root.getElementById(this.anchor);
    } else if (this.anchor instanceof Element || isVirtualElement(this.anchor)) {
      // Use the anchor's reference
      this.anchorEl = this.anchor;
    } else {
      // Look for a slotted anchor
      this.anchorEl = this.querySelector<HTMLElement>('[slot="anchor"]');
    }

    // If the anchor is a <slot>, we'll use the first assigned element as the target since slots use `display: contents`
    // and positioning can't be calculated on them
    if (this.anchorEl instanceof HTMLSlotElement) {
      this.anchorEl = this.anchorEl.assignedElements({ flatten: true })[0] as HTMLElement;
    }

    // If the anchor is valid, start it up
    if (this.anchorEl && this.active) {
      this.start();
    }
  }

  // As in Shoelace, a start while already started replaces `cleanup` without tearing the earlier auto-update down.
  private start() {
    // We can't start the positioner without an anchor or when the popup is inactive
    if (!this.anchorEl || !this.active) {
      return;
    }

    this.cleanup = autoUpdate(this.anchorEl, this.popup, () => {
      this.reposition();
    });
  }

  private async stop(): Promise<void> {
    return new Promise(resolve => {
      if (this.cleanup) {
        this.cleanup();
        this.cleanup = undefined;
        this.removeAttribute('data-current-placement');
        this.style.removeProperty('--auto-size-available-width');
        this.style.removeProperty('--auto-size-available-height');
        requestAnimationFrame(() => resolve());
      } else {
        resolve();
      }
    });
  }

  /** Forces the popup to recalculate and reposition itself. */
  public reposition() {
    // Nothing to do if the popup is inactive or the anchor doesn't exist
    if (!this.active || !this.anchorEl) {
      return;
    }

    //
    // NOTE: Floating UI middlewares are order dependent: https://floating-ui.com/docs/middleware
    //
    const middleware = [
      // The offset middleware goes first
      offset({ mainAxis: this.distance, crossAxis: this.skidding }),
    ];

    // First we sync width/height
    if (this.sync) {
      middleware.push(
        size({
          apply: ({ rects }: { rects: { reference: { width: number; height: number } } }) => {
            const syncWidth = this.sync === 'width' || this.sync === 'both';
            const syncHeight = this.sync === 'height' || this.sync === 'both';
            this.popup.style.width = syncWidth ? `${rects.reference.width}px` : '';
            this.popup.style.height = syncHeight ? `${rects.reference.height}px` : '';
          },
        }),
      );
    } else {
      // Cleanup styles if we're not matching width/height
      this.popup.style.width = '';
      this.popup.style.height = '';
    }

    // Then we flip
    if (this.flip) {
      middleware.push(
        flip({
          boundary: this.flipBoundary,
          // The `flip-fallback-placements` attribute converts to an array; a property assignment stays as given.
          fallbackPlacements: this.flipFallbackPlacements,
          fallbackStrategy: this.flipFallbackStrategy === 'best-fit' ? 'bestFit' : 'initialPlacement',
          padding: this.flipPadding,
        }),
      );
    }

    // Then we shift
    if (this.shift) {
      middleware.push(
        shift({
          boundary: this.shiftBoundary,
          padding: this.shiftPadding,
        }),
      );
    }

    // Now we adjust the size as needed
    if (this.autoSize) {
      middleware.push(
        size({
          boundary: this.autoSizeBoundary,
          padding: this.autoSizePadding,
          apply: ({ availableWidth, availableHeight }: { availableWidth: number; availableHeight: number }) => {
            if (this.autoSize === 'vertical' || this.autoSize === 'both') {
              this.style.setProperty('--auto-size-available-height', `${availableHeight}px`);
            } else {
              this.style.removeProperty('--auto-size-available-height');
            }

            if (this.autoSize === 'horizontal' || this.autoSize === 'both') {
              this.style.setProperty('--auto-size-available-width', `${availableWidth}px`);
            } else {
              this.style.removeProperty('--auto-size-available-width');
            }
          },
        }),
      );
    } else {
      // Cleanup styles if we're no longer using auto-size
      this.style.removeProperty('--auto-size-available-width');
      this.style.removeProperty('--auto-size-available-height');
    }

    // Finally, we add an arrow
    if (this.arrow) {
      middleware.push(
        arrow({
          element: this.arrowEl,
          padding: this.arrowPadding,
        }),
      );
    }

    computePosition(this.anchorEl, this.popup, {
      placement: this.placement,
      middleware,
      strategy: this.strategy,
      arrowElement: this.arrow ? this.arrowEl : undefined,
    }).then(({ x, y, middlewareData, placement }) => {
      // Shoelace uses its localization utility for the direction: the host's `dir` property, else the document's, else
      // `ltr` (`localize.dir()` reads the attribute, which only differs when the property was set on its own).
      const isRtl = (this.dir || this.localize.dir()).toLowerCase() === 'rtl';
      const staticSide = ({ top: 'bottom', right: 'left', bottom: 'top', left: 'right' } as Record<string, string>)[
        placement.split('-')[0]
      ];

      this.setAttribute('data-current-placement', placement);

      Object.assign(this.popup.style, {
        left: `${x}px`,
        top: `${y}px`,
      });

      if (this.arrow) {
        const arrowX = middlewareData.arrow!.x;
        const arrowY = middlewareData.arrow!.y;
        let top = '';
        let right = '';
        let bottom = '';
        let left = '';

        if (this.arrowPlacement === 'start') {
          // Start
          const value = typeof arrowX === 'number' ? `calc(${this.arrowPadding}px - var(--arrow-padding-offset))` : '';
          top = typeof arrowY === 'number' ? `calc(${this.arrowPadding}px - var(--arrow-padding-offset))` : '';
          right = isRtl ? value : '';
          left = isRtl ? '' : value;
        } else if (this.arrowPlacement === 'end') {
          // End
          const value = typeof arrowX === 'number' ? `calc(${this.arrowPadding}px - var(--arrow-padding-offset))` : '';
          right = isRtl ? '' : value;
          left = isRtl ? value : '';
          bottom = typeof arrowY === 'number' ? `calc(${this.arrowPadding}px - var(--arrow-padding-offset))` : '';
        } else if (this.arrowPlacement === 'center') {
          // Center
          left = typeof arrowX === 'number' ? `calc(50% - var(--arrow-size-diagonal))` : '';
          top = typeof arrowY === 'number' ? `calc(50% - var(--arrow-size-diagonal))` : '';
        } else {
          // Anchor (default)
          left = typeof arrowX === 'number' ? `${arrowX}px` : '';
          top = typeof arrowY === 'number' ? `${arrowY}px` : '';
        }

        Object.assign(this.arrowEl.style, {
          top,
          right,
          bottom,
          left,
          [staticSide]: 'calc(var(--arrow-size-diagonal) * -1)',
        });
      }
    });

    // Wait until the new position is drawn before updating the hover bridge, otherwise it can get out of sync
    requestAnimationFrame(() => this.updateHoverBridge());

    // Upstream quirk: emitted when the reposition starts, before the new position is applied.
    this.emit('sl-reposition');
  }

  private updateHoverBridge() {
    if (this.hoverBridge && this.anchorEl) {
      const anchorRect = this.anchorEl.getBoundingClientRect();
      const popupRect = this.popup.getBoundingClientRect();
      const isVertical = this.placement.includes('top') || this.placement.includes('bottom');
      let topLeftX = 0;
      let topLeftY = 0;
      let topRightX = 0;
      let topRightY = 0;
      let bottomLeftX = 0;
      let bottomLeftY = 0;
      let bottomRightX = 0;
      let bottomRightY = 0;

      if (isVertical) {
        if (anchorRect.top < popupRect.top) {
          // Anchor is above
          topLeftX = anchorRect.left;
          topLeftY = anchorRect.bottom;
          topRightX = anchorRect.right;
          topRightY = anchorRect.bottom;

          bottomLeftX = popupRect.left;
          bottomLeftY = popupRect.top;
          bottomRightX = popupRect.right;
          bottomRightY = popupRect.top;
        } else {
          // Anchor is below
          topLeftX = popupRect.left;
          topLeftY = popupRect.bottom;
          topRightX = popupRect.right;
          topRightY = popupRect.bottom;

          bottomLeftX = anchorRect.left;
          bottomLeftY = anchorRect.top;
          bottomRightX = anchorRect.right;
          bottomRightY = anchorRect.top;
        }
      } else {
        if (anchorRect.left < popupRect.left) {
          // Anchor is on the left
          topLeftX = anchorRect.right;
          topLeftY = anchorRect.top;
          topRightX = popupRect.left;
          topRightY = popupRect.top;

          bottomLeftX = anchorRect.right;
          bottomLeftY = anchorRect.bottom;
          bottomRightX = popupRect.left;
          bottomRightY = popupRect.bottom;
        } else {
          // Anchor is on the right
          topLeftX = popupRect.right;
          topLeftY = popupRect.top;
          topRightX = anchorRect.left;
          topRightY = anchorRect.top;

          bottomLeftX = popupRect.right;
          bottomLeftY = popupRect.bottom;
          bottomRightX = anchorRect.left;
          bottomRightY = anchorRect.bottom;
        }
      }

      this.style.setProperty('--hover-bridge-top-left-x', `${topLeftX}px`);
      this.style.setProperty('--hover-bridge-top-left-y', `${topLeftY}px`);
      this.style.setProperty('--hover-bridge-top-right-x', `${topRightX}px`);
      this.style.setProperty('--hover-bridge-top-right-y', `${topRightY}px`);
      this.style.setProperty('--hover-bridge-bottom-left-x', `${bottomLeftX}px`);
      this.style.setProperty('--hover-bridge-bottom-left-y', `${bottomLeftY}px`);
      this.style.setProperty('--hover-bridge-bottom-right-x', `${bottomRightX}px`);
      this.style.setProperty('--hover-bridge-bottom-right-y', `${bottomRightY}px`);
    }
  }

  protected override render() {
    return html`
      <slot name="anchor" @slotchange=${this.handleAnchorChange}></slot>

      <span
        part="hover-bridge"
        class=${classMap({
          'popup-hover-bridge': true,
          'popup-hover-bridge--visible': this.hoverBridge && this.active,
        })}
      ></span>

      <div
        part="popup"
        class=${classMap({
          popup: true,
          'popup--active': this.active,
          'popup--fixed': this.strategy === 'fixed',
          'popup--has-arrow': this.arrow,
        })}
      >
        <slot></slot>
        ${this.arrow ? html`<div part="arrow" class="popup__arrow" role="presentation"></div>` : ''}
      </div>
    `;
  }
}

export default VelcroPopup;
