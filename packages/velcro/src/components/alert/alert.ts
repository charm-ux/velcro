// Adapted from Shoelace v2.20.1 (src/components/alert/alert.component.ts, `blurActiveElement` in
// src/internal/closeActiveElement.ts, the `watch` decorator in src/internal/watch.ts and the reflected-property restore
// in src/internal/shoelace-element.ts), Copyright (c) 2020 A Beautiful Site, LLC, MIT License. See
// THIRD_PARTY_NOTICES.md.
// The API documentation wording, the rendered structure (a `base` <div role="alert"> with the `alert` / `alert--*` class
// names around the `icon` and `message` parts, an optional `<sl-icon-button>` close button, the hidden timer and the
// optional countdown bar), the auto-hide timer, the countdown, the toast stack, the events and the animations follow
// Shoelace. Velcro changes: built on the @charm-ux/core alert (core-only extras are kept, see the class comment).
import { type PropertyValues, html } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { CharmElement } from '@charm-ux/core/dist/base/charm-element/charm-element.js';
import { CoreAlert } from '@charm-ux/core/dist/components/alert/alert.js';
import { animateTo, stopAnimations } from '../../internal/animate.js';
import { waitForEvent } from '../../internal/event.js';
import { HasSlotController } from '../../internal/slot.js';
import { getAnimation, setDefaultAnimation } from '../../utilities/animation-registry.js';
import { LocalizeController } from '../../utilities/localize.js';
import { defineVelcroComponent, type VelcroComponentConstructor } from '../../utilities/registration.js';
import { VelcroIconButton } from '../icon-button/class.js';
import styles from './alert.styles.js';

/**
 * Calls the blur method on the current active element if it is a child of the provided element.
 * Needed for fixing a11y errors in console.
 * @see https://github.com/shoelace-style/shoelace/issues/2283
 * @param elm The element to check
 */
// Shoelace's internal helper, unchanged. Kept in this module (not exported) until a second component needs it.
const blurActiveElement = (elm: HTMLElement) => {
  const { activeElement } = document;
  if (activeElement && elm.contains(activeElement)) {
    (document.activeElement as HTMLElement)?.blur();
  }
};

/**
 * Alerts are used to display important messages inline or as toast notifications.
 *
 * The close button is an `<sl-icon-button>` (Velcro's), as in Shoelace. Like Shoelace's, constructing an alert defines
 * its dependency `<sl-icon-button>` when no element owns that tag yet, so the class-only entry needs no extra step. The
 * show and hide animations come from the animation registry (`alert.show` and `alert.hide`); change them with
 * `setAnimation()` or `setDefaultAnimation()` from `@charm-ux/velcro/utilities/animation-registry`. The toast stack is a
 * `<div class="sl-toast-stack">` appended to the document body; Velcro's themes style it as Shoelace's do.
 *
 * Velcro extensions inherited from the core alert: `toggle()` (shows a hidden alert and hides an open one) works. The
 * core `dismissible`, `closeLabel` (`closelabel`), `heading` and `politeness` properties are accepted but have no
 * effect: the close button follows `closable`, its label is the localized `close` term, there is no heading, and the
 * message is always `aria-live="polite"`, as in Shoelace.
 *
 * @tag sl-alert
 * @status prototype
 *
 * @dependency sl-icon-button
 *
 * @slot - The alert's main content.
 * @slot icon - An icon to show in the alert. Works best with `<sl-icon>`.
 *
 * @event sl-show - Emitted when the alert opens.
 * @event sl-after-show - Emitted after the alert opens and all animations are complete.
 * @event sl-hide - Emitted when the alert closes.
 * @event sl-after-hide - Emitted after the alert closes and all animations are complete.
 *
 * @inheritedEventDropped alert-show - Never emitted: Shoelace's `sl-show` is emitted instead.
 * @inheritedEventDropped alert-after-show - Never emitted: Shoelace's `sl-after-show` is emitted instead.
 * @inheritedEventDropped alert-hide - Never emitted: Shoelace's `sl-hide` is emitted instead.
 * @inheritedEventDropped alert-after-hide - Never emitted: Shoelace's `sl-after-hide` is emitted instead.
 *
 * @csspart base - The component's base wrapper.
 * @csspart icon - The container that wraps the optional icon.
 * @csspart message - The container that wraps the alert's main content.
 * @csspart close-button - The close button, an `<sl-icon-button>`.
 * @csspart close-button__base - The close button's exported `base` part.
 *
 * @animation alert.show - The animation to use when showing the alert.
 * @animation alert.hide - The animation to use when hiding the alert.
 */
