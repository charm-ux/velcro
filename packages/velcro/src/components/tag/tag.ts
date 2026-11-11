// Adapted from Shoelace v2.20.1 (src/components/tag/tag.component.ts and the reflected-property restore in
// src/internal/shoelace-element.ts), Copyright (c) 2020 A Beautiful Site, LLC, MIT License. See THIRD_PARTY_NOTICES.md.
// The API documentation wording, the rendered structure (a `base` <span> with the `tag` / `tag--*` class names around a
// `content` slot and, when removable, an `<sl-icon-button>` remove button) and the `sl-remove` event follow Shoelace.
// Velcro changes: built on the @charm-ux/core base element (there is no core tag), and the dependency on
// <sl-icon-button> is defined when a tag is constructed rather than through Shoelace's `static dependencies` (see the
// class).
import { html, type PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { CharmElement } from '@charm-ux/core/dist/base/charm-element/charm-element.js';
import { ShoelaceCompat, restoreReflectedProperties } from '../../internal/shoelace-compat.js';
import { defineVelcroComponent, type VelcroComponentConstructor } from '../../utilities/registration.js';
import { LocalizeController } from '../../utilities/localize.js';
import { VelcroIconButton } from '../icon-button/class.js';
import styles from './tag.styles.js';

/**
 * Tags are used as labels to organize things or to indicate a selection. API modelled on Shoelace's `sl-tag`. There is no
 * core counterpart, so it extends the core base element. A removable tag renders an `<sl-icon-button>`, as in Shoelace;
 * like Shoelace's, constructing a tag defines its dependency `<sl-icon-button>` (Velcro's) when no element owns that tag
 * yet, so the class-only entry needs no extra step.
 *
 * Velcro extension inherited from the core base element and kept: the non-bubbling `ready` event, emitted on the first
 * update. Shoelace's tag does not emit it.
 *
 * @property {string} lang - The element's language, as set by the `lang` attribute or property. Not reflected.
 *
 * @tag sl-tag
 * @status prototype
 *
 * @slot - The tag's content.
 *
 * @event sl-remove - Emitted when the remove button is activated.
 *
 * @csspart base - The component's base wrapper.
 * @csspart content - The tag's content.
 * @csspart remove-button - The tag's remove button, an `<sl-icon-button>`.
 * @csspart remove-button__base - The remove button's exported `base` part.
 */
export class VelcroTag extends ShoelaceCompat(CharmElement, { lang: true, dir: true, reflected: 'read-all' }) {
  public static override baseName = 'tag';

  // The core base styles are replaced by Shoelace's own (see the styles file). Core's add a `:host([hidden]) { display:
  // none !important }` rule, focus outlines and form-control resets that Shoelace's tag does not have.
  public static override styles = [styles];

  // Shoelace's `static dependencies` for the tag: the elements its template renders. Shoelace keys them by tag; here
  // the tag is derived from each class's `baseName` (`sl-icon-button` for `VelcroIconButton`), the same tag
  // `defineVelcroComponent` defines and the template renders. As in Shoelace's base element, each one that is not
  // defined yet is defined when a tag is constructed, and a tag that another constructor already owns is left alone
  // (with Shoelace's warning when the versions differ). If the platform refuses the class itself (for example because
  // it is already registered under another tag), an anonymous subclass is defined instead, as Shoelace does. The icon
  // button in turn defines `<sl-icon>` when it is constructed. Core's own array-typed `dependencies` (registration in
  // core's scope) stays empty. Not part of the documented API (Shoelace's manifest lists `dependencies` without a
  // description).
  private static readonly shoelaceDependencies: readonly VelcroComponentConstructor[] = [VelcroIconButton];

  public constructor() {
    super();
    for (const component of VelcroTag.shoelaceDependencies) defineVelcroComponent(component);
  }

  private readonly localize = new LocalizeController(this);

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

  /** The tag's theme variant. */
  @property({ reflect: true })
  public variant: 'primary' | 'success' | 'neutral' | 'warning' | 'danger' | 'text' = 'neutral';

  /** The tag's size. */
  @property({ reflect: true })
  public size: 'small' | 'medium' | 'large' = 'medium';

  /** Draws a pill-style tag with rounded edges. */
  @property({ type: Boolean, reflect: true })
  public pill = false;

  /** Makes the tag removable and shows a remove button. */
  @property({ type: Boolean })
  public removable = false;

  protected override willUpdate(changed: PropertyValues<this>) {
    super.willUpdate(changed);
    restoreReflectedProperties(this, changed);
  }

  private handleRemoveClick() {
    this.emit('sl-remove');
  }

  protected override render() {
    return html`
      <span
        part="base"
        class=${classMap({
          tag: true,

          // Types
          'tag--primary': this.variant === 'primary',
          'tag--success': this.variant === 'success',
          'tag--neutral': this.variant === 'neutral',
          'tag--warning': this.variant === 'warning',
          'tag--danger': this.variant === 'danger',
          'tag--text': this.variant === 'text',

          // Sizes
          'tag--small': this.size === 'small',
          'tag--medium': this.size === 'medium',
          'tag--large': this.size === 'large',

          // Modifiers
          'tag--pill': this.pill,
          'tag--removable': this.removable,
        })}
      >
        <slot part="content" class="tag__content"></slot>

        ${this.removable
          ? html`
              <sl-icon-button
                part="remove-button"
                exportparts="base:remove-button__base"
                name="x-lg"
                library="system"
                label=${this.localize.term('remove')}
                class="tag__remove"
                @click=${this.handleRemoveClick}
                tabindex="-1"
              ></sl-icon-button>
            `
          : ''}
      </span>
    `;
  }
}

export default VelcroTag;
