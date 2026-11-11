// Adapted from Shoelace v2.20.1 (src/components/drawer/drawer.component.ts, `uppercaseFirstLetter` from
// src/internal/string.ts, the `watch` decorator in src/internal/watch.ts and the reflected-property restore and dependency
// definition in src/internal/shoelace-element.ts), Copyright (c) 2020 A Beautiful Site, LLC, MIT License. See
// THIRD_PARTY_NOTICES.md. The API documentation wording, the rendered structure (a `base` wrapper, fixed or, when
// `contained`, absolute, around an `overlay` and a `panel` with role="dialog", an optional header with the label slot, the
// header actions and an `<sl-icon-button>` close button, a body slot and a footer), the open handling, the focus trap
// (Velcro's port of Shoelace's `Modal`), the body scroll lock, the Escape handling (a `CloseWatcher` where the browser has
// one, else a document keydown listener), the placement-specific animations and the events follow Shoelace. Velcro
// changes: built on the @charm-ux/core base element (core has no drawer), the `@watch` handlers run from `update()`, and
// the dependency on <sl-icon-button> is defined when a drawer is constructed through Velcro's registration helper rather
// than Shoelace's `static dependencies`. Shoelace's behavior is matched exactly, including its quirks; each one is marked
// "Upstream quirk" below and listed on the docs page.
import { html, type PropertyValues } from 'lit';
import { property, query } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { CharmElement } from '@charm-ux/core/dist/base/charm-element/charm-element.js';
import { ShoelaceCompat, restoreReflectedProperties } from '../../internal/shoelace-compat.js';
import { animateTo, stopAnimations } from '../../internal/animate.js';
import { blurActiveElement } from '../../internal/close-active-element.js';
import { waitForEvent } from '../../internal/event.js';
import { documentDir } from '../../internal/localize.js';
import Modal from '../../internal/modal.js';
import { lockBodyScrolling, unlockBodyScrolling } from '../../internal/scroll.js';
import { HasSlotController } from '../../internal/slot.js';
import { getAnimation, setDefaultAnimation } from '../../utilities/animation-registry.js';
import { LocalizeController } from '../../utilities/localize.js';
import { defineVelcroComponent, type VelcroComponentConstructor } from '../../utilities/registration.js';
import { VelcroIconButton } from '../icon-button/class.js';
import styles from './drawer.styles.js';

// The part of the platform's `CloseWatcher` the drawer uses. TypeScript's DOM library does not declare it yet (Shoelace
// declares it globally in its own declaration file); a local type keeps Velcro's published types free of a global.
interface CloseWatcherLike {
  onclose: (() => void) | null;
  destroy(): void;
}
type CloseWatcherConstructor = new () => CloseWatcherLike;