export class VelcroAlert extends CoreAlert {
  // Only Shoelace's styles: core's alert styles and tokens do not apply.
  public static override styles = [styles];

  // Core's array of dependencies registers core's icon in core's scope; this template renders Velcro's
  // `<sl-icon-button>` instead, defined by the constructor below (Shoelace's `static dependencies`).
  public static override get dependencies() {
    return [];
  }

  // Shoelace's `static dependencies` for the alert: the elements its template renders. Shoelace keys them by tag; here
  // the tag is derived from each class's `baseName` (`sl-icon-button` for `VelcroIconButton`), the same tag
  // `defineVelcroComponent` defines and the template renders. As in Shoelace's base element, each one that is not
  // defined yet is defined when an alert is constructed, and a tag that another constructor already owns is left alone,
  // without the warning Shoelace logs when the registered version differs from its own. If the platform refuses the
  // class itself (for example because it is already registered under another tag), an anonymous subclass is defined
  // instead, as Shoelace does. The icon button in turn defines `<sl-icon>` when it is constructed. Not part of the
  // documented API (Shoelace's manifest lists `dependencies` without a description).
  private static readonly shoelaceDependencies: readonly VelcroComponentConstructor[] = [VelcroIconButton];

  // The one toast stack shared by every alert, created on first use, as in Shoelace.
  private static currentToastStack: HTMLDivElement;

  private static get toastStack() {
    if (!this.currentToastStack) {
      this.currentToastStack = Object.assign(document.createElement('div'), {
        className: 'sl-toast-stack',
      });
    }
    return this.currentToastStack;
  }

  private autoHideTimeout!: number;
  private remainingTimeInterval!: number;
  private countdownAnimation?: Animation;

  // Shoelace's slot controller (the `icon` slot decides the `alert--has-icon` class). Core's own controller, under the
  // name `hasSlotController`, stays in place and is not read.
  private readonly shoelaceSlots = new HasSlotController(this, 'icon', 'suffix');

  // As in Shoelace: the controller re-renders the alert when the document's language or direction changes, and gives
  // the close button's label. The animations' direction is resolved by animationDirection(), as Shoelace's controller
  // resolves it.
  private readonly localize = new LocalizeController(this);

  private hasRecordedInitialProperties = false;
  private readonly initialReflectedProperties = new Map<string, unknown>();
  private velcroDir?: string;
  private velcroOpen = false;

