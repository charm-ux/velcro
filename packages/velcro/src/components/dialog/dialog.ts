// Adapted from Shoelace v2.20.1 (src/components/dialog/dialog.component.ts, the `watch` decorator in
// src/internal/watch.ts and the reflected-property restore and dependency definition in src/internal/shoelace-element.ts),
// Copyright (c) 2020 A Beautiful Site, LLC, MIT License. See THIRD_PARTY_NOTICES.md. The API documentation wording, the
// rendered structure (a fixed `base` wrapper around an `overlay` and a `panel` with role="dialog", an optional header with
// the label slot, the header actions and an `<sl-icon-button>` close button, a body and a footer), the open handling, the
// focus trap (Velcro's port of Shoelace's `Modal`), the body scroll lock, the Escape handling (a `CloseWatcher` where the
// browser has one, else a document keydown listener), the animations and the events follow Shoelace. Velcro changes:
// built on the @charm-ux/core base element (core's dialog is not used, see the class comment), the `@watch` handler runs
// from `update()`, and the dependency on <sl-icon-button> is defined when a dialog is constructed through Velcro's
// registration helper rather than Shoelace's `static dependencies`. Shoelace's behavior is matched exactly, including
// its quirks; each one is marked "Upstream quirk" below and listed on the docs page.
import { html, type PropertyValues } from 'lit';
import { property, query } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { CharmElement } from '@charm-ux/core/dist/base/charm-element/charm-element.js';
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
import styles from './dialog.styles.js';

// The part of the platform's `CloseWatcher` the dialog uses. TypeScript's DOM library does not declare it yet (Shoelace
// declares it globally in its own declaration file); a local type keeps Velcro's published types free of a global.
interface CloseWatcherLike {
  onclose: (() => void) | null;
  destroy(): void;
}
type CloseWatcherConstructor = new () => CloseWatcherLike;

/**
 * Dialogs, sometimes called "modals", appear above the page and require the user's immediate attention.
 *
 * Built on the @charm-ux/core base element. Core's dialog is not extended: it renders a native `<dialog>` opened with
 * `showModal()` (the top layer and its `::backdrop`) where Shoelace renders a fixed `<div>` overlay and panel with its
 * own focus trap; its protected `dialog` member is that `HTMLDialogElement`, which Shoelace's public `dialog` field (the
 * `base` `<div>`) cannot override; its shadow root delegates focus, which changes where `focus()` lands; it sets a
 * `focusable` attribute on the host and handles Escape on the host; and its model differs from Shoelace's (`heading`,
 * `position`, `alert`, `hide-close-button` and `close-button-label` properties, `actions` and `heading` slots,
 * `dialog-*` parts and `dialog-*` events driven by CSS transitions instead of the animation registry's awaited
 * animations). The only core extension is the non-bubbling `ready` event on first update.
 *
 * The close button is an `<sl-icon-button>` (Velcro's), as in Shoelace; like Shoelace's, constructing a dialog defines
 * that dependency when no element owns its tag yet. The show, hide, deny-close and overlay animations come from the
 * animation registry (`dialog.show`, `dialog.hide`, `dialog.denyClose`, `dialog.overlay.show` and
 * `dialog.overlay.hide`); change them with `setAnimation()` or `setDefaultAnimation()` from
 * `@charm-ux/velcro/utilities/animation-registry`. The body scroll lock adds the `sl-scroll-lock` class to `<html>`;
 * Velcro's themes style it as Shoelace's do.
 *
 * @tag sl-dialog
 * @status prototype
 *
 * @dependency sl-icon-button
 *
 * @slot - The dialog's main content.
 * @slot label - The dialog's label. Alternatively, you can use the `label` attribute.
 * @slot header-actions - Optional actions to add to the header. Works best with `<sl-icon-button>`.
 * @slot footer - The dialog's footer, usually one or more buttons representing various options.
 *
 * @event sl-show - Emitted when the dialog opens.
 * @event sl-after-show - Emitted after the dialog opens and all animations are complete.
 * @event sl-hide - Emitted when the dialog closes.
 * @event sl-after-hide - Emitted after the dialog closes and all animations are complete.
 * @event sl-initial-focus - Emitted when the dialog opens and is ready to receive focus. Calling
 *   `event.preventDefault()` will prevent focusing and allow you to set it on a different element, such as an input.
 * @event {{ source: 'close-button' | 'keyboard' | 'overlay' }} sl-request-close - Emitted when the user attempts to
 *   close the dialog by clicking the close button, clicking the overlay, or pressing escape. Calling
 *   `event.preventDefault()` will keep the dialog open. Avoid using this unless closing the dialog will result in
 *   destructive behavior such as data loss.
 *
 * @csspart base - The component's base wrapper.
 * @csspart overlay - The overlay that covers the screen behind the dialog.
 * @csspart panel - The dialog's panel (where the dialog and its content are rendered).
 * @csspart header - The dialog's header. This element wraps the title and header actions.
 * @csspart header-actions - Optional actions to add to the header. Works best with `<sl-icon-button>`.
 * @csspart title - The dialog's title.
 * @csspart close-button - The close button, an `<sl-icon-button>`.
 * @csspart close-button__base - The close button's exported `base` part.
 * @csspart body - The dialog's body.
 * @csspart footer - The dialog's footer.
 *
 * @cssproperty --width - The preferred width of the dialog. Note that the dialog will shrink to accommodate smaller screens.
 * @cssproperty --header-spacing - The amount of padding to use for the header.
 * @cssproperty --body-spacing - The amount of padding to use for the body.
 * @cssproperty --footer-spacing - The amount of padding to use for the footer.
 *
 * @animation dialog.show - The animation to use when showing the dialog.
 * @animation dialog.hide - The animation to use when hiding the dialog.
 * @animation dialog.denyClose - The animation to use when a request to close the dialog is denied.
 * @animation dialog.overlay.show - The animation to use when showing the dialog's overlay.
 * @animation dialog.overlay.hide - The animation to use when hiding the dialog's overlay.
 *
 * @property modal - Exposes the internal modal utility that controls focus trapping. To temporarily disable focus
 *   trapping and allow third-party modals spawned from an active Shoelace modal, call `modal.activateExternal()` when
 *   the third-party modal opens. Upon closing, call `modal.deactivateExternal()` to restore Shoelace's focus trapping.
 */
