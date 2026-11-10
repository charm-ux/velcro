// Adapted from Shoelace v2.20.1 (src/components/image-comparer/image-comparer.component.ts, the `@watch` timing of
// src/internal/watch.ts and the dependency definition and the `dir` and `lang` declarations in
// src/internal/shoelace-element.ts), Copyright (c) 2020 A Beautiful Site, LLC, MIT License. See THIRD_PARTY_NOTICES.md.
// The API documentation wording, the rendered structure (a `base` element around the before and after containers and a
// divider with a `role="scrollbar"` handle), the pointer drag (through the shared internal `drag` helper), the keyboard
// handling and the `sl-change` event follow Shoelace. Velcro changes: built on the @charm-ux/core base element (core has
// no image comparer), and <sl-icon> is defined when an image comparer is constructed, through Velcro's registration
// helper (see `shoelaceDependencies`). Shoelace's behavior is matched exactly, including its quirks; each one is marked
// "Upstream quirk" below and listed on the docs page.
import { html, type PropertyValues } from 'lit';
import { property, query } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { styleMap } from 'lit/directives/style-map.js';
import { CharmElement } from '@charm-ux/core/dist/base/charm-element/charm-element.js';
import { drag } from '../../internal/drag.js';
import { documentDir } from '../../internal/localize.js';
import { clamp } from '../../internal/math.js';
import { LocalizeController } from '../../utilities/localize.js';
import { defineVelcroComponent, type VelcroComponentConstructor } from '../../utilities/registration.js';
import { VelcroIcon } from '../icon/class.js';
import styles from './image-comparer.styles.js';

// Built on the @charm-ux/core base element: @charm-ux/core has no image comparer to extend. The only core extension
// that remains is the non-bubbling `ready` event on first update.
/**
 * Compare visual differences between similar photos with a sliding panel. API modelled on Shoelace's
 * `sl-image-comparer`. Its default handle icon is an `<sl-icon>` from the `system` icon library, as in Shoelace;
 * constructing an image comparer defines its dependency `<sl-icon>` (Velcro's) when no element owns that tag yet, so the
 * class-only entry needs no extra step.
 *
 * Velcro extension inherited from the core base element and kept: the non-bubbling `ready` event, emitted on the first
 * update.
 *
 * @tag sl-image-comparer
 * @status prototype
 *
 * @dependency sl-icon
 *
 * @slot before - The before image, an `<img>` or `<svg>` element.
 * @slot after - The after image, an `<img>` or `<svg>` element.
 * @slot handle - The icon used inside the handle.
 *
 * @event sl-change - Emitted when the position changes.
 *
 * @csspart base - The component's base wrapper.
 * @csspart before - The container that wraps the before image.
 * @csspart after - The container that wraps the after image.
 * @csspart divider - The divider that separates the images.
 * @csspart handle - The handle that the user drags to expose the after image.
 *
 * @cssproperty --divider-width - The width of the dividing line.
 * @cssproperty --handle-size - The size of the compare handle.
 */
export class VelcroImageComparer extends CharmElement {
  public static override baseName = 'image-comparer';

  // Core's base styles are replaced by Shoelace's own (see the styles file).
  public static override styles = [styles];

  // The elements the template renders: the default handle icon. Shoelace 2.20.1 lists it as `static scopedElement`, a
  // field its base element never reads, so Shoelace's registering file alone leaves `<sl-icon>` undefined (it is defined
  // once anything else registers it, such as the full `shoelace.js` bundle); its manifest still documents the
  // dependency (`@dependency sl-icon`). Velcro defines it the way Shoelace defines `static dependencies`: on every
  // construction, through `defineVelcroComponent`, leaving a tag another constructor owns alone. Listed on the docs page
  // as a difference. Not part of the documented API.
  private static readonly shoelaceDependencies: readonly VelcroComponentConstructor[] = [VelcroIcon];

  public constructor() {
    super();
    for (const component of VelcroImageComparer.shoelaceDependencies) defineVelcroComponent(component);
  }

  // The localization controller re-renders the image comparer when the document's direction changes, which flips the
  // clipping, the divider's position and the keyboard and drag direction (see `direction()`).
  private readonly localize = new LocalizeController(this);

  private velcroDir?: string;

  // Shoelace's base element restores a reflected property's initial value when it becomes null or undefined (see
  // attributeChangedCallback). `position` is the only reflected property here.
  private readonly initialReflectedProperties = new Map<string, unknown>();

  private hasRecordedInitialProperties = false;

  // Shoelace's public `@query('.image-comparer')` field: the `base` element.
  @query('.image-comparer')
  public base!: HTMLElement;

  // Shoelace's public `@query('.image-comparer__handle')` field: the `handle` element.
  @query('.image-comparer__handle')
  public handle!: HTMLElement;

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

  // Upstream quirk: a position set by attribute or property is not clamped (only the keyboard and drag clamp), so 150
  // or -20 render as given, with a divider outside the image.
  /** The position of the divider as a percentage. */
  @property({ type: Number, reflect: true })
  public position = 50;

