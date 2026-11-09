// Adapted from Shoelace v2.20.1 (src/components/rating/rating.component.ts, the `@watch` timing of src/internal/watch.ts
// and the dependency definition and the `dir` and `lang` declarations in src/internal/shoelace-element.ts), Copyright (c)
// 2020 A Beautiful Site, LLC, MIT License. See THIRD_PARTY_NOTICES.md. The API documentation wording, the rendered
// structure (a `base` element with `role="slider"` around a row of symbols, with partial symbols clipped in two layers),
// the pointer, touch and keyboard handling, the `sl-change` and `sl-hover` events and the public `focus()` and `blur()`
// follow Shoelace. Velcro changes: built on the @charm-ux/core base element (core has no rating), and the dependency on
// <sl-icon> is defined when a rating is constructed through Velcro's registration helper rather than Shoelace's
// `static dependencies`. Shoelace's behavior is matched exactly, including its quirks; each one is marked "Upstream
// quirk" below and listed on the docs page.
import { html, type PropertyValues } from 'lit';
import { eventOptions, property, query, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { styleMap } from 'lit/directives/style-map.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { CharmElement } from '@charm-ux/core/dist/base/charm-element/charm-element.js';
import { documentDir } from '../../internal/localize.js';
import { clamp } from '../../internal/math.js';
import { LocalizeController } from '../../utilities/localize.js';
import { defineVelcroComponent, type VelcroComponentConstructor } from '../../utilities/registration.js';
import { VelcroIcon } from '../icon/class.js';
import styles from './rating.styles.js';

// Built on the @charm-ux/core base element: @charm-ux/core has no rating component to extend. The only core extension
// that remains is the non-bubbling `ready` event on first update.
/**
 * Ratings give users a way to quickly view and provide feedback. API modelled on Shoelace's `sl-rating`. Its default
 * symbol is an `<sl-icon>` from the `system` icon library, as in Shoelace; like Shoelace's, constructing a rating defines
 * its dependency `<sl-icon>` (Velcro's) when no element owns that tag yet, so the class-only entry needs no extra step.
 *
 * Velcro extension inherited from the core base element and kept: the non-bubbling `ready` event, emitted on the first
 * update.
 *
 * @tag sl-rating
 * @status prototype
 *
 * @dependency sl-icon
 *
 * @event sl-change - Emitted when the rating's value changes.
 * @event {{ phase: 'start' | 'move' | 'end', value: number }} sl-hover - Emitted when the user hovers over a value. The
 *  `phase` property indicates when hovering starts, moves to a new value, or ends. The `value` property tells what the
 *  rating's value would be if the user were to commit to the hovered value.
 *
 * @csspart base - The component's base wrapper.
 *
 * @cssproperty --symbol-color - The inactive color for symbols.
 * @cssproperty --symbol-color-active - The active color for symbols.
 * @cssproperty --symbol-size - The size of symbols.
 * @cssproperty --symbol-spacing - The spacing to use around symbols.
 */
export class VelcroRating extends CharmElement {
  public static override baseName = 'rating';

  // Core's base styles are replaced by Shoelace's own (see the styles file).
  public static override styles = [styles];

  // Shoelace's `static dependencies` for the rating: the elements its template renders. Shoelace keys them by tag; here
  // the tag is derived from each class's `baseName` (`sl-icon` for `VelcroIcon`), the same tag `defineVelcroComponent`
  // defines and the default symbol renders. As in Shoelace's base element, each one that is not defined yet is defined
  // when a rating is constructed, and a tag that another constructor already owns is left alone (with Shoelace's warning
  // when the versions differ). If the platform refuses the class itself (for example because it is already registered
  // under another tag), an anonymous subclass is defined instead, as Shoelace does. Core's own array-typed
  // `dependencies` (registration in core's scope) stays empty. Not part of the documented API (Shoelace's manifest lists
  // `dependencies` without a description).
  private static readonly shoelaceDependencies: readonly VelcroComponentConstructor[] = [VelcroIcon];

  public constructor() {
    super();
    for (const component of VelcroRating.shoelaceDependencies) defineVelcroComponent(component);
  }

  // The localization controller re-renders the rating when the document's direction changes, which flips the partial
  // symbols' clipping and the keyboard and pointer direction (see `direction()`).
  private readonly localize = new LocalizeController(this);

  private velcroDir?: string;

  // Shoelace's public `@query('.rating')` field: the `base` element.
  @query('.rating')
  public rating!: HTMLElement;

  @state() private hoverValue = 0;
  @state() private isHovering = false;

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

  /** A label that describes the rating to assistive devices. */
  @property()
  public label = '';

  // Upstream quirk: `value`, `max` and `precision` are not reflected and not restored when their attribute is removed
  // (Shoelace restores reflected properties only), so removing the attribute sets them to null.
  /** The current rating. */
  @property({ type: Number })
  public value = 0;

  /** The highest rating to show. */
  @property({ type: Number })
  public max = 5;

  /**
   * The precision at which the rating will increase and decrease. For example, to allow half-star ratings, set this
   * attribute to `0.5`.
   */
  @property({ type: Number })
  public precision = 1;

  // `readonly` and `disabled` are the only reflected properties. Shoelace's base element restores a reflected property's
  // initial value when its attribute is removed; for these two booleans the attribute converter already yields that
  // value (false), so no restore step is needed.
  /** Makes the rating readonly. */
  @property({ type: Boolean, reflect: true })
  public readonly = false;

  /** Disables the rating. */
  @property({ type: Boolean, reflect: true })
  public disabled = false;

  // Upstream quirk: declared as a plain `@property()`, so it also observes a `getsymbol` attribute, which would replace
  // the function with a string (and rendering then throws), exactly as in Shoelace.
  /**
   * A function that customizes the symbol to be rendered. The first and only argument is the rating's current value.
   * The function should return a string containing trusted HTML of the symbol to render at the specified value. Works
   * well with `<sl-icon>` elements.
   */
  @property()
  public getSymbol: (value: number) => string = () => '<sl-icon name="star-fill" library="system"></sl-icon>';

  // Shoelace's controller resolves the direction from the host's `dir` property, else the document's snapshot (`<html
  // dir>`, else ltr), lower-cased. Velcro's shared controller reads the host's `dir` attribute instead, which would miss a
  // direction set only through the property; this component's `dir` returns what was set, by attribute or property, so
  // it resolves the direction the way Shoelace does.
  private direction() {
    return `${this.velcroDir || documentDir()}`.toLowerCase();
  }

  private getValueFromMousePosition(event: MouseEvent) {
    return this.getValueFromXCoordinate(event.clientX);
  }

  private getValueFromTouchPosition(event: TouchEvent) {
    return this.getValueFromXCoordinate(event.touches[0].clientX);
  }

  private getValueFromXCoordinate(coordinate: number) {
    const isRtl = this.direction() === 'rtl';
    const { left, right, width } = this.rating.getBoundingClientRect();
    const value = isRtl
      ? this.roundToPrecision(((right - coordinate) / width) * this.max, this.precision)
      : this.roundToPrecision(((coordinate - left) / width) * this.max, this.precision);

    return clamp(value, 0, this.max);
  }

  // Upstream quirk: a click on a readonly rating leaves the value alone but still emits `sl-change`.
  private handleClick(event: MouseEvent) {
    if (this.disabled) {
      return;
    }

    this.setValue(this.getValueFromMousePosition(event));
    this.emit('sl-change');
  }

  private setValue(newValue: number) {
    if (this.disabled || this.readonly) {
      return;
    }

    this.value = newValue === this.value ? 0 : newValue;
    this.isHovering = false;
  }

  private handleKeyDown(event: KeyboardEvent) {
    const isLtr = this.direction() === 'ltr';
    const isRtl = this.direction() === 'rtl';
    const oldValue = this.value;

    if (this.disabled || this.readonly) {
      return;
    }

    if (event.key === 'ArrowDown' || (isLtr && event.key === 'ArrowLeft') || (isRtl && event.key === 'ArrowRight')) {
      const decrement = event.shiftKey ? 1 : this.precision;
      this.value = Math.max(0, this.value - decrement);
      event.preventDefault();
    }

    if (event.key === 'ArrowUp' || (isLtr && event.key === 'ArrowRight') || (isRtl && event.key === 'ArrowLeft')) {
      const increment = event.shiftKey ? 1 : this.precision;
      this.value = Math.min(this.max, this.value + increment);
      event.preventDefault();
    }

    if (event.key === 'Home') {
      this.value = 0;
      event.preventDefault();
    }

    if (event.key === 'End') {
      this.value = this.max;
      event.preventDefault();
    }

    if (this.value !== oldValue) {
      this.emit('sl-change');
    }
  }

  // Upstream quirk: hovering also runs on a disabled or readonly rating, so `sl-hover` is emitted there too (the
  // displayed value stays the rating's own).
  private handleMouseEnter(event: MouseEvent) {
    this.isHovering = true;
    this.hoverValue = this.getValueFromMousePosition(event);
  }

  private handleMouseMove(event: MouseEvent) {
    this.hoverValue = this.getValueFromMousePosition(event);
  }

  private handleMouseLeave() {
    this.isHovering = false;
  }

  private handleTouchStart(event: TouchEvent) {
    this.isHovering = true;
    this.hoverValue = this.getValueFromTouchPosition(event);

    // Prevent scrolling when touch is initiated
    event.preventDefault();
  }

  @eventOptions({ passive: true })
  private handleTouchMove(event: TouchEvent) {
    this.hoverValue = this.getValueFromTouchPosition(event);
  }

  // Upstream quirk: the end of a touch emits `sl-change` even when the rating is disabled or readonly.
  private handleTouchEnd(event: TouchEvent) {
    this.isHovering = false;
    this.setValue(this.hoverValue);
    this.emit('sl-change');

    // Prevent click on mobile devices
    event.preventDefault();
  }

  private roundToPrecision(numberToRound: number, precision = 0.5) {
    const multiplier = 1 / precision;
    return Math.ceil(numberToRound * multiplier) / multiplier;
  }

  // Shoelace's two `@watch` handlers. Its `watch` decorator runs a handler in `update()`, before the render, whenever the
  // watched property changed to a different value, including in the first update. Upstream quirk: so connecting a
  // rating emits `sl-hover` twice (phase `end`, then `move`, both with value 0) without any pointer.
  public handleHoverValueChange() {
    this.emit('sl-hover', {
      detail: {
        phase: 'move',
        value: this.hoverValue,
      },
    });
  }

  public handleIsHoveringChange() {
    this.emit('sl-hover', {
      detail: {
        phase: this.isHovering ? 'start' : 'end',
        value: this.hoverValue,
      },
    });
  }

  // The decorators are applied in declaration order, each wrapping the previous `update`, so Shoelace runs the
  // `isHovering` handler (declared last, outermost) before the `hoverValue` one; the same order is kept here.
  protected override update(changed: PropertyValues<this>) {
    const differs = (key: 'isHovering' | 'hoverValue') =>
      changed.has(key as keyof VelcroRating) && changed.get(key as keyof VelcroRating) !== this[key];
    if (differs('isHovering')) this.handleIsHoveringChange();
    if (differs('hoverValue')) this.handleHoverValueChange();
    super.update(changed);
  }

  /** Sets focus on the rating. */
  public override focus(options?: FocusOptions) {
    this.rating.focus(options);
  }

  /** Removes focus from the rating. */
  public override blur() {
    this.rating.blur();
  }

  protected override render() {
    void this.localize;
    const isRtl = this.direction() === 'rtl';
    const counter = Array.from(Array(this.max).keys());
    let displayValue = 0;

    if (this.disabled || this.readonly) {
      displayValue = this.value;
    } else {
      displayValue = this.isHovering ? this.hoverValue : this.value;
    }

    return html`
      <div
        part="base"
        class=${classMap({
          rating: true,
          'rating--readonly': this.readonly,
          'rating--disabled': this.disabled,
          'rating--rtl': isRtl,
        })}
        role="slider"
        aria-label=${this.label}
        aria-disabled=${this.disabled ? 'true' : 'false'}
        aria-readonly=${this.readonly ? 'true' : 'false'}
        aria-valuenow=${this.value}
        aria-valuemin=${0}
        aria-valuemax=${this.max}
        tabindex=${this.disabled || this.readonly ? '-1' : '0'}
        @click=${this.handleClick}
        @keydown=${this.handleKeyDown}
        @mouseenter=${this.handleMouseEnter}
        @touchstart=${this.handleTouchStart}
        @mouseleave=${this.handleMouseLeave}
        @touchend=${this.handleTouchEnd}
        @mousemove=${this.handleMouseMove}
        @touchmove=${this.handleTouchMove}
      >
        <span class="rating__symbols">
          ${counter.map(index => {
            if (displayValue > index && displayValue < index + 1) {
              // Users can click the current value to clear the rating. When this happens, we set this.isHovering to
              // false to prevent the hover state from confusing them as they move the mouse out of the control. This
              // extra mouseenter will reinstate it if they happen to mouse over an adjacent symbol.
              return html`
                <span
                  class=${classMap({
                    rating__symbol: true,
                    'rating__partial-symbol-container': true,
                    'rating__symbol--hover': this.isHovering && Math.ceil(displayValue) === index + 1,
                  })}
                  role="presentation"
                >
                  <div
                    style=${styleMap({
                      clipPath: isRtl
                        ? `inset(0 ${(displayValue - index) * 100}% 0 0)`
                        : `inset(0 0 0 ${(displayValue - index) * 100}%)`,
                    })}
                  >
                    ${unsafeHTML(this.getSymbol(index + 1))}
                  </div>
                  <div
                    class="rating__partial--filled"
                    style=${styleMap({
                      clipPath: isRtl
                        ? `inset(0 0 0 ${100 - (displayValue - index) * 100}%)`
                        : `inset(0 ${100 - (displayValue - index) * 100}% 0 0)`,
                    })}
                  >
                    ${unsafeHTML(this.getSymbol(index + 1))}
                  </div>
                </span>
              `;
            }

            return html`
              <span
                class=${classMap({
                  rating__symbol: true,
                  'rating__symbol--hover': this.isHovering && Math.ceil(displayValue) === index + 1,
                  'rating__symbol--active': displayValue >= index + 1,
                })}
                role="presentation"
              >
                ${unsafeHTML(this.getSymbol(index + 1))}
              </span>
            `;
          })}
        </span>
      </div>
    `;
  }
}

export default VelcroRating;
