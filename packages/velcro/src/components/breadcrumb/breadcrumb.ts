// Adapted from Shoelace v2.20.1 (src/components/breadcrumb/breadcrumb.component.ts and the dependency definition and the
// `dir` and `lang` declarations in src/internal/shoelace-element.ts), Copyright (c) 2020 A Beautiful Site, LLC, MIT
// License. See THIRD_PARTY_NOTICES.md. The API documentation wording, the rendered structure (a `base` <nav> with the
// `breadcrumb` class and the default slot, then a hidden <span> holding the `separator` slot whose fallback is a system
// chevron <sl-icon>), the separator cloning (the first separator element is cloned into each item's `separator` slot with
// its ids removed and a `data-default` marker, replacing an earlier clone and leaving an item's own separator alone),
// `aria-current="page"` on the last item, the regeneration of the clones when the direction changes and the `label`
// property follow Shoelace. Velcro changes: built on the @charm-ux/core base element (core's breadcrumb is not used, see
// the class comment), and the dependency on <sl-icon> is defined when a breadcrumb is constructed through Velcro's
// registration helper rather than Shoelace's `static dependencies`. Shoelace's behavior is matched exactly, including its
// quirks; each one is marked "Upstream quirk" below and listed on the docs page.
import { html } from 'lit';
import { property, query } from 'lit/decorators.js';
import { CharmElement } from '@charm-ux/core/dist/base/charm-element/charm-element.js';
import { ShoelaceCompat } from '../../internal/shoelace-compat.js';
import { documentDir } from '../../internal/localize.js';
import { LocalizeController } from '../../utilities/localize.js';
import { defineVelcroComponent, type VelcroComponentConstructor } from '../../utilities/registration.js';
import type { VelcroBreadcrumbItem } from '../breadcrumb-item/class.js';
import { VelcroIcon } from '../icon/class.js';
import styles from './breadcrumb.styles.js';

// Built on the @charm-ux/core base element. Core's breadcrumb is not extended: its `label` defaults to `breadcrumb`, it
// wraps the slot in a `role="list"` element with `breadcrumb-base` / `breadcrumb-list` parts, and it marks the last item
// through core's item properties (`current` and a boolean `separator`) instead of cloning a separator element into each
// item and setting `aria-current` on the item, so its model conflicts with Shoelace's. The only core extension that
// remains is the non-bubbling `ready` event on first update.
/**
 * Breadcrumbs provide a group of links so users can easily navigate a website's hierarchy. API modelled on Shoelace's
 * `sl-breadcrumb`. Its default separator is an `<sl-icon>`, as in Shoelace; like Shoelace's, constructing a breadcrumb
 * defines its dependency `<sl-icon>` (Velcro's) when no element owns that tag yet, so the class-only entry needs no extra
 * step.
 *
 * Velcro extension inherited from the core base element and kept: the non-bubbling `ready` event, emitted on the first
 * update. Shoelace's breadcrumb has no events.
 *
 * @property {string} lang - The element's language, as set by the `lang` attribute or property. Not reflected.
 *
 * @tag sl-breadcrumb
 * @status prototype
 *
 * @dependency sl-icon
 *
 * @slot - One or more breadcrumb items to display.
 * @slot separator - The separator to use between breadcrumb items. Works best with `<sl-icon>`.
 *
 * @csspart base - The component's base wrapper.
 */
export class VelcroBreadcrumb extends ShoelaceCompat(CharmElement, { lang: true, dir: true }) {
  public static override baseName = 'breadcrumb';

  // Core's base styles are replaced by Shoelace's own (see the styles file).
  public static override styles = [styles];

  // Shoelace's `static dependencies` for the breadcrumb: the elements its template renders. Shoelace keys them by tag;
  // here the tag is derived from each class's `baseName` (`sl-icon` for `VelcroIcon`), the same tag
  // `defineVelcroComponent` defines and the template renders. As in Shoelace's base element, each one that is not
  // defined yet is defined when a breadcrumb is constructed, and a tag that another constructor already owns is left
  // alone (with Shoelace's warning when the versions differ). If the platform refuses the class itself (for example
  // because it is already registered under another tag), an anonymous subclass is defined instead, as Shoelace does.
  // Core's own array-typed `dependencies` (registration in core's scope) stays empty. Not part of the documented API
  // (Shoelace's manifest lists `dependencies` without a description).
  private static readonly shoelaceDependencies: readonly VelcroComponentConstructor[] = [VelcroIcon];

