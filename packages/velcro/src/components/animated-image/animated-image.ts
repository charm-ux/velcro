// Adapted from Shoelace v2.20.1 (src/components/animated-image/animated-image.component.ts, the `@watch` timing of
// src/internal/watch.ts and the dependency definition, the restore of reflected properties' initial values and the `dir`
// and `lang` declarations in src/internal/shoelace-element.ts), Copyright (c) 2020 A Beautiful Site, LLC, MIT License. See
// THIRD_PARTY_NOTICES.md. The API documentation wording, the rendered structure (an animated image and, once it has
// loaded, a frozen frame drawn on a canvas and a `control-box` part with the play and pause icon slots), the click
// handling, the restart of the animation when it is played, the `sl-load` and `sl-error` events and the public `src`,
// `alt` and `play` properties follow Shoelace. Velcro changes: built on the @charm-ux/core base element (core has no
// animated image), and the dependency on <sl-icon> is defined when an animated image is constructed through Velcro's
// registration helper rather than Shoelace's `static dependencies`. Shoelace's behavior is matched exactly, including its
// quirks; each one is marked "Upstream quirk" below and listed on the docs page.
import { html, type PropertyValues } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { CharmElement } from '@charm-ux/core/dist/base/charm-element/charm-element.js';
import { defineVelcroComponent, type VelcroComponentConstructor } from '../../utilities/registration.js';
import { VelcroIcon } from '../icon/class.js';
import styles from './animated-image.styles.js';

// Built on the @charm-ux/core base element: @charm-ux/core has no animated image component to extend. The only core
// extension that remains is the non-bubbling `ready` event on first update.
/**
 * A component for displaying animated GIFs and WEBPs that play and pause on interaction. API modelled on Shoelace's
 * `sl-animated-image`. Its default play and pause icons are an `<sl-icon>` from the `system` icon library, as in
 * Shoelace; like Shoelace's, constructing an animated image defines its dependency `<sl-icon>` (Velcro's) when no element
 * owns that tag yet, so the class-only entry needs no extra step.
 *
 * Velcro extension inherited from the core base element and kept: the non-bubbling `ready` event, emitted on the first
 * update.
 *
 * @tag sl-animated-image
 * @status prototype
 *
 * @dependency sl-icon
 *
 * @event sl-load - Emitted when the image loads successfully.
 * @event sl-error - Emitted when the image fails to load.
 *
 * @slot play-icon - Optional play icon to use instead of the default. Works best with `<sl-icon>`.
 * @slot pause-icon - Optional pause icon to use instead of the default. Works best with `<sl-icon>`.
 *
 * @csspart control-box - The container that surrounds the pause/play icons and provides their background.
 *
 * @cssproperty --control-box-size - The size of the icon box.
 * @cssproperty --icon-size - The size of the play/pause icons.
 */
export class VelcroAnimatedImage extends CharmElement {
  public static override baseName = 'animated-image';

  // Core's base styles are replaced by Shoelace's own (see the styles file).
  public static override styles = [styles];

  // Shoelace's `static dependencies` for the animated image: the elements its template renders. Shoelace keys them by tag;
  // here the tag is derived from each class's `baseName` (`sl-icon` for `VelcroIcon`), the same tag
  // `defineVelcroComponent` defines and the default icons render. As in Shoelace's base element, each one that is not
  // defined yet is defined when an animated image is constructed, and a tag that another constructor already owns is left
  // alone (with Shoelace's warning when the versions differ). If the platform refuses the class itself (for example
  // because it is already registered under another tag), an anonymous subclass is defined instead, as Shoelace does.
  // Core's own array-typed `dependencies` (registration in core's scope) stays empty. Not part of the documented API.
  private static readonly shoelaceDependencies: readonly VelcroComponentConstructor[] = [VelcroIcon];

  public constructor() {
    super();
    for (const component of VelcroAnimatedImage.shoelaceDependencies) defineVelcroComponent(component);
  }

  private velcroDir?: string;

  // Shoelace's base element restores a reflected property's initial value when it becomes null or undefined (see
  // attributeChangedCallback). `play` is the only reflected property here and starts undefined, so there is nothing to
  // restore unless it had a value when the first attribute changed.
  private readonly initialReflectedProperties = new Map<string, unknown>();

  private hasRecordedInitialProperties = false;

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