  // Records the reflected properties' values the first time any attribute changes (during upgrade, before the
  // attribute values are applied), so that a reflected property set to null or undefined later (by removing its
  // attribute or by assignment) gets that value back instead. Same timing and rule as Shoelace's base element.
  public override attributeChangedCallback(name: string, previous: string | null, next: string | null) {
    if (!this.hasRecordedInitialProperties) {
      (this.constructor as typeof VelcroImageComparer).elementProperties.forEach((options, prop) => {
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

  protected override willUpdate(changed: PropertyValues<this>) {
    super.willUpdate(changed);
    this.initialReflectedProperties.forEach((value, prop) => {
      const self = this as unknown as Record<string, unknown>;
      if (changed.has(prop as keyof VelcroImageComparer) && self[prop] == null) {
        self[prop] = value;
      }
    });
  }

  // Shoelace's controller resolves the direction from the host's `dir` property, else the document's snapshot (`<html
  // dir>`, else ltr), lower-cased. Velcro's shared controller reads the host's `dir` attribute instead, which would miss a
  // direction set only through the property; this component's `dir` returns what was set, by attribute or property, so
  // it resolves the direction the way Shoelace does.
  private direction() {
    return `${this.velcroDir || documentDir()}`.toLowerCase();
  }

  // Upstream quirks: the drag starts on `mousedown` and `touchstart` (not `pointerdown`), so the drag helper never
  // treats the starting event as a PointerEvent and the position only changes on the first `pointermove`; the
  // `preventDefault()` on that event keeps the handle from taking focus on a click; the width is measured once, when the
  // drag starts; and the drag listens for any button.
  private handleDrag(event: PointerEvent) {
    const { width } = this.base.getBoundingClientRect();
    const isRtl = this.direction() === 'rtl';

    event.preventDefault();

    drag(this.base, {
      onMove: x => {
        this.position = parseFloat(clamp((x / width) * 100, 0, 100).toFixed(2));
        if (isRtl) this.position = 100 - this.position;
      },
      initialEvent: event,
    });
  }

  // Upstream quirk: the keys are handled on the `base` element, so they also act while focus is on focusable content
  // slotted into the before or after slot; with `dir="auto"` the arrow keys do nothing (Home and End still work).
  private handleKeyDown(event: KeyboardEvent) {
    const isLtr = this.direction() === 'ltr';
    const isRtl = this.direction() === 'rtl';

    if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
      const incr = event.shiftKey ? 10 : 1;
      let newPosition = this.position;

      event.preventDefault();

      if ((isLtr && event.key === 'ArrowLeft') || (isRtl && event.key === 'ArrowRight')) {
        newPosition -= incr;
      }
      if ((isLtr && event.key === 'ArrowRight') || (isRtl && event.key === 'ArrowLeft')) {
        newPosition += incr;
      }
      if (event.key === 'Home') {
        newPosition = 0;
      }
      if (event.key === 'End') {
        newPosition = 100;
      }
      newPosition = clamp(newPosition, 0, 100);

      this.position = newPosition;
    }
  }

  // Shoelace's `@watch('position', { waitUntilFirstUpdate: true })` handler. Its `watch` decorator runs it in `update()`,
  // before the render, whenever `position` changed to a different value after the first update. Upstream quirk: so
  // `sl-change` is emitted for every change, including one made from script, and once per update (several changes
  // before one update emit one event).
  public handlePositionChange() {
    this.emit('sl-change');
  }

  protected override update(changed: PropertyValues<this>) {
    if (changed.has('position') && changed.get('position') !== this.position && this.hasUpdated) {
      this.handlePositionChange();
    }
    super.update(changed);
  }

  protected override render() {
    void this.localize;
    const isRtl = this.direction() === 'rtl';

    return html`
      <div
        part="base"
        id="image-comparer"
        class=${classMap({
          'image-comparer': true,
          'image-comparer--rtl': isRtl,
        })}
        @keydown=${this.handleKeyDown}
      >
        <div class="image-comparer__image">
          <div part="before" class="image-comparer__before">
            <slot name="before"></slot>
          </div>

          <div
            part="after"
            class="image-comparer__after"
            style=${styleMap({
              clipPath: isRtl ? `inset(0 0 0 ${100 - this.position}%)` : `inset(0 ${100 - this.position}% 0 0)`,
            })}
          >
            <slot name="after"></slot>
          </div>
        </div>

        <div
          part="divider"
          class="image-comparer__divider"
          style=${styleMap({
            left: isRtl ? `${100 - this.position}%` : `${this.position}%`,
          })}
          @mousedown=${this.handleDrag}
          @touchstart=${this.handleDrag}
        >
          <div
            part="handle"
            class="image-comparer__handle"
            role="scrollbar"
            aria-valuenow=${this.position}
            aria-valuemin="0"
            aria-valuemax="100"
            aria-controls="image-comparer"
            tabindex="0"
          >
            <slot name="handle">
              <sl-icon library="system" name="grip-vertical"></sl-icon>
            </slot>
          </div>
        </div>
      </div>
    `;
  }
}

export default VelcroImageComparer;
