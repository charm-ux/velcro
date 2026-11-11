// Adapted from Shoelace v2.20.1 (src/components/details/details.component.ts, the `watch` decorator in
// src/internal/watch.ts and the reflected-property restore and dependency definition in src/internal/shoelace-element.ts),
// Copyright (c) 2020 A Beautiful Site, LLC, MIT License. See THIRD_PARTY_NOTICES.md. The API documentation wording, the
// rendered structure (a native <details> with a <summary> header and a body region), the open and disabled handling, the
// keyboard handling, the show and hide animations and the `sl-show` / `sl-after-show` / `sl-hide` / `sl-after-hide` events
// follow Shoelace. Velcro changes: built on the @charm-ux/core base element (core's accordion item is not used, see the
// class comment), the `@watch` handler runs from `update()`, and the dependency on <sl-icon> is defined when a details is
// constructed through Velcro's registration helper rather than Shoelace's `static dependencies`. Shoelace's behavior is
// matched exactly, including its quirks; each one is marked "Upstream quirk" below and listed on the docs page.
import { html, type PropertyValues } from 'lit';
import { property, query } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { CharmElement } from '@charm-ux/core/dist/base/charm-element/charm-element.js';
import { ShoelaceCompat, restoreReflectedProperties } from '../../internal/shoelace-compat.js';
import { animateTo, shimKeyframesHeightAuto, stopAnimations } from '../../internal/animate.js';
import { waitForEvent } from '../../internal/event.js';
import { documentDir } from '../../internal/localize.js';
import { getAnimation, setDefaultAnimation } from '../../utilities/animation-registry.js';
import { LocalizeController } from '../../utilities/localize.js';
import { defineVelcroComponent, type VelcroComponentConstructor } from '../../utilities/registration.js';
import { VelcroIcon } from '../icon/class.js';
import styles from './details.styles.js';

/**
 * Details show a brief summary and expand to show additional content.
 *
 * Built on the @charm-ux/core base element. Core's accordion item is not extended: its model differs from Shoelace's (a
 * `heading` attribute and slot instead of `summary`, `heading-level` and `expand-icon-position` properties, `accordion-item-*`
 * parts and an `accordion-item-open-change` event, an `open` property driven by the native `toggle` event instead of
 * cancelable `sl-show` / `sl-hide` events, and CSS transitions set through `--accordion-item-*` properties instead of
 * the animation registry's awaited animations). The only core extension is the non-bubbling `ready` event on first
 * update.
 *
 * It renders an `<sl-icon>` for the default expand and collapse icons, as Shoelace does; like Shoelace's, constructing a
 * details defines that dependency (Velcro's) when no element owns its tag yet. The expand and collapse animations come from
 * the animation registry (`details.show` and `details.hide`); change them with `setAnimation()` or `setDefaultAnimation()`
 * from `@charm-ux/velcro/utilities/animation-registry`.
 *
 * @property {string} lang - The element's language, as set by the `lang` attribute or property. Not reflected.
 *
 * @tag sl-details
 * @status prototype
 *
 * @dependency sl-icon
 *
 * @slot - The details' main content.
 * @slot summary - The details' summary. Alternatively, you can use the `summary` attribute.
 * @slot expand-icon - Optional expand icon to use instead of the default. Works best with `<sl-icon>`.
 * @slot collapse-icon - Optional collapse icon to use instead of the default. Works best with `<sl-icon>`.
 *
 * @event sl-show - Emitted when the details opens.
 * @event sl-after-show - Emitted after the details opens and all animations are complete.
 * @event sl-hide - Emitted when the details closes.
 * @event sl-after-hide - Emitted after the details closes and all animations are complete.
 *
 * @csspart base - The component's base wrapper.
 * @csspart header - The header that wraps both the summary and the expand/collapse icon.
 * @csspart summary - The container that wraps the summary.
 * @csspart summary-icon - The container that wraps the expand/collapse icons.
 * @csspart content - The details content.
 *
 * @animation details.show - The animation to use when showing details. You can use `height: auto` with this animation.
 * @animation details.hide - The animation to use when hiding details. You can use `height: auto` with this animation.
 */
export class VelcroDetails extends ShoelaceCompat(CharmElement, { lang: true, dir: true, reflected: true }) {
  public static override baseName = 'details';

