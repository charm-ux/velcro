// Portions of the API documentation wording and the behavior in this file (the position, snapping, resizing, keyboard and
// drag logic, and the rendered structure) are adapted from Shoelace v2.20.1
// (src/components/split-panel/split-panel.component.ts), Copyright (c) 2020 A Beautiful Site, LLC, MIT License.
// See THIRD_PARTY_NOTICES.md. No Shoelace source file or runtime is included. Upstream behavior is matched on purpose,
// including its quirks (listed on the docs page); only the base element differs (core's, with its extras).
import { html, type PropertyValues } from 'lit';
import { property, query } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { CharmElement } from '@charm-ux/core/dist/base/charm-element/charm-element.js';
import { ShoelaceCompat, restoreReflectedProperties } from '../../internal/shoelace-compat.js';
import { drag } from '../../internal/drag.js';
import { LocalizeController } from '../../utilities/localize.js';
import { clamp } from '../../internal/math.js';
import styles from './split-panel.styles.js';

export interface SnapFunctionParams {
  /** The position the divider has been dragged to, in pixels. */
  pos: number;
  /** The size of the split-panel across its primary axis, in pixels. */
  size: number;
  /** The snap-threshold passed to the split-panel, in pixels. May be infinity. */
  snapThreshold: number;
  /** Whether or not the user-agent is RTL. */
  isRtl: boolean;
  /** Whether or not the split panel is vertical. */
  vertical: boolean;
}

/** Used by sl-split-panel to convert an input position into a snapped position. */
export type SnapFunction = (opt: SnapFunctionParams) => number | null;

/** A SnapFunction which performs no snapping. */
export const SNAP_NONE = () => null;

/**
 * Split panels display two adjacent panels, allowing the user to reposition them.
 * API modelled on Shoelace's `sl-split-panel`. There is no core counterpart, so it extends the core base element.
 *
 * @property {string} lang
 *
 * @tag sl-split-panel
 * @status prototype
 *
 * @event sl-reposition - Emitted when the divider's position changes.
 *
 * @slot start - Content to place in the start panel.
 * @slot end - Content to place in the end panel.
 * @slot divider - The divider. Useful for slotting in a custom icon that renders as a handle.
 *
 * @csspart start - The start panel.
 * @csspart end - The end panel.
 * @csspart panel - Targets both the start and end panels.
 * @csspart divider - The divider that separates the start and end panels.
 *
 * @cssproperty [--divider-width=4px] - The width of the visible divider.
 * @cssproperty [--divider-hit-area=12px] - The invisible region around the divider where dragging can occur. This is
 *  usually wider than the divider to facilitate easier dragging.
 * @cssproperty [--min=0] - The minimum allowed size of the primary panel.
 * @cssproperty [--max=100%] - The maximum allowed size of the primary panel.
 */
export class VelcroSplitPanel extends ShoelaceCompat(CharmElement, { lang: true, reflected: 'read-all' }) {
  public static override baseName = 'split-panel';

  // Core's base styles are replaced by Shoelace's own (see the styles file): they would hide the host with the `hidden`
  // attribute, add a focus outline offset to the divider part and force border-box on the shadow descendants.
  public static override styles = [styles];

  private cachedPositionInPixels!: number;
  private isCollapsed = false;
  private readonly localize = new LocalizeController(this);
  private positionBeforeCollapsing = 0;
  private resizeObserver!: ResizeObserver;
  private size!: number;

  @query('.divider')
  public divider!: HTMLElement;

  /**
   * The current position of the divider from the primary panel's edge as a percentage 0-100. Defaults to 50% of the
   * container's initial size.
   */
  @property({ type: Number, reflect: true })
  public position = 50;

  /** The current position of the divider from the primary panel's edge in pixels. */
  @property({ attribute: 'position-in-pixels', type: Number })
  public positionInPixels!: number;

  /** Draws the split panel in a vertical orientation with the start and end panels stacked. */
  @property({ type: Boolean, reflect: true })
  public vertical = false;

  /** Disables resizing. Note that the position may still change as a result of resizing the host element. */
  @property({ type: Boolean, reflect: true })
  public disabled = false;

  /**
   * If no primary panel is designated, both panels will resize proportionally when the host element is resized. If a
   * primary panel is designated, it will maintain its size and the other panel will grow or shrink as needed when the
   * host element is resized.
   */
  @property()
  public primary?: 'start' | 'end';

  // Returned when the property is queried, so that string 'snap's are preserved.
  private snapValue: string | SnapFunction = '';
  // Actually used for computing snap points. All string snaps are converted via `toSnapFunction`.
  private snapFunction: SnapFunction = SNAP_NONE;