// Shoelace's internal `uppercaseFirstLetter` (src/internal/string.ts), which builds the placement's animation name
// (`drawer.showEnd` from `end`). Internal; Shoelace does not export it either.
function uppercaseFirstLetter(string: string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

/**
 * Drawers slide in from a container to expose additional options and information.
 *
 * Built on the @charm-ux/core base element; core has no drawer component (its push pane is a different, non-modal
 * model), so the markup, styles and behavior come from Shoelace. The only core extension is the non-bubbling `ready`
 * event on first update.
 *
 * The close button is an `<sl-icon-button>` (Velcro's), as in Shoelace; like Shoelace's, constructing a drawer defines
 * that dependency when no element owns its tag yet. The show, hide, deny-close and overlay animations come from the
 * animation registry (`drawer.showTop`, `drawer.showEnd`, `drawer.showBottom`, `drawer.showStart`, the matching
 * `drawer.hide*` names, `drawer.denyClose`, `drawer.overlay.show` and `drawer.overlay.hide`); change them with
 * `setAnimation()` or `setDefaultAnimation()` from `@charm-ux/velcro/utilities/animation-registry`. The body scroll lock
 * adds the `sl-scroll-lock` class to `<html>`; Velcro's themes style it as Shoelace's do.
 *
 * @property {string} lang - The element's language, as set by the `lang` attribute or property. Not reflected.
 *
 * @tag sl-drawer
 * @status prototype
 *
 * @dependency sl-icon-button
 *
 * @slot - The drawer's main content.
 * @slot label - The drawer's label. Alternatively, you can use the `label` attribute.
 * @slot header-actions - Optional actions to add to the header. Works best with `<sl-icon-button>`.
 * @slot footer - The drawer's footer, usually one or more buttons representing various options.
 *
 * @event sl-show - Emitted when the drawer opens.
 * @event sl-after-show - Emitted after the drawer opens and all animations are complete.
 * @event sl-hide - Emitted when the drawer closes.
 * @event sl-after-hide - Emitted after the drawer closes and all animations are complete.
 * @event sl-initial-focus - Emitted when the drawer opens and is ready to receive focus. Calling
 *   `event.preventDefault()` will prevent focusing and allow you to set it on a different element, such as an input.
 * @event {{ source: 'close-button' | 'keyboard' | 'overlay' }} sl-request-close - Emitted when the user attempts to
 *   close the drawer by clicking the close button, clicking the overlay, or pressing escape. Calling
 *   `event.preventDefault()` will keep the drawer open. Avoid using this unless closing the drawer will result in
 *   destructive behavior such as data loss.
 *
 * @csspart base - The component's base wrapper.
 * @csspart overlay - The overlay that covers the screen behind the drawer.
 * @csspart panel - The drawer's panel (where the drawer and its content are rendered).
 * @csspart header - The drawer's header. This element wraps the title and header actions.
 * @csspart header-actions - Optional actions to add to the header. Works best with `<sl-icon-button>`.
 * @csspart title - The drawer's title.
 * @csspart close-button - The close button, an `<sl-icon-button>`.
 * @csspart close-button__base - The close button's exported `base` part.
 * @csspart body - The drawer's body.
 * @csspart footer - The drawer's footer.
 *
 * @cssproperty --size - The preferred size of the drawer. This will be applied to the drawer's width or height
 *   depending on its `placement`. Note that the drawer will shrink to accommodate smaller screens.
 * @cssproperty --header-spacing - The amount of padding to use for the header.
 * @cssproperty --body-spacing - The amount of padding to use for the body.
 * @cssproperty --footer-spacing - The amount of padding to use for the footer.
 *
 * @animation drawer.showTop - The animation to use when showing a drawer with `top` placement.
 * @animation drawer.showEnd - The animation to use when showing a drawer with `end` placement.
 * @animation drawer.showBottom - The animation to use when showing a drawer with `bottom` placement.
 * @animation drawer.showStart - The animation to use when showing a drawer with `start` placement.
 * @animation drawer.hideTop - The animation to use when hiding a drawer with `top` placement.
 * @animation drawer.hideEnd - The animation to use when hiding a drawer with `end` placement.
 * @animation drawer.hideBottom - The animation to use when hiding a drawer with `bottom` placement.
 * @animation drawer.hideStart - The animation to use when hiding a drawer with `start` placement.
 * @animation drawer.denyClose - The animation to use when a request to close the drawer is denied.
 * @animation drawer.overlay.show - The animation to use when showing the drawer's overlay.
 * @animation drawer.overlay.hide - The animation to use when hiding the drawer's overlay.
 *
 * @property modal - Exposes the internal modal utility that controls focus trapping. To temporarily disable focus
 *   trapping and allow third-party modals spawned from an active Shoelace modal, call `modal.activateExternal()` when
 *   the third-party modal opens. Upon closing, call `modal.deactivateExternal()` to restore Shoelace's focus trapping.
 */
export class VelcroDrawer extends ShoelaceCompat(CharmElement, { lang: true, dir: true, reflected: true }) {
  public static override baseName = 'drawer';

  // Core's base styles are replaced by Shoelace's own (see the styles file).
  public static override styles = [styles];

  // Shoelace's `static dependencies` for the drawer: the elements its template renders. Shoelace keys them by tag; here
  // the tag is derived from each class's `baseName` (`sl-icon-button` for `VelcroIconButton`), the same tag
  // `defineVelcroComponent` defines and the template renders. As in Shoelace's base element, each one that is not
  // defined yet is defined when a drawer is constructed, and a tag that another constructor already owns is left alone
  // (with Shoelace's warning when the versions differ). If the platform refuses the class itself (for example because
  // it is already registered under another tag), an anonymous subclass is defined instead, as Shoelace does. The icon
  // button in turn defines `<sl-icon>` when it is constructed. Core's own array-typed `dependencies` (registration in
  // core's scope) stays empty. Not part of the documented API (Shoelace's manifest lists `dependencies` without a
  // description).
  private static readonly shoelaceDependencies: readonly VelcroComponentConstructor[] = [VelcroIconButton];

  public constructor() {
    super();
    for (const component of VelcroDrawer.shoelaceDependencies) defineVelcroComponent(component);
  }

  private readonly hasSlotController = new HasSlotController(this, 'footer');

  // As in Shoelace: the controller supplies the localized `close` term and re-renders the drawer when the document's
  // language or direction changes. The direction is resolved by direction(), as Shoelace's controller does.
  private readonly localize = new LocalizeController(this);

  private originalTrigger: HTMLElement | null = null;

  public modal = new Modal(this);

  private closeWatcher: CloseWatcherLike | null = null;

  // Shoelace's public `@query('.drawer')` field: the `base` wrapper.
  @query('.drawer')
  public drawer!: HTMLElement;

  // Shoelace's public `@query('.drawer__panel')` field: the `panel` with role="dialog".
  @query('.drawer__panel')
  public panel!: HTMLElement;

  // Shoelace's public `@query('.drawer__overlay')` field: the `overlay`.
  @query('.drawer__overlay')
  public overlay!: HTMLElement;

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
   * Indicates whether or not the drawer is open. You can toggle this attribute to show and hide the drawer, or you can
   * use the `show()` and `hide()` methods and this attribute will reflect the drawer's open state.
   */
  @property({ type: Boolean, reflect: true })
  public open = false;

  /**
   * The drawer's label as displayed in the header. You should always include a relevant label even when using
   * `no-header`, as it is required for proper accessibility. If you need to display HTML, use the `label` slot instead.
   */
  @property({ reflect: true })
  public label = '';

  /** The direction from which the drawer will open. */
  @property({ reflect: true })
  public placement: 'top' | 'end' | 'bottom' | 'start' = 'end';

  /**
   * By default, the drawer slides out of its containing block (usually the viewport). To make the drawer slide out of
   * its parent element, set this attribute and add `position: relative` to the parent.
   */
  @property({ type: Boolean, reflect: true })
  public contained = false;

  /**
   * Removes the header. This will also remove the default close button, so please ensure you provide an easy,
   * accessible way for users to dismiss the drawer.
   */
  @property({ attribute: 'no-header', type: Boolean, reflect: true })
  public noHeader = false;

  protected override willUpdate(changed: PropertyValues<this>) {
    super.willUpdate(changed);
    restoreReflectedProperties(this, changed);
  }

  // Shoelace's `@watch('open', { waitUntilFirstUpdate: true })` and `@watch('contained', { waitUntilFirstUpdate: true })`:
  // they run before the render, from the second update on. Each `@watch` wraps the `update()` before it, so the one
  // declared last (`contained`) runs first when both change in the same update.
  protected override update(changed: PropertyValues<this>) {
    if (this.hasUpdated && changed.has('contained') && changed.get('contained') !== this.contained) {
      this.handleNoModalChange();
    }

    if (this.hasUpdated && changed.has('open') && changed.get('open') !== this.open) {
      void this.handleOpenChange();
    }

    super.update(changed);
  }

  // The direction the animations and the `drawer--rtl` class use, as Shoelace's localization controller resolves it:
  // the host's `dir` property (set directly or through the attribute), else the controller's document-direction snapshot
  // (`<html dir>` as of the last observer callback or translation registration, not a live read; else `ltr`),
  // lower-cased. Velcro's shared controller reads the host's `dir` attribute instead (core's `dir` getter returns the
  // computed direction), which would miss a direction set only through the property; this component's `dir` returns what
  // was set, by attribute or property.
  private direction() {
    return `${super.dir || documentDir()}`.toLowerCase();
  }

  public override firstUpdated() {
    this.drawer.hidden = !this.open;

    // Velcro extension (core): the base element's non-bubbling `ready` event, dispatched once the base's hidden state is
    // set, so a listener sees the settled state.
    super.firstUpdated();

    // Upstream quirk: a drawer that is open when it first renders emits no `sl-show` or `sl-after-show`, does not play
    // the show animation, does not move focus into the panel and records no trigger to return focus to.
    if (this.open) {
      this.addOpenListeners();

      if (!this.contained) {
        this.modal.activate();
        lockBodyScrolling(this);
      }
    }
  }

  public override disconnectedCallback() {
    super.disconnectedCallback();
    // Upstream quirk: removing an open drawer releases the body scroll lock and the Escape handling but not its focus
    // trap (unlike Shoelace's dialog, the drawer does not deactivate its modal here), and leaves `open` true; connecting
    // it again does not restore the scroll lock or the Escape handling.
    unlockBodyScrolling(this);
    this.removeOpenListeners();
  }

  private requestClose(source: 'close-button' | 'keyboard' | 'overlay') {
    const slRequestClose = this.emit('sl-request-close', {
      cancelable: true,
      detail: { source },
    });

    if (slRequestClose.defaultPrevented) {
      const animation = getAnimation(this, 'drawer.denyClose', { dir: this.direction() });
      void animateTo(this.panel, animation.keyframes, animation.options);
      return;
    }

    void this.hide();
  }

  // Upstream quirk: where the browser has CloseWatcher, Escape goes through a watcher that closes (and is spent) on the
  // first Escape. When that request is canceled the drawer stays open without a new watcher, so a later Escape requests
  // nothing until the drawer is hidden and shown again. The keydown fallback has no such limit. A contained drawer gets
  // no watcher (and the keydown fallback ignores it), so Escape never closes a contained drawer.
  private addOpenListeners() {
    if ('CloseWatcher' in window) {
      this.closeWatcher?.destroy();
      if (!this.contained) {
        this.closeWatcher = new (window as unknown as { CloseWatcher: CloseWatcherConstructor }).CloseWatcher();
        this.closeWatcher.onclose = () => this.requestClose('keyboard');
      }
    } else {
      document.addEventListener('keydown', this.handleDocumentKeyDown);
    }
  }

  private removeOpenListeners() {
    document.removeEventListener('keydown', this.handleDocumentKeyDown);
    this.closeWatcher?.destroy();
  }

  private handleDocumentKeyDown = (event: KeyboardEvent) => {
    // Contained drawers aren't modal and don't respond to the escape key
    if (this.contained) {
      return;
    }

    if (event.key === 'Escape' && this.modal.isActive() && this.open) {
      event.stopImmediatePropagation();
      this.requestClose('keyboard');
    }
  };

  public async handleOpenChange() {
    if (this.open) {
      // Show
      // As in Shoelace, `sl-show` is not cancelable.
      this.emit('sl-show');
      this.addOpenListeners();
      this.originalTrigger = document.activeElement as HTMLElement;

      // Lock body scrolling only if the drawer isn't contained
      if (!this.contained) {
        this.modal.activate();
        lockBodyScrolling(this);
      }

      // When the drawer is shown, Safari will attempt to set focus on whatever element has autofocus. This causes the
      // drawer's animation to jitter, so we'll temporarily remove the attribute, call `focus({ preventScroll: true })`
      // ourselves, and add the attribute back afterwards.
      //
      // Related: https://github.com/shoelace-style/shoelace/issues/693
      //
      const autoFocusTarget = this.querySelector('[autofocus]');
      if (autoFocusTarget) {
        autoFocusTarget.removeAttribute('autofocus');
      }

      await Promise.all([stopAnimations(this.drawer), stopAnimations(this.overlay)]);
      this.drawer.hidden = false;

      // Set initial focus
      requestAnimationFrame(() => {
        const slInitialFocus = this.emit('sl-initial-focus', { cancelable: true });

        if (!slInitialFocus.defaultPrevented) {
          // Set focus to the autofocus target and restore the attribute
          if (autoFocusTarget) {
            (autoFocusTarget as HTMLInputElement).focus({ preventScroll: true });
          } else {
            this.panel.focus({ preventScroll: true });
          }
        }

        // Restore the autofocus attribute
        if (autoFocusTarget) {
          autoFocusTarget.setAttribute('autofocus', '');
        }
      });

      const panelAnimation = getAnimation(this, `drawer.show${uppercaseFirstLetter(this.placement)}`, {
        dir: this.direction(),
      });
      const overlayAnimation = getAnimation(this, 'drawer.overlay.show', { dir: this.direction() });
      await Promise.all([
        animateTo(this.panel, panelAnimation.keyframes, panelAnimation.options),
        animateTo(this.overlay, overlayAnimation.keyframes, overlayAnimation.options),
      ]);

      this.emit('sl-after-show');
    } else {
      // Hide
      blurActiveElement(this);
      // As in Shoelace, `sl-hide` is not cancelable; only `sl-request-close` (a close by the user) can be canceled.
      this.emit('sl-hide');
      this.removeOpenListeners();

      // As in Shoelace, the drawer releases the focus trap and the scroll lock when hiding starts (Shoelace's dialog
      // releases the scroll lock after its hide animation).
      if (!this.contained) {
        this.modal.deactivate();
        unlockBodyScrolling(this);
      }

      await Promise.all([stopAnimations(this.drawer), stopAnimations(this.overlay)]);
      const panelAnimation = getAnimation(this, `drawer.hide${uppercaseFirstLetter(this.placement)}`, {
        dir: this.direction(),
      });
      const overlayAnimation = getAnimation(this, 'drawer.overlay.hide', { dir: this.direction() });

      // Animate the overlay and the panel at the same time. Because animation durations might be different, we need to
      // hide each one individually when the animation finishes, otherwise the first one that finishes will reappear
      // unexpectedly. We'll unhide them after all animations have completed.
      await Promise.all([
        animateTo(this.overlay, overlayAnimation.keyframes, overlayAnimation.options).then(() => {
          this.overlay.hidden = true;
        }),
        animateTo(this.panel, panelAnimation.keyframes, panelAnimation.options).then(() => {
          this.panel.hidden = true;
        }),
      ]);

      this.drawer.hidden = true;

      // Now that the drawer is hidden, restore the overlay and panel for next time
      this.overlay.hidden = false;
      this.panel.hidden = false;

      // Restore focus to the original trigger
      const trigger = this.originalTrigger;
      if (typeof trigger?.focus === 'function') {
        setTimeout(() => trigger.focus());
      }

      this.emit('sl-after-hide');
    }
  }

  // Shoelace's public (undocumented) handler for `contained` changes while open: a drawer that stops being contained
  // traps focus and locks body scrolling; one that becomes contained releases both. Upstream quirk: the Escape handling
  // is not updated, so with CloseWatcher a drawer opened contained still ignores Escape after `contained` is removed,
  // and one opened uncontained still closes on Escape after `contained` is set.
  public handleNoModalChange() {
    if (this.open && !this.contained) {
      this.modal.activate();
      lockBodyScrolling(this);
    }

    if (this.open && this.contained) {
      this.modal.deactivate();
      unlockBodyScrolling(this);
    }
  }

  /** Shows the drawer. */
  public async show() {
    if (this.open) {
      return undefined;
    }

    this.open = true;
    return waitForEvent(this, 'sl-after-show');
  }

  /** Hides the drawer */
  public async hide() {
    if (!this.open) {
      return undefined;
    }

    this.open = false;
    return waitForEvent(this, 'sl-after-hide');
  }

  protected override render() {
    return html`
      <div
        part="base"
        class=${classMap({
          drawer: true,
          'drawer--open': this.open,
          'drawer--top': this.placement === 'top',
          'drawer--end': this.placement === 'end',
          'drawer--bottom': this.placement === 'bottom',
          'drawer--start': this.placement === 'start',
          'drawer--contained': this.contained,
          'drawer--fixed': !this.contained,
          'drawer--rtl': this.direction() === 'rtl',
          'drawer--has-footer': this.hasSlotController.test('footer'),
        })}
      >
        <div part="overlay" class="drawer__overlay" @click=${() => this.requestClose('overlay')} tabindex="-1"></div>

        <div
          part="panel"
          class="drawer__panel"
          role="dialog"
          aria-modal="true"
          aria-hidden=${this.open ? 'false' : 'true'}
          aria-label=${ifDefined(this.noHeader ? this.label : undefined)}
          aria-labelledby=${ifDefined(!this.noHeader ? 'title' : undefined)}
          tabindex="0"
        >
          ${!this.noHeader
            ? html`
                <header part="header" class="drawer__header">
                  <h2 part="title" class="drawer__title" id="title">
                    <!-- If there's no label, use an invisible character to prevent the header from collapsing -->
                    <slot name="label"> ${this.label.length > 0 ? this.label : String.fromCharCode(65279)} </slot>
                  </h2>
                  <div part="header-actions" class="drawer__header-actions">
                    <slot name="header-actions"></slot>
                    <sl-icon-button
                      part="close-button"
                      exportparts="base:close-button__base"
                      class="drawer__close"
                      name="x-lg"
                      label=${this.localize.term('close')}
                      library="system"
                      @click=${() => this.requestClose('close-button')}
                    ></sl-icon-button>
                  </div>
                </header>
              `
            : ''}

          <slot part="body" class="drawer__body"></slot>

          <footer part="footer" class="drawer__footer">
            <slot name="footer"></slot>
          </footer>
        </div>
      </div>
    `;
  }
}

// Top
setDefaultAnimation('drawer.showTop', {
  keyframes: [
    { opacity: 0, translate: '0 -100%' },
    { opacity: 1, translate: '0 0' },
  ],
  options: { duration: 250, easing: 'ease' },
});

setDefaultAnimation('drawer.hideTop', {
  keyframes: [
    { opacity: 1, translate: '0 0' },
    { opacity: 0, translate: '0 -100%' },
  ],
  options: { duration: 250, easing: 'ease' },
});

// End
setDefaultAnimation('drawer.showEnd', {
  keyframes: [
    { opacity: 0, translate: '100%' },
    { opacity: 1, translate: '0' },
  ],
  rtlKeyframes: [
    { opacity: 0, translate: '-100%' },
    { opacity: 1, translate: '0' },
  ],
  options: { duration: 250, easing: 'ease' },
});

setDefaultAnimation('drawer.hideEnd', {
  keyframes: [
    { opacity: 1, translate: '0' },
    { opacity: 0, translate: '100%' },
  ],
  rtlKeyframes: [
    { opacity: 1, translate: '0' },
    { opacity: 0, translate: '-100%' },
  ],
  options: { duration: 250, easing: 'ease' },
});

// Bottom
setDefaultAnimation('drawer.showBottom', {
  keyframes: [
    { opacity: 0, translate: '0 100%' },
    { opacity: 1, translate: '0 0' },
  ],
  options: { duration: 250, easing: 'ease' },
});

setDefaultAnimation('drawer.hideBottom', {
  keyframes: [
    { opacity: 1, translate: '0 0' },
    { opacity: 0, translate: '0 100%' },
  ],
  options: { duration: 250, easing: 'ease' },
});

// Start
setDefaultAnimation('drawer.showStart', {
  keyframes: [
    { opacity: 0, translate: '-100%' },
    { opacity: 1, translate: '0' },
  ],
  rtlKeyframes: [
    { opacity: 0, translate: '100%' },
    { opacity: 1, translate: '0' },
  ],
  options: { duration: 250, easing: 'ease' },
});

setDefaultAnimation('drawer.hideStart', {
  keyframes: [
    { opacity: 1, translate: '0' },
    { opacity: 0, translate: '-100%' },
  ],
  rtlKeyframes: [
    { opacity: 1, translate: '0' },
    { opacity: 0, translate: '100%' },
  ],
  options: { duration: 250, easing: 'ease' },
});

// Deny close
setDefaultAnimation('drawer.denyClose', {
  keyframes: [{ scale: 1 }, { scale: 1.01 }, { scale: 1 }],
  options: { duration: 250 },
});

// Overlay
setDefaultAnimation('drawer.overlay.show', {
  keyframes: [{ opacity: 0 }, { opacity: 1 }],
  options: { duration: 250 },
});

setDefaultAnimation('drawer.overlay.hide', {
  keyframes: [{ opacity: 1 }, { opacity: 0 }],
  options: { duration: 250 },
});

export default VelcroDrawer;