  // Core's base styles are replaced by Shoelace's own (see the styles file).
  public static override styles = [styles];

  // Shoelace's `static dependencies` for the details: the elements its template renders. Shoelace keys them by tag; here
  // the tag is derived from each class's `baseName` (`sl-icon` for `VelcroIcon`), the same tag `defineVelcroComponent`
  // defines and the template renders. As in Shoelace's base element, each one that is not defined yet is defined when a
  // details is constructed, and a tag that another constructor already owns is left alone (with Shoelace's warning
  // when the versions differ). If the platform refuses the class itself (for example because it is already registered
  // under another tag), an anonymous subclass is defined instead, as Shoelace does. Core's own array-typed
  // `dependencies` (registration in core's scope) stays empty. Not part of the documented API (Shoelace's manifest lists
  // `dependencies` without a description).
  private static readonly shoelaceDependencies: readonly VelcroComponentConstructor[] = [VelcroIcon];

  public constructor() {
    super();
    for (const component of VelcroDetails.shoelaceDependencies) defineVelcroComponent(component);
  }

  // As in Shoelace: the controller re-renders the details when the document's language or direction changes. The
  // direction itself is resolved by direction(), as Shoelace's controller resolves it.
  private readonly localize = new LocalizeController(this);

  // Shoelace's public `@query('.details')` field: the native <details> element.
  @query('.details')
  public details!: HTMLDetailsElement;

  // Shoelace's public `@query('.details__header')` field: the <summary> header.
  @query('.details__header')
  public header!: HTMLElement;

  // Shoelace's public `@query('.details__body')` field: the body region that is animated.
  @query('.details__body')
  public body!: HTMLElement;

  // Shoelace's public `@query('.details__expand-icon-slot')` field. Upstream quirk: nothing in the template has that
  // class (the slots are `expand-icon` and `collapse-icon`), so this is always null.
  @query('.details__expand-icon-slot')
  public expandIconSlot!: HTMLSlotElement;

  // Shoelace's public `detailsObserver` field: watches the inner <details> element's `open` attribute.
  public detailsObserver!: MutationObserver;

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
   * Indicates whether or not the details is open. You can toggle this attribute to show and hide the details, or you
   * can use the `show()` and `hide()` methods and this attribute will reflect the details' open state.
   */
  @property({ type: Boolean, reflect: true })
  public open = false;

  /** The summary to show in the header. If you need to display HTML, use the `summary` slot instead. */
  @property()
  public summary!: string;

  /** Disables the details so it can't be toggled. */
  @property({ type: Boolean, reflect: true })
  public disabled = false;

  protected override willUpdate(changed: PropertyValues<this>) {
    super.willUpdate(changed);
    restoreReflectedProperties(this, changed);
  }

  // Shoelace's `@watch('open', { waitUntilFirstUpdate: true })`: it runs before the render, from the second update on.
  // Because it runs inside `update()`, setting `open` back (when `sl-show` or `sl-hide` is canceled) does not start
  // another update, as upstream.
  protected override update(changed: PropertyValues<this>) {
    if (this.hasUpdated && changed.has('open') && changed.get('open') !== this.open) {
      void this.handleOpenChange();
    }

    super.update(changed);
  }

  // The direction the render and the animations use, as Shoelace's localization controller resolves it: the host's `dir`
  // property (set directly or through the attribute), else the controller's document-direction snapshot (`<html dir>` as
  // of the last observer callback or translation registration, not a live read; else `ltr`), lower-cased. Velcro's shared
  // controller reads the host's `dir` attribute instead (core's `dir` getter returns the computed direction), which would
  // miss a direction set only through the property; this component's `dir` returns what was set, by attribute or property.
  private direction() {
    return `${super.dir || documentDir()}`.toLowerCase();
  }

  public override firstUpdated() {
    // Velcro extension (core): the base element's non-bubbling `ready` event.
    super.firstUpdated();

    this.body.style.height = this.open ? 'auto' : '0';
    if (this.open) {
      this.details.open = true;
    }

    this.detailsObserver = new MutationObserver(changes => {
      for (const change of changes) {
        if (change.type === 'attributes' && change.attributeName === 'open') {
          if (this.details.open) {
            void this.show();
          } else {
            void this.hide();
          }
        }
      }
    });
    this.detailsObserver.observe(this.details, { attributes: true });
  }

