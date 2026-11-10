// Portions of the API documentation wording in this file, the rendered structure (a `base` part with `role="img"` and
// the `avatar` / `avatar--*` class names around an `image` part, an `initials` part or an `icon` part whose `icon` slot
// falls back to the system library's `person-fill` <sl-icon>) and the behavior (the image error state that hides a
// broken image, emits `sl-error` and is reset by a new `image`, and the restore of the reflected `shape` when its
// attribute is removed) are adapted from Shoelace v2.20.1 (src/components/avatar/avatar.component.ts and
// src/internal/shoelace-element.ts), Copyright (c) 2020 A Beautiful Site, LLC, MIT License. See THIRD_PARTY_NOTICES.md.
// No Shoelace source file or runtime is included.
import { html, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { CoreAvatar } from '@charm-ux/core/dist/components/avatar/avatar.js';
import { ShoelaceCompat, restoreReflectedProperties } from '../../internal/shoelace-compat.js';
import { defineVelcroComponent, type VelcroComponentConstructor } from '../../utilities/registration.js';
import { VelcroIcon } from '../icon/class.js';
import styles from './avatar.styles.js';

/**
 * Avatars are used to represent a person or object. API modelled on Shoelace's `sl-avatar`. The default icon is an
 * `<sl-icon>` from the `system` icon library, as in Shoelace. Like Shoelace's, constructing an avatar defines its
 * dependency `<sl-icon>` (Velcro's) when no element owns that tag yet, so the class-only entry needs no extra step.
 *
 * Velcro extension inherited from core and kept: the non-bubbling `ready` event, emitted on the first update.
 *
 * @property {string} lang - The element's language, as set by the `lang` attribute or property. Not reflected.
 *
 * @tag sl-avatar
 * @status prototype
 *
 * @event sl-error - The image could not be loaded. This may because of an invalid URL, a temporary network condition, or some
 * unknown cause.
 *
 * @slot icon - The default icon to use when no image or initials are present. Works best with `<sl-icon>`.
 *
 * @csspart base - The component's base wrapper.
 * @csspart icon - The container that wraps the avatar's icon.
 * @csspart initials - The container that wraps the avatar's initials.
 * @csspart image - The avatar image. Only shown when the `image` attribute is set.
 *
 * @cssproperty [--size=3rem] - The size of the avatar.
 */
export class VelcroAvatar extends ShoelaceCompat(CoreAvatar, { lang: true, dir: true, reflected: 'read-all' }) {
  // Core's styles are replaced by Shoelace's own (see the styles file). Core's avatar styles make the host
  // `position: relative` and size the core markup with `--avatar-*` properties, and core's base styles add
  // `:host([hidden]) { display: none !important }`, focus outlines and form-control resets. Shoelace's avatar has none
  // of these: its `:host { display: inline-block }` wins over the browser's `[hidden]` rule (an upstream quirk).
  public static override styles = [styles];

  // Shoelace's `static dependencies` for the avatar: the elements its template renders. Shoelace keys them by tag; here
  // the tag is derived from each class's `baseName` (`sl-icon` for `VelcroIcon`), the same tag `defineVelcroComponent`
  // defines and the template renders. As in Shoelace's base element, each one that is not defined yet is defined when
  // an avatar is constructed, and a tag that another constructor already owns is left alone (with Shoelace's warning
  // when the versions differ). If the platform refuses the class itself (for example because it is already registered
  // under another tag), an anonymous subclass is defined instead, as Shoelace does. Core's own array-typed
  // `dependencies` (registration in core's scope) stays empty, as core's avatar declares it. Not part of the documented
  // API (Shoelace's manifest does not document it).
  private static readonly shoelaceDependencies: readonly VelcroComponentConstructor[] = [VelcroIcon];

  public constructor() {
    super();
    for (const component of VelcroAvatar.shoelaceDependencies) defineVelcroComponent(component);
  }

  @state() private hasError = false;

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

  // Core declares `image`, `label` and `initials` as reflected and undefined by default. Shoelace's are not reflected and
  // default to '', so they are redeclared here.
  /** The image source to use for the avatar. */
  @property()
  public override image = '';

  /** A label to use to describe the avatar to assistive devices. */
  @property()
  public override label = '';

  /** Initials to use as a fallback when no image is available (1-2 characters max recommended). */
  @property()
  public override initials = '';

  /** Indicates how the browser should load the image. */
  @property()
  public loading: 'eager' | 'lazy' = 'eager';

  /** The shape of the avatar. */
  @property({ reflect: true })
  public shape: 'circle' | 'square' | 'rounded' = 'circle';

  protected override willUpdate(changed: PropertyValues<this>) {
    super.willUpdate(changed);
    restoreReflectedProperties(this, changed);
    // Shoelace's `@watch('image')`: a new image resets the error state, so the next image is tried. It runs before the
    // render of the same update, as Shoelace's watcher does.
    if (changed.has('image') && changed.get('image') !== this.image) {
      this.hasError = false;
    }
  }

  private handleImageLoadError() {
    this.hasError = true;
    this.emit('sl-error');
  }

  // What is reused from core: the CharmElement base (scoping attribute, the `ready` event, `emit`), the `baseName` used
  // for registration and `render()`, which delegates to this hook. Core's markup (`avatar-*` parts, an `image` slot, a
  // `status-indicator` slot, a default slot and `--avatar-*` custom properties) is replaced because Shoelace's contract
  // is a `base` part with `role="img"` and the label, an `image`, `initials` or `icon` part and an `icon` slot.
  protected override avatarTemplate() {
    const avatarWithImage = html`
      <img
        part="image"
        class="avatar__image"
        src="${this.image}"
        loading="${this.loading}"
        alt=""
        @error="${this.handleImageLoadError}"
      />
    `;

    let avatarWithoutImage = html``;

    if (this.initials) {
      avatarWithoutImage = html`<div part="initials" class="avatar__initials">${this.initials}</div>`;
    } else {
      avatarWithoutImage = html`
        <div part="icon" class="avatar__icon" aria-hidden="true">
          <slot name="icon">
            <sl-icon name="person-fill" library="system"></sl-icon>
          </slot>
        </div>
      `;
    }

    return html`
      <div
        part="base"
        class=${classMap({
          avatar: true,
          'avatar--circle': this.shape === 'circle',
          'avatar--rounded': this.shape === 'rounded',
          'avatar--square': this.shape === 'square',
        })}
        role="img"
        aria-label=${this.label}
      >
        ${this.image && !this.hasError ? avatarWithImage : avatarWithoutImage}
      </div>
    `;
  }
}

export default VelcroAvatar;