  /**
   * Converts a string containing either a series of fixed/repeated snap points (e.g. "repeat(20%)", "100px 200px 800px", or "10% 50% repeat(10px)") into a SnapFunction. `SnapFunction`s take in a `SnapFunctionOpts` and return the position that the split panel should snap to.
   *
   * @param snap - The snap string.
   * @returns a `SnapFunction` representing the snap string's logic.
   */
  private toSnapFunction(snap: string): SnapFunction {
    const snapPoints = snap.split(' ');

    return ({ pos, size, snapThreshold, isRtl, vertical }) => {
      let newPos = pos;
      let minDistance = Number.POSITIVE_INFINITY;

      snapPoints.forEach(value => {
        let snapPoint: number;

        if (value.startsWith('repeat(')) {
          // Upstream quirk, kept: the repeat value is cut from the WHOLE snap string, not from this snap point.
          const repeatVal = snap.substring('repeat('.length, snap.length - 1);
          const isPercent = repeatVal.endsWith('%');
          const repeatNum = Number.parseFloat(repeatVal);
          const snapIntervalPx = isPercent ? size * (repeatNum / 100) : repeatNum;
          snapPoint = Math.round((isRtl && !vertical ? size - pos : pos) / snapIntervalPx) * snapIntervalPx;
        } else if (value.endsWith('%')) {
          snapPoint = size * (Number.parseFloat(value) / 100);
        } else {
          snapPoint = Number.parseFloat(value);
        }

        if (isRtl && !vertical) {
          snapPoint = size - snapPoint;
        }

        const distance = Math.abs(pos - snapPoint);

        if (distance <= snapThreshold && distance < minDistance) {
          newPos = snapPoint;
          minDistance = distance;
        }
      });

      return newPos;
    };
  }

  /**
   * Either one or more space-separated values at which the divider should snap, in pixels, percentages, or repeat expressions e.g. `'100px 50% 500px' or `repeat(50%) 10px`,
   * or a function which takes in a `SnapFunctionParams`, and returns a position to snap to, e.g. `({ pos }) => Math.round(pos / 8) * 8`.
   */
  @property({ reflect: true })
  public set snap(snap: string | SnapFunction | null | undefined) {
    this.snapValue = snap ?? '';
    if (snap) {
      this.snapFunction = typeof snap === 'string' ? this.toSnapFunction(snap) : snap;
    } else {
      this.snapFunction = SNAP_NONE;
    }
  }

  public get snap(): string | SnapFunction {
    return this.snapValue;
  }

  /** How close the divider must be to a snap point until snapping occurs. */
  @property({ attribute: 'snap-threshold', type: Number })
  public snapThreshold = 12;

  public override connectedCallback() {
    super.connectedCallback();
    this.resizeObserver = new ResizeObserver(entries => this.handleResize(entries));
    this.updateComplete.then(() => this.resizeObserver.observe(this));

    this.detectSize();
    this.cachedPositionInPixels = this.percentageToPixels(this.position);
  }

  public override disconnectedCallback() {
    super.disconnectedCallback();
    this.resizeObserver?.unobserve(this);
  }

  protected override willUpdate(changed: PropertyValues<this>) {
    super.willUpdate(changed);
    restoreReflectedProperties(this, changed);
  }

  // Shoelace's `@watch('position')`, `@watch('positionInPixels')` and `@watch('vertical')` handlers run before render, and
  // only when the value really changed. Its decorators wrap `update()` one over the other, so the LAST declared watcher
  // runs first: vertical, then positionInPixels, then position. That order is kept here (positionInPixels sets position,
  // which the position watcher then sees in the same update).
  protected override update(changed: PropertyValues<this>) {
    const changedFrom = (name: 'vertical' | 'positionInPixels' | 'position') =>
      changed.has(name) && (changed as Map<PropertyKey, unknown>).get(name) !== this[name];
    if (changedFrom('vertical')) this.handleVerticalChange();
    if (changedFrom('positionInPixels')) this.handlePositionInPixelsChange();
    if (changedFrom('position')) this.handlePositionChange();
    super.update(changed);
  }

  private detectSize() {
    const { width, height } = this.getBoundingClientRect();
    this.size = this.vertical ? height : width;
  }

  private percentageToPixels(value: number) {
    return this.size * (value / 100);
  }

  private pixelsToPercentage(value: number) {
    return (value / this.size) * 100;
  }

  private handleDrag(event: PointerEvent) {
    const isRtl = this.localize.dir() === 'rtl';

    if (this.disabled) {
      return;
    }

    // Prevent text selection when dragging
    if (event.cancelable) {
      event.preventDefault();
    }

    drag(this, {
      onMove: (x, y) => {
        let newPositionInPixels = this.vertical ? y : x;

        // Flip for end panels
        if (this.primary === 'end') {
          newPositionInPixels = this.size - newPositionInPixels;
        }

        // Check snap points
        newPositionInPixels =
          this.snapFunction({
            pos: newPositionInPixels,
            size: this.size,
            snapThreshold: this.snapThreshold,
            isRtl: isRtl,
            vertical: this.vertical,
          }) ?? newPositionInPixels;

        this.position = clamp(this.pixelsToPercentage(newPositionInPixels), 0, 100);
      },
      initialEvent: event,
    });
  }