  public override disconnectedCallback() {
    super.disconnectedCallback();
    // Upstream quirk: the observer is created once, on first update, and is not recreated when the element is connected
    // again, so a details that was removed and re-added no longer follows its inner <details> element's `open`.
    this.detailsObserver?.disconnect();
  }

  private handleSummaryClick(event: MouseEvent) {
    event.preventDefault();

    if (!this.disabled) {
      if (this.open) {
        void this.hide();
      } else {
        void this.show();
      }
      this.header.focus();
    }
  }

  private handleSummaryKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();

      if (this.open) {
        void this.hide();
      } else {
        void this.show();
      }
    }

    if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      event.preventDefault();
      void this.hide();
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      event.preventDefault();
      void this.show();
    }
  }

  public async handleOpenChange() {
    if (this.open) {
      this.details.open = true;
      // Show
      const slShow = this.emit('sl-show', { cancelable: true });
      if (slShow.defaultPrevented) {
        this.open = false;
        this.details.open = false;
        return;
      }

      await stopAnimations(this.body);

      const { keyframes, options } = getAnimation(this, 'details.show', { dir: this.direction() });
      await animateTo(this.body, shimKeyframesHeightAuto(keyframes, this.body.scrollHeight), options);
      this.body.style.height = 'auto';

      this.emit('sl-after-show');
    } else {
      // Hide
      const slHide = this.emit('sl-hide', { cancelable: true });
      if (slHide.defaultPrevented) {
        this.details.open = true;
        this.open = true;
        return;
      }

      await stopAnimations(this.body);

      const { keyframes, options } = getAnimation(this, 'details.hide', { dir: this.direction() });
      await animateTo(this.body, shimKeyframesHeightAuto(keyframes, this.body.scrollHeight), options);
      this.body.style.height = 'auto';

      this.details.open = false;
      this.emit('sl-after-hide');
    }
  }

  /** Shows the details. */
  public async show() {
    if (this.open || this.disabled) {
      return undefined;
    }

    this.open = true;
    return waitForEvent(this, 'sl-after-show');
  }

  /** Hides the details */
  public async hide() {
    if (!this.open || this.disabled) {
      return undefined;
    }

    this.open = false;
    return waitForEvent(this, 'sl-after-hide');
  }

  protected override render() {
    const isRtl = this.direction() === 'rtl';

    return html`
      <details
        part="base"
        class=${classMap({
          details: true,
          'details--open': this.open,
          'details--disabled': this.disabled,
          'details--rtl': isRtl,
        })}
      >
        <summary
          part="header"
          id="header"
          class="details__header"
          role="button"
          aria-expanded=${this.open ? 'true' : 'false'}
          aria-controls="content"
          aria-disabled=${this.disabled ? 'true' : 'false'}
          tabindex=${this.disabled ? '-1' : '0'}
          @click=${this.handleSummaryClick}
          @keydown=${this.handleSummaryKeyDown}
        >
          <slot name="summary" part="summary" class="details__summary">${this.summary}</slot>

          <span part="summary-icon" class="details__summary-icon">
            <slot name="expand-icon">
              <sl-icon library="system" name=${isRtl ? 'chevron-left' : 'chevron-right'}></sl-icon>
            </slot>
            <slot name="collapse-icon">
              <sl-icon library="system" name=${isRtl ? 'chevron-left' : 'chevron-right'}></sl-icon>
            </slot>
          </span>
        </summary>

        <div class="details__body" role="region" aria-labelledby="header">
          <slot part="content" id="content" class="details__content"></slot>
        </div>
      </details>
    `;
  }
}

setDefaultAnimation('details.show', {
  keyframes: [
    { height: '0', opacity: '0' },
    { height: 'auto', opacity: '1' },
  ],
  options: { duration: 250, easing: 'linear' },
});

setDefaultAnimation('details.hide', {
  keyframes: [
    { height: 'auto', opacity: '1' },
    { height: '0', opacity: '0' },
  ],
  options: { duration: 250, easing: 'linear' },
});

export default VelcroDetails;