  public constructor() {
    super();
    for (const component of VelcroAlert.shoelaceDependencies) {
      if (customElements.get(`sl-${component.baseName}`)) continue;
      try {
        defineVelcroComponent(component);
      } catch {
        defineVelcroComponent(class extends component {});
      }
    }
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

  /**
   * The direction the show and hide animations use, as Shoelace's localization controller resolves it: the host's `dir`
   * property (set directly or through the attribute), else the document's `dir`, else `ltr`, lower-cased. Velcro's
   * shared controller reads the host attribute instead, which misses a direction set only through the property.
   */
  private animationDirection(): string {
    return `${this.velcroDir || document.documentElement.dir || 'ltr'}`.toLowerCase();
  }

  /** The element's language, as set by the `lang` attribute or property. Not reflected. */
  @property()
  public override lang!: string;

  @query('[part~="base"]')
  public override base!: HTMLElement;

  @query('.alert__countdown-elapsed')
  public countdownElement!: HTMLElement;

  /**
   * Indicates whether or not the alert is open. You can toggle this attribute to show and hide the alert, or you can
   * use the `show()` and `hide()` methods and this attribute will reflect the alert's open state.
   * @default false
   */
  @property({ type: Boolean, reflect: true })
  public override get open(): boolean {
    return this.velcroOpen;
  }
  public override set open(value: boolean) {
    this.velcroOpen = value;
  }

  /** Enables a close button that allows the user to dismiss the alert. */
  @property({ type: Boolean, reflect: true })
  public closable = false;

  /** The alert's theme variant. */
  @property({ reflect: true })
  public variant: 'primary' | 'success' | 'neutral' | 'warning' | 'danger' = 'primary';

  /**
   * The length of time, in milliseconds, the alert will show before closing itself. If the user interacts with
   * the alert before it closes (e.g. moves the mouse over it), the timer will restart. Defaults to `Infinity`, meaning
   * the alert will not close on its own.
   */
  @property({ type: Number })
  public duration = Infinity;

  /**
   * Enables a countdown that indicates the remaining time the alert will be displayed.
   * Typically used to indicate the remaining time before a whole app refresh.
   */
  @property({ type: String, reflect: true })
  public countdown?: 'rtl' | 'ltr';

  // Declared after `duration`, so it starts from the duration's initial value (Infinity), as in Shoelace.
  @state()
  private remainingTime = this.duration;

  /**
   * Velcro extension (core), inert: accepted and reflected for compatibility with the core alert, without effect. The
   * close button follows `closable`, as in Shoelace.
   */
  @property({ type: Boolean, reflect: true })
  public override dismissible = false;

  /**
   * Velcro extension (core), inert: accepted for compatibility with the core alert (attribute `closelabel`), without
   * effect. The close button's label is the localized `close` term, as in Shoelace.
   */
  @property()
  public override closeLabel = 'Close';

  /**
   * Velcro extension (core), inert: accepted for compatibility with the core alert, without effect. Shoelace's alert has
   * no heading; put one in the default slot.
   */
  @property()
  public override heading?: string;

  /**
   * Velcro extension (core), inert: accepted for compatibility with the core alert (`off`, `polite` or `assertive`; any
   * other value reads as `polite`), without effect. The message is always `aria-live="polite"`, as in Shoelace.
   * @default 'polite'
   */
  @property()
  public override get politeness(): 'off' | 'polite' | 'assertive' {
    return super.politeness;
  }
  public override set politeness(value: 'off' | 'polite' | 'assertive') {
    super.politeness = value;
  }

  // Skips core's dismissible connectedCallback (its transition probe, which appends a temporary child); core's base
  // element setup still runs.
  public override connectedCallback() {
    CharmElement.prototype.connectedCallback.call(this);
  }

  // Records the reflected properties' values the first time any attribute changes (during upgrade, before the
  // attribute values are applied), so that removing a reflected attribute later restores that value instead of
  // leaving the property null. Same timing and rule as Shoelace's base element.
  public override attributeChangedCallback(name: string, previous: string | null, next: string | null) {
    if (!this.hasRecordedInitialProperties) {
      (this.constructor as typeof VelcroAlert).elementProperties.forEach((options, prop) => {
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
      if (changed.has(prop as keyof VelcroAlert) && self[prop] == null) {
        self[prop] = value;
      }
    });
  }

  protected override update(changed: PropertyValues<this>) {
    // Shoelace's `@watch` handlers run before render, the last-declared watcher first: `duration` (also on the first
    // update), then `open` (only after the first update).
    if (changed.has('duration') && changed.get('duration') !== this.duration) {
      this.handleDurationChange();
    }
    if (this.hasUpdated && changed.has('open') && changed.get('open') !== this.open) {
      void this.handleOpenChange();
    }
    super.update(changed);
  }

  // Skips core's dismissible firstUpdated (core's open handling); core's base element still emits `ready`.
  public override firstUpdated() {
    (CharmElement.prototype as unknown as { firstUpdated(): void }).firstUpdated.call(this);
    this.base.hidden = !this.open;
  }

  private restartAutoHide() {
    this.handleCountdownChange();
    clearTimeout(this.autoHideTimeout);
    clearInterval(this.remainingTimeInterval);
    if (this.open && this.duration < Infinity) {
      this.autoHideTimeout = window.setTimeout(() => this.hide(), this.duration);
      this.remainingTime = this.duration;
      this.remainingTimeInterval = window.setInterval(() => {
        this.remainingTime -= 100;
      }, 100);
    }
  }

  private pauseAutoHide() {
    this.countdownAnimation?.pause();
    clearTimeout(this.autoHideTimeout);
    clearInterval(this.remainingTimeInterval);
  }

  private resumeAutoHide() {
    if (this.duration < Infinity) {
      this.autoHideTimeout = window.setTimeout(() => this.hide(), this.remainingTime);
      this.remainingTimeInterval = window.setInterval(() => {
        this.remainingTime -= 100;
      }, 100);
      this.countdownAnimation?.play();
    }
  }

  private handleCountdownChange() {
    if (this.open && this.duration < Infinity && this.countdown) {
      const { countdownElement } = this;
      const start = '100%';
      const end = '0';
      this.countdownAnimation = countdownElement.animate([{ width: start }, { width: end }], {
        duration: this.duration,
        easing: 'linear',
      });
    }
  }

  private handleCloseClick() {
    void this.hide();
  }

  public async handleOpenChange() {
    if (this.open) {
      // Show
      this.emit('sl-show');

      if (this.duration < Infinity) {
        this.restartAutoHide();
      }

      await stopAnimations(this.base);
      this.base.hidden = false;
      const { keyframes, options } = getAnimation(this, 'alert.show', { dir: this.animationDirection() });
      await animateTo(this.base, keyframes, options);

      this.emit('sl-after-show');
    } else {
      // Hide
      blurActiveElement(this);
      this.emit('sl-hide');

      clearTimeout(this.autoHideTimeout);
      clearInterval(this.remainingTimeInterval);

      await stopAnimations(this.base);
      const { keyframes, options } = getAnimation(this, 'alert.hide', { dir: this.animationDirection() });
      await animateTo(this.base, keyframes, options);
      this.base.hidden = true;

      this.emit('sl-after-hide');
    }
  }

  public handleDurationChange() {
    this.restartAutoHide();
  }

  /** Shows the alert. */
  public override async show() {
    if (this.open) {
      return undefined;
    }

    this.open = true;
    return waitForEvent(this, 'sl-after-show');
  }

  /** Hides the alert */
  public override async hide() {
    if (!this.open) {
      return undefined;
    }

    this.open = false;
    return waitForEvent(this, 'sl-after-hide');
  }

  /** Velcro extension (core): shows the alert when it is hidden and hides it when it is open. */
  public override toggle() {
    void (this.open ? this.hide() : this.show());
  }

  /**
   * Displays the alert as a toast notification. This will move the alert out of its position in the DOM and, when
   * dismissed, it will be removed from the DOM completely. By storing a reference to the alert, you can reuse it by
   * calling this method again. The returned promise will resolve after the alert is hidden.
   */
  public async toast() {
    return new Promise<void>(resolve => {
      this.handleCountdownChange();
      if (VelcroAlert.toastStack.parentElement === null) {
        document.body.append(VelcroAlert.toastStack);
      }

      VelcroAlert.toastStack.appendChild(this);

      // Wait for the toast stack to render
      requestAnimationFrame(() => {
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions -- force a reflow for the initial transition
        this.clientWidth;
        void this.show();
      });

      this.addEventListener(
        'sl-after-hide',
        () => {
          VelcroAlert.toastStack.removeChild(this);
          resolve();

          // Remove the toast stack from the DOM when there are no more alerts
          if (VelcroAlert.toastStack.querySelector('sl-alert') === null) {
            VelcroAlert.toastStack.remove();
          }
        },
        { once: true },
      );
    });
  }

  protected override render() {
    return html`
      <div
        part="base"
        class=${classMap({
          alert: true,
          'alert--open': this.open,
          'alert--closable': this.closable,
          'alert--has-countdown': !!this.countdown,
          'alert--has-icon': this.shoelaceSlots.test('icon'),
          'alert--primary': this.variant === 'primary',
          'alert--success': this.variant === 'success',
          'alert--neutral': this.variant === 'neutral',
          'alert--warning': this.variant === 'warning',
          'alert--danger': this.variant === 'danger',
        })}
        role="alert"
        aria-hidden=${this.open ? 'false' : 'true'}
        @mouseenter=${this.pauseAutoHide}
        @mouseleave=${this.resumeAutoHide}
      >
        <div part="icon" class="alert__icon">
          <slot name="icon"></slot>
        </div>

        <div part="message" class="alert__message" aria-live="polite">
          <slot></slot>
        </div>

        ${this.closable
          ? html`
              <sl-icon-button
                part="close-button"
                exportparts="base:close-button__base"
                class="alert__close-button"
                name="x-lg"
                library="system"
                label=${this.localize.term('close')}
                @click=${this.handleCloseClick}
              ></sl-icon-button>
            `
          : ''}

        <div role="timer" class="alert__timer">${this.remainingTime}</div>

        ${this.countdown
          ? html`
              <div
                class=${classMap({
                  alert__countdown: true,
                  'alert__countdown--ltr': this.countdown === 'ltr',
                })}
              >
                <div class="alert__countdown-elapsed"></div>
              </div>
            `
          : ''}
      </div>
    `;
  }
}

setDefaultAnimation('alert.show', {
  keyframes: [
    { opacity: 0, scale: 0.8 },
    { opacity: 1, scale: 1 },
  ],
  options: { duration: 250, easing: 'ease' },
});

setDefaultAnimation('alert.hide', {
  keyframes: [
    { opacity: 1, scale: 1 },
    { opacity: 0, scale: 0.8 },
  ],
  options: { duration: 250, easing: 'ease' },
});

export default VelcroAlert;