export class VelcroDialog extends CharmElement {
  public static override baseName = 'dialog';

  // Core's base styles are replaced by Shoelace's own (see the styles file).
  public static override styles = [styles];

  // Shoelace's `static dependencies` for the dialog: the elements its template renders. Shoelace keys them by tag; here
  // the tag is derived from each class's `baseName` (`sl-icon-button` for `VelcroIconButton`), the same tag
  // `defineVelcroComponent` defines and the template renders. As in Shoelace's base element, each one that is not
  // defined yet is defined when a dialog is constructed, and a tag that another constructor already owns is left alone
  // (with Shoelace's warning when the versions differ). If the platform refuses the class itself (for example because
  // it is already registered under another tag), an anonymous subclass is defined instead, as Shoelace does. The icon
  // button in turn defines `<sl-icon>` when it is constructed. Core's own array-typed `dependencies` (registration in
  // core's scope) stays empty. Not part of the documented API (Shoelace's manifest lists `dependencies` without a
  // description).
  private static readonly shoelaceDependencies: readonly VelcroComponentConstructor[] = [VelcroIconButton];

  public constructor() {
    super();
    for (const component of VelcroDialog.shoelaceDependencies) defineVelcroComponent(component);
  }

  // Shoelace's base element restores a reflected property's initial value when its attribute is removed (see
  // attributeChangedCallback). `open`, `label` and `noHeader` are the reflected properties here.
  private readonly initialReflectedProperties = new Map<string, unknown>();

  private hasRecordedInitialProperties = false;

  private velcroDir?: string;

  private readonly hasSlotController = new HasSlotController(this, 'footer');

  // As in Shoelace: the controller supplies the localized `close` term and re-renders the dialog when the document's
  // language or direction changes. The animation direction is resolved by direction(), as Shoelace's controller does.
  private readonly localize = new LocalizeController(this);

  private originalTrigger: HTMLElement | null = null;

  public modal = new Modal(this);

  private closeWatcher: CloseWatcherLike | null = null;

  // Shoelace's public `@query('.dialog')` field: the `base` wrapper.
  @query('.dialog')
  public dialog!: HTMLElement;

  // Shoelace's public `@query('.dialog__panel')` field: the `panel` with role="dialog".
  @query('.dialog__panel')
  public panel!: HTMLElement;

  // Shoelace's public `@query('.dialog__overlay')` field: the `overlay`.
  @query('.dialog__overlay')
  public overlay!: HTMLElement;

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