  // Shoelace's public `@query('.animated-image__animated')` field: the animated image.
  @query('.animated-image__animated')
  public animatedImage!: HTMLImageElement;

  // Shoelace's public `@state()` fields. `frozenFrame` is the data URL of the canvas the loaded image was drawn on.
  @state()
  public frozenFrame!: string;

  @state()
  public isLoaded = false;

  /** The path to the image to load. */
  @property()
  public src!: string;

  /** A description of the image used by assistive devices. */
  @property()
  public alt!: string;

  // Upstream quirk: the property is undefined (not false) until it is set, so an animated image that never played has no
  // `play` value, and `play` is not restored to false when it is set to undefined from script.
  /** Plays the animation. When this attribute is remove, the animation will pause. */
  @property({ type: Boolean, reflect: true })
  public play!: boolean;

  // Records the reflected properties' values the first time any attribute changes (during upgrade, before the
  // attribute values are applied), so that a reflected property set to null or undefined later gets that value back
  // instead. Same timing and rule as Shoelace's base element.
  public override attributeChangedCallback(name: string, previous: string | null, next: string | null) {
    if (!this.hasRecordedInitialProperties) {
      (this.constructor as typeof VelcroAnimatedImage).elementProperties.forEach((options, prop) => {
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
      if (changed.has(prop as keyof VelcroAnimatedImage) && self[prop] == null) {
        self[prop] = value;
      }
    });
  }

  private handleClick() {
    this.play = !this.play;
  }

  // Upstream quirk: every load of the animated image redraws the frozen frame from whatever frame the image shows at that
  // moment, including the load that follows a restart (see `handlePlayChange`), and a source that is already loaded never
  // emits `sl-load` again. The frame is drawn on a canvas of the image element's `width` and `height` properties (its
  // rendered size when it is rendered), so the frozen frame is the size the image had when it loaded.
  private handleLoad() {
    const canvas = document.createElement('canvas');
    const { width, height } = this.animatedImage;
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d')!.drawImage(this.animatedImage, 0, 0, width, height);
    this.frozenFrame = canvas.toDataURL('image/gif');

    if (!this.isLoaded) {
      this.emit('sl-load');
      this.isLoaded = true;
    }
  }

  private handleError() {
    this.emit('sl-error');
  }

  // Shoelace's two `@watch` handlers. Its `watch` decorator runs a handler in `update()`, before the render, whenever the
  // watched property changed to a different value. `play` waits until the first update has finished.
  public handlePlayChange() {
    // When the animation starts playing, reset the src so it plays from the beginning. Since the src is cached, this
    // won't trigger another request.
    if (this.play) {
      this.animatedImage.src = '';
      this.animatedImage.src = this.src;
    }
  }

  public handleSrcChange() {
    this.isLoaded = false;
  }

  // The decorators are applied in declaration order, each wrapping the previous `update`, so Shoelace runs the `src`
  // handler (declared last, outermost) before the `play` one; the same order is kept here.
  protected override update(changed: PropertyValues<this>) {
    const differs = (key: 'src' | 'play') => changed.has(key as keyof VelcroAnimatedImage) && changed.get(key as keyof VelcroAnimatedImage) !== this[key];
    if (differs('src')) this.handleSrcChange();
    if (differs('play') && this.hasUpdated) this.handlePlayChange();
    super.update(changed);
  }

  protected override render() {
    return html`
      <div class="animated-image">
        <img
          class="animated-image__animated"
          src=${this.src}
          alt=${this.alt}
          crossorigin="anonymous"
          aria-hidden=${this.play ? 'false' : 'true'}
          @click=${this.handleClick}
          @load=${this.handleLoad}
          @error=${this.handleError}
        />

        ${this.isLoaded
          ? html`
              <img
                class="animated-image__frozen"
                src=${this.frozenFrame}
                alt=${this.alt}
                aria-hidden=${this.play ? 'true' : 'false'}
                @click=${this.handleClick}
              />

              <div part="control-box" class="animated-image__control-box">
                <slot name="play-icon"><sl-icon name="play-fill" library="system"></sl-icon></slot>
                <slot name="pause-icon"><sl-icon name="pause-fill" library="system"></sl-icon></slot>
              </div>
            `
          : ''}
      </div>
    `;
  }
}

export default VelcroAnimatedImage;