  private handleKeyDown(event: KeyboardEvent) {
    if (this.disabled) {
      return;
    }

    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'Enter'].includes(event.key)) {
      let newPosition = this.position;
      const incr = (event.shiftKey ? 10 : 1) * (this.primary === 'end' ? -1 : 1);

      event.preventDefault();

      if ((event.key === 'ArrowLeft' && !this.vertical) || (event.key === 'ArrowUp' && this.vertical)) {
        newPosition -= incr;
      }

      if ((event.key === 'ArrowRight' && !this.vertical) || (event.key === 'ArrowDown' && this.vertical)) {
        newPosition += incr;
      }

      if (event.key === 'Home') {
        newPosition = this.primary === 'end' ? 100 : 0;
      }

      if (event.key === 'End') {
        newPosition = this.primary === 'end' ? 0 : 100;
      }

      // Collapse/expand the primary panel when enter is pressed
      if (event.key === 'Enter') {
        if (this.isCollapsed) {
          newPosition = this.positionBeforeCollapsing;
          this.isCollapsed = false;
        } else {
          const positionBeforeCollapsing = this.position;

          newPosition = 0;

          // Wait for position to update before setting the collapsed state
          requestAnimationFrame(() => {
            this.isCollapsed = true;
            this.positionBeforeCollapsing = positionBeforeCollapsing;
          });
        }
      }

      this.position = clamp(newPosition, 0, 100);
    }
  }

  private handleResize(entries: ResizeObserverEntry[]) {
    const { width, height } = entries[0].contentRect;
    this.size = this.vertical ? height : width;

    // There's some weird logic that gets `this.cachedPositionInPixels = NaN` or `this.position === Infinity` when
    // a split-panel goes from `display: none;` to showing.
    if (isNaN(this.cachedPositionInPixels) || this.position === Infinity) {
      this.cachedPositionInPixels = Number(this.getAttribute('position-in-pixels'));
      this.positionInPixels = Number(this.getAttribute('position-in-pixels'));
      this.position = this.pixelsToPercentage(this.positionInPixels);
    }

    // Resize when a primary panel is set
    if (this.primary) {
      this.position = this.pixelsToPercentage(this.cachedPositionInPixels);
    }
  }

  public handlePositionChange() {
    this.cachedPositionInPixels = this.percentageToPixels(this.position);
    this.isCollapsed = false;
    this.positionBeforeCollapsing = 0;
    this.positionInPixels = this.percentageToPixels(this.position);
    this.emit('sl-reposition');
  }

  public handlePositionInPixelsChange() {
    this.position = this.pixelsToPercentage(this.positionInPixels);
  }

  public handleVerticalChange() {
    this.detectSize();
  }

  protected override render() {
    const gridTemplate = this.vertical ? 'gridTemplateRows' : 'gridTemplateColumns';
    const gridTemplateAlt = this.vertical ? 'gridTemplateColumns' : 'gridTemplateRows';
    const isRtl = this.localize.dir() === 'rtl';
    const primary = `
      clamp(
        0%,
        clamp(
          var(--min),
          ${this.position}% - var(--divider-width) / 2,
          var(--max)
        ),
        calc(100% - var(--divider-width))
      )
    `;
    const secondary = 'auto';

    if (this.primary === 'end') {
      if (isRtl && !this.vertical) {
        this.style[gridTemplate] = `${primary} var(--divider-width) ${secondary}`;
      } else {
        this.style[gridTemplate] = `${secondary} var(--divider-width) ${primary}`;
      }
    } else {
      if (isRtl && !this.vertical) {
        this.style[gridTemplate] = `${secondary} var(--divider-width) ${primary}`;
      } else {
        this.style[gridTemplate] = `${primary} var(--divider-width) ${secondary}`;
      }
    }

    // Unset the alt grid template property
    this.style[gridTemplateAlt] = '';

    return html`
      <slot name="start" part="panel start" class="start"></slot>

      <div
        part="divider"
        class="divider"
        tabindex=${ifDefined(this.disabled ? undefined : '0')}
        role="separator"
        aria-valuenow=${this.position}
        aria-valuemin="0"
        aria-valuemax="100"
        aria-label=${this.localize.term('resize')}
        @keydown=${this.handleKeyDown}
        @mousedown=${this.handleDrag}
        @touchstart=${this.handleDrag}
      >
        <slot name="divider"></slot>
      </div>

      <slot name="end" part="panel end" class="end"></slot>
    `;
  }
}

export default VelcroSplitPanel;