  /**
   * Indicates whether or not the dialog is open. You can toggle this attribute to show and hide the dialog, or you can
   * use the `show()` and `hide()` methods and this attribute will reflect the dialog's open state.
   */
  @property({ type: Boolean, reflect: true })
  public open = false;

  /**
   * The dialog's label as displayed in the header. You should always include a relevant label even when using
   * `no-header`, as it is required for proper accessibility. If you need to display HTML, use the `label` slot instead.
   */
  @property({ reflect: true })
  public label = '';

  /**
   * Disables the header. This will also remove the default close button, so please ensure you provide an easy,
   * accessible way for users to dismiss the dialog.
   */
  @property({ attribute: 'no-header', type: Boolean, reflect: true })
  public noHeader = false;

  // Records the reflected properties' values the first time any attribute changes (during upgrade, before the
  // attribute values are applied), so that removing a reflected attribute later restores that value instead of
  // leaving the property null. Same timing and rule as Shoelace's base element.
  public override attributeChangedCallback(name: string, previous: string | null, next: string | null) {
    if (!this.hasRecordedInitialProperties) {
      (this.constructor as typeof VelcroDialog).elementProperties.forEach((options, prop) => {
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
      if (changed.has(prop as keyof VelcroDialog) && self[prop] == null) {
        self[prop] = value;
      }
    });
  }

  // Shoelace's `@watch('open', { waitUntilFirstUpdate: true })`: it runs before the render, from the second update on.
  protected override update(changed: PropertyValues<this>) {
    if (this.hasUpdated && changed.has('open') && changed.get('open') !== this.open) {
      void this.handleOpenChange();
    }

    super.update(changed);
  }

  // The direction the animations use, as Shoelace's localization controller resolves it: the host's `dir` property (set
  // directly or through the attribute), else the controller's document-direction snapshot (`<html dir>` as of the last
  // observer callback or translation registration, not a live read; else `ltr`), lower-cased. Velcro's shared
  // controller reads the host's `dir` attribute instead (core's `dir` getter returns the computed direction), which would
  // miss a direction set only through the property; this component's `dir` returns what was set, by attribute or property.
  private direction() {
    return `${this.velcroDir || documentDir()}`.toLowerCase();
  }

  public override firstUpdated() {
    // Velcro extension (core): the base element's non-bubbling `ready` event.
    super.firstUpdated();

    this.dialog.hidden = !this.open;

    // Upstream quirk: a dialog that is open when it first renders emits no `sl-show` or `sl-after-show`, does not play
    // the show animation, does not move focus into the panel and records no trigger to return focus to.
    if (this.open) {
      this.addOpenListeners();
      this.modal.activate();
      lockBodyScrolling(this);
    }
  }

  public override disconnectedCallback() {
    super.disconnectedCallback();
    // Upstream quirk: removing an open dialog releases the focus trap, the scroll lock and the Escape handling but leaves
    // `open` true; connecting it again does not restore them (only firstUpdated does, once).
    this.modal.deactivate();
    unlockBodyScrolling(this);
    this.removeOpenListeners();
  }

  private requestClose(source: 'close-button' | 'keyboard' | 'overlay') {
    const slRequestClose = this.emit('sl-request-close', {
      cancelable: true,
      detail: { source },
    });

    if (slRequestClose.defaultPrevented) {
      const animation = getAnimation(this, 'dialog.denyClose', { dir: this.direction() });
      void animateTo(this.panel, animation.keyframes, animation.options);
      return;
    }

    void this.hide();
  }

  private addOpenListeners() {
    if ('CloseWatcher' in window) {
      this.closeWatcher?.destroy();
      this.closeWatcher = new (window as unknown as { CloseWatcher: CloseWatcherConstructor }).CloseWatcher();
      this.closeWatcher.onclose = () => this.requestClose('keyboard');
    } else {
      document.addEventListener('keydown', this.handleDocumentKeyDown);
    }
  }

  private removeOpenListeners() {
    this.closeWatcher?.destroy();
    document.removeEventListener('keydown', this.handleDocumentKeyDown);
  }

  private handleDocumentKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && this.modal.isActive() && this.open) {
      event.stopPropagation();
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
      this.modal.activate();

      lockBodyScrolling(this);

      // When the dialog is shown, Safari will attempt to set focus on whatever element has autofocus. This can cause
      // the dialogs's animation to jitter (if it starts offscreen), so we'll temporarily remove the attribute, call
      // `focus({ preventScroll: true })` ourselves, and add the attribute back afterwards.
      //
      // Related: https://github.com/shoelace-style/shoelace/issues/693
      //
      const autoFocusTarget = this.querySelector('[autofocus]');
      if (autoFocusTarget) {
        autoFocusTarget.removeAttribute('autofocus');
      }

      await Promise.all([stopAnimations(this.dialog), stopAnimations(this.overlay)]);
      this.dialog.hidden = false;

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

      const panelAnimation = getAnimation(this, 'dialog.show', { dir: this.direction() });
      const overlayAnimation = getAnimation(this, 'dialog.overlay.show', { dir: this.direction() });
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
      this.modal.deactivate();

      await Promise.all([stopAnimations(this.dialog), stopAnimations(this.overlay)]);
      const panelAnimation = getAnimation(this, 'dialog.hide', { dir: this.direction() });
      const overlayAnimation = getAnimation(this, 'dialog.overlay.hide', { dir: this.direction() });

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

      this.dialog.hidden = true;

      // Now that the dialog is hidden, restore the overlay and panel for next time
      this.overlay.hidden = false;
      this.panel.hidden = false;

      unlockBodyScrolling(this);

      // Restore focus to the original trigger
      const trigger = this.originalTrigger;
      if (typeof trigger?.focus === 'function') {
        setTimeout(() => trigger.focus());
      }

      this.emit('sl-after-hide');
    }
  }

  /** Shows the dialog. */
  public async show() {
    if (this.open) {
      return undefined;
    }

    this.open = true;
    return waitForEvent(this, 'sl-after-show');
  }

  /** Hides the dialog */
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
          dialog: true,
          'dialog--open': this.open,
          'dialog--has-footer': this.hasSlotController.test('footer'),
        })}
      >
        <div part="overlay" class="dialog__overlay" @click=${() => this.requestClose('overlay')} tabindex="-1"></div>

        <div
          part="panel"
          class="dialog__panel"
          role="dialog"
          aria-modal="true"
          aria-hidden=${this.open ? 'false' : 'true'}
          aria-label=${ifDefined(this.noHeader ? this.label : undefined)}
          aria-labelledby=${ifDefined(!this.noHeader ? 'title' : undefined)}
          tabindex="-1"
        >
          ${!this.noHeader
            ? html`
                <header part="header" class="dialog__header">
                  <h2 part="title" class="dialog__title" id="title">
                    <slot name="label"> ${this.label.length > 0 ? this.label : String.fromCharCode(65279)} </slot>
                  </h2>
                  <div part="header-actions" class="dialog__header-actions">
                    <slot name="header-actions"></slot>
                    <sl-icon-button
                      part="close-button"
                      exportparts="base:close-button__base"
                      class="dialog__close"
                      name="x-lg"
                      label=${this.localize.term('close')}
                      library="system"
                      @click="${() => this.requestClose('close-button')}"
                    ></sl-icon-button>
                  </div>
                </header>
              `
            : ''}
          ${
            '' /* The tabindex="-1" is here because the body is technically scrollable if overflowing. However, if there's no focusable elements inside, you won't actually be able to scroll it via keyboard. Previously this was just a <slot>, but tabindex="-1" on the slot causes children to not be focusable. https://github.com/shoelace-style/shoelace/issues/1753#issuecomment-1836803277 */
          }
          <div part="body" class="dialog__body" tabindex="-1"><slot></slot></div>

          <footer part="footer" class="dialog__footer">
            <slot name="footer"></slot>
          </footer>
        </div>
      </div>
    `;
  }
}

setDefaultAnimation('dialog.show', {
  keyframes: [
    { opacity: 0, scale: 0.8 },
    { opacity: 1, scale: 1 },
  ],
  options: { duration: 250, easing: 'ease' },
});

setDefaultAnimation('dialog.hide', {
  keyframes: [
    { opacity: 1, scale: 1 },
    { opacity: 0, scale: 0.8 },
  ],
  options: { duration: 250, easing: 'ease' },
});

setDefaultAnimation('dialog.denyClose', {
  keyframes: [{ scale: 1 }, { scale: 1.02 }, { scale: 1 }],
  options: { duration: 250 },
});

setDefaultAnimation('dialog.overlay.show', {
  keyframes: [{ opacity: 0 }, { opacity: 1 }],
  options: { duration: 250 },
});

setDefaultAnimation('dialog.overlay.hide', {
  keyframes: [{ opacity: 1 }, { opacity: 0 }],
  options: { duration: 250 },
});

export default VelcroDialog;
