// Adapted from Shoelace v2.20.1 (src/components/icon-button/icon-button.component.ts and the reflected-property restore in
// src/internal/shoelace-element.ts), Copyright (c) 2020 A Beautiful Site, LLC, MIT License. See THIRD_PARTY_NOTICES.md.
// The API documentation wording, the rendered structure (a `base` <button> or <a> around an <sl-icon>, with the
// `icon-button` / `icon-button--*` class names), the focus handling and the link attributes follow Shoelace. Velcro
// changes: built on the @charm-ux/core base element (there is no core icon button), and the dependency on <sl-icon> is
// defined when an icon button is constructed rather than through Shoelace's `static dependencies` (see the class).
import { type PropertyValues } from 'lit';
import { html, literal } from 'lit/static-html.js';
import { property, query, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { CharmElement } from '@charm-ux/core/dist/base/charm-element/charm-element.js';
import { defineVelcroComponent, type VelcroComponentConstructor } from '../../utilities/registration.js';
import { VelcroIcon } from '../icon/class.js';
import styles from './icon-button.styles.js';

/**
 * Icons buttons are simple, icon-only buttons that can be used for actions and in toolbars. API modelled on Shoelace's
 * `sl-icon-button`. There is no core counterpart, so it extends the core base element. It renders an `<sl-icon>`, as in
 * Shoelace; like Shoelace's, constructing an icon button defines its dependency `<sl-icon>` (Velcro's) when no element
 * owns that tag yet, so the class-only entry needs no extra step.
 *
 * Velcro extension inherited from the core base element and kept: the non-bubbling `ready` event, emitted on the first
 * update. Shoelace's icon button does not emit it.
 *
 * @tag sl-icon-button
 * @status prototype
 *
 * @event sl-blur - Emitted when the icon button loses focus.
 * @event sl-focus - Emitted when the icon button gains focus.
 *
 * @csspart base - The component's base wrapper.
 */
export class VelcroIconButton extends CharmElement {
  public static override baseName = 'icon-button';

  // The core base styles are replaced by Shoelace's own (see the styles file). Core's add a `:host([hidden]) { display:
  // none !important }` rule, focus outlines and form-control resets that Shoelace's icon button does not have.
  public static override styles = [styles];

  // Shoelace's `static dependencies` for the icon button: the elements its template renders. Shoelace keys them by tag;
  // here the tag is derived from each class's `baseName` (`sl-icon` for `VelcroIcon`), the same tag `defineVelcroComponent`
  // defines and the template renders. As in Shoelace's base element, each one that is not defined yet is defined when an
  // icon button is constructed, and a tag that another constructor already owns is left alone. If the platform refuses the
  // class itself (for example because it is already registered under another tag), an anonymous subclass is defined
  // instead, as Shoelace does. Core's own array-typed `dependencies` (registration in core's scope) stays empty. Not part of
  // the documented API (Shoelace's manifest lists `dependencies` without a description).
  private static readonly shoelaceDependencies: readonly VelcroComponentConstructor[] = [VelcroIcon];

  public constructor() {
    super();
    for (const component of VelcroIconButton.shoelaceDependencies) {
      if (customElements.get(`sl-${component.baseName}`)) continue;
      try {
        defineVelcroComponent(component);
      } catch {
        defineVelcroComponent(class extends component {});
      }
    }
  }

  // Shoelace's base element restores a reflected property's initial value when its attribute is removed (see
  // attributeChangedCallback). `disabled` is the only reflected property here.
  private readonly initialReflectedProperties = new Map<string, unknown>();
  private hasRecordedInitialProperties = false;

  /** The rendered native `<button>`, or `<a>` when `href` is set. */
  @query('.icon-button')
  public button!: HTMLButtonElement | HTMLLinkElement;

  @state() private hasFocus = false;

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

  /** The name of the icon to draw. Available names depend on the icon library being used. */
  @property()
  public name?: string;

  /** The name of a registered custom icon library. */
  @property()
  public library?: string;

  /**
   * An external URL of an SVG file. Be sure you trust the content you are including, as it will be executed as code and
   * can result in XSS attacks.
   */
  @property()
  public src?: string;

  /** When set, the underlying button will be rendered as an `<a>` with this `href` instead of a `<button>`. */
  @property()
  public href?: string;

  /** Tells the browser where to open the link. Only used when `href` is set. */
  @property()
  public target?: '_blank' | '_parent' | '_self' | '_top';

  /** Tells the browser to download the linked file as this filename. Only used when `href` is set. */
  @property()
  public download?: string;

  /**
   * A description that gets read by assistive devices. For optimal accessibility, you should always include a label
   * that describes what the icon button does.
   */
  @property()
  public label = '';

  /** Disables the button. */
  @property({ type: Boolean, reflect: true })
  public disabled = false;

  // Records the reflected properties' values the first time any attribute changes (during upgrade, before the
  // attribute values are applied), so that removing a reflected attribute later restores that value instead of
  // leaving the property null. Same timing and rule as Shoelace's base element.
  public override attributeChangedCallback(name: string, previous: string | null, next: string | null) {
    if (!this.hasRecordedInitialProperties) {
      (this.constructor as typeof VelcroIconButton).elementProperties.forEach((options, prop) => {
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
      if (changed.has(prop as keyof VelcroIconButton) && self[prop] == null) {
        self[prop] = value;
      }
    });
  }

  private handleBlur() {
    this.hasFocus = false;
    this.emit('sl-blur');
  }

  private handleFocus() {
    this.hasFocus = true;
    this.emit('sl-focus');
  }

  private handleClick(event: MouseEvent) {
    if (this.disabled) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  /**
   * Simulates a click on the icon button. As in Shoelace it clicks the inner native button or link, so a disabled button
   * emits no click, and it throws a `TypeError` before the first render, when there is no inner element yet.
   */
  public override click() {
    this.button.click();
  }

  /** Sets focus on the icon button. */
  public override focus(options?: FocusOptions) {
    this.button.focus(options);
  }

  /** Removes focus from the icon button. */
  public override blur() {
    this.button.blur();
  }

  protected override render() {
    const isLink = this.href ? true : false;
    const tag = isLink ? literal`a` : literal`button`;

    /* eslint-disable lit/binding-positions, lit/no-invalid-html */
    return html`
      <${tag}
        part="base"
        class=${classMap({
          'icon-button': true,
          'icon-button--disabled': !isLink && this.disabled,
          'icon-button--focused': this.hasFocus,
        })}
        ?disabled=${ifDefined(isLink ? undefined : this.disabled)}
        type=${ifDefined(isLink ? undefined : 'button')}
        href=${ifDefined(isLink ? this.href : undefined)}
        target=${ifDefined(isLink ? this.target : undefined)}
        download=${ifDefined(isLink ? this.download : undefined)}
        rel=${ifDefined(isLink && this.target ? 'noreferrer noopener' : undefined)}
        role=${ifDefined(isLink ? undefined : 'button')}
        aria-disabled=${this.disabled ? 'true' : 'false'}
        aria-label="${this.label}"
        tabindex=${this.disabled ? '-1' : '0'}
        @blur=${this.handleBlur}
        @focus=${this.handleFocus}
        @click=${this.handleClick}
      >
        <sl-icon
          class="icon-button__icon"
          name=${ifDefined(this.name)}
          library=${ifDefined(this.library)}
          src=${ifDefined(this.src)}
          aria-hidden="true"
        ></sl-icon>
      </${tag}>
    `;
    /* eslint-enable lit/binding-positions, lit/no-invalid-html */
  }
}

export default VelcroIconButton;