  public constructor() {
    super();
    for (const component of VelcroBreadcrumb.shoelaceDependencies) defineVelcroComponent(component);
  }

  // The localization controller re-renders the breadcrumb when the document's direction or language changes, which is
  // what regenerates the default separators for a new direction (see `render`).
  private readonly localize = new LocalizeController(this);

  // As in Shoelace, the direction when the element is constructed: for an element parsed with a `dir` attribute this is
  // still the document's direction, because the attribute is applied after the constructor.
  private separatorDir = this.direction();

  // Shoelace's public `@query('slot')` field: the default slot (the first slot in the shadow root).
  @query('slot')
  public defaultSlot!: HTMLSlotElement;

  // Shoelace's public `@query('slot[name="separator"]')` field: the separator slot.
  @query('slot[name="separator"]')
  public separatorSlot!: HTMLSlotElement;

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

  // Upstream quirk: the default is an empty string, which is still rendered, so the <nav> gets `aria-label=""` and no
  // accessible name unless `label` is set.
  /**
   * The label to use for the breadcrumb control. This will not be shown on the screen, but it will be announced by
   * screen readers and other assistive devices to provide more context for users.
   */
  @property()
  public label = '';

  // Shoelace's controller resolves the direction from the host's `dir` property, else the document's snapshot (`<html dir>`,
  // else ltr), lower-cased. Velcro's shared controller reads the host's `dir` attribute instead, which would miss a
  // direction set only through the property; this component's `dir` returns what was set, by attribute or property, so it
  // resolves the direction the way Shoelace does.
  private direction() {
    return `${this.dir || documentDir()}`.toLowerCase();
  }

  // Generates a clone of the separator element to use for each breadcrumb item
  // Upstream quirk: only the first element in the separator slot is used; any others are ignored.
  private getSeparator() {
    const separator = this.separatorSlot.assignedElements({ flatten: true })[0] as HTMLElement;

    // Clone it, remove ids, and slot it
    const clone = separator.cloneNode(true) as HTMLElement;
    [clone, ...clone.querySelectorAll('[id]')].forEach(el => el.removeAttribute('id'));
    clone.setAttribute('data-default', '');
    clone.slot = 'separator';

    return clone;
  }

  // Upstream quirk: this runs only when the default slot changes (and after a direction change). Replacing the separator
  // slot's content later does not update the items, and an item's `aria-current` is set on the item element itself.
  private handleSlotChange() {
    const items = [...this.defaultSlot.assignedElements({ flatten: true })].filter(
      item => item.tagName.toLowerCase() === 'sl-breadcrumb-item'
    ) as VelcroBreadcrumbItem[];

    items.forEach((item, index) => {
      // Append separators to each item if they don't already have one
      const separator = item.querySelector('[slot="separator"]');
      if (separator === null) {
        // No separator exists, add one
        item.append(this.getSeparator());
      } else if (separator.hasAttribute('data-default')) {
        // A default separator exists, replace it
        separator.replaceWith(this.getSeparator());
      } else {
        // The user provided a custom separator, leave it alone
      }

      // The last breadcrumb item is the "current page"
      if (index === items.length - 1) {
        item.setAttribute('aria-current', 'page');
      } else {
        item.removeAttribute('aria-current');
      }
    });
  }

  protected override render() {
    void this.localize;
    // We clone the separator and inject them into breadcrumb items, so we need to regenerate the default ones when
    // directionality changes. We do this by storing the current separator direction, waiting for render, then calling
    // the function that regenerates them.
    if (this.separatorDir !== this.direction()) {
      this.separatorDir = this.direction();
      this.updateComplete.then(() => this.handleSlotChange());
    }

    return html`
      <nav part="base" class="breadcrumb" aria-label=${this.label}>
        <slot @slotchange=${this.handleSlotChange}></slot>
      </nav>

      <span hidden aria-hidden="true">
        <slot name="separator">
          <sl-icon name=${this.direction() === 'rtl' ? 'chevron-left' : 'chevron-right'} library="system"></sl-icon>
        </slot>
      </span>
    `;
  }
}

export default VelcroBreadcrumb;
