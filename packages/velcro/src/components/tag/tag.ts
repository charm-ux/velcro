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
export class VelcroTag extends CharmElement {
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

  // Shoelace's base element restores a reflected property's initial value when its attribute is removed (see
  // attributeChangedCallback). `variant`, `size` and `pill` are the reflected properties here.
  private readonly initialReflectedProperties = new Map<string, unknown>();
  private hasRecordedInitialProperties = false;

  private readonly localize = new LocalizeController(this);

  // Shoelace's base element declares `lang` and `dir` as reactive properties with no initial value and no reflection,
  // which also makes them observed attributes. Without the `lang` declaration, `lang` would be the native one, which
  // reflects: assigning it would change the attribute and reading it would give '' instead of undefined. Core declares
  // `dir` as a reactive property whose getter computes the direction (`ltr` or `rtl`) when it is unset or `auto`;
  // Shoelace's returns the value as set (undefined when unset), so the accessor is replaced.
  // Types: Shoelace declares `dir: string`. The setter accepts any string, as Shoelace's does. The getter must keep core's
  // declared type, because TypeScript does not let a subclass widen an inherited property's read type; at runtime it
  // returns whatever was set.
  /** The element's language, as set by the `lang` attribute or property. Not reflected. */
  @property()
  public override lang!: string;

  private shoelaceDir?: string;

  /**
   * The element's text direction, as set by the `dir` attribute or property and returned as set. Not reflected. Any
   * string can be assigned; the declared read type stays core's `'ltr' | 'rtl' | 'auto'`.
   */
  @property()
  public override get dir(): 'ltr' | 'rtl' | 'auto' {
    return this.shoelaceDir as 'ltr' | 'rtl' | 'auto';
  }

  public override set dir(value: string) {
    this.shoelaceDir = value;
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

  // Records the reflected properties' values the first time any attribute changes (during upgrade, before the
  // attribute values are applied), so that removing a reflected attribute later restores that value instead of
  // leaving the property null. Same timing and rule as Shoelace's base element.
  public override attributeChangedCallback(name: string, previous: string | null, next: string | null) {
    if (!this.hasRecordedInitialProperties) {
      (this.constructor as typeof VelcroTag).elementProperties.forEach((options, prop) => {
        const current = (this as unknown as Record<PropertyKey, unknown>)[prop];
        if (options.reflect && current != null) {
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
      if (changed.has(prop as keyof VelcroTag) && self[prop] == null) {
        self[prop] = value;
      }
    });
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
