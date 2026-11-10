// Adapted from Shoelace v2.20.1 (src/components/breadcrumb-item/breadcrumb-item.component.ts and the `dir` and `lang`
// declarations in src/internal/shoelace-element.ts), Copyright (c) 2020 A Beautiful Site, LLC, MIT License. See
// THIRD_PARTY_NOTICES.md. The API documentation wording, the rendered structure (a `base` <div> with the
// `breadcrumb-item` / `breadcrumb-item--has-*` class names around the `prefix` container, a `label` that is a <button>,
// an <a> or a <div>, the `suffix` container and the `separator` container), the choice of the label element (`href`
// first, then a slotted <sl-dropdown>, else a button), the link's `href`, `target` and `rel` attributes, `hrefChanged`
// and `handleSlotChange` follow Shoelace. Velcro changes: built on the @charm-ux/core base element (core's breadcrumb
// item is not used, see the class comment) and Shoelace's `@watch('href', { waitUntilFirstUpdate: true })` handler runs
// from `update()`. Shoelace's behavior is matched exactly, including its quirks; each one is marked "Upstream quirk"
// below and listed on the docs page.
import { html, type PropertyValues } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { CharmElement } from '@charm-ux/core/dist/base/charm-element/charm-element.js';
import { ShoelaceCompat } from '../../internal/shoelace-compat.js';
import { HasSlotController } from '../../internal/slot.js';
import styles from './breadcrumb-item.styles.js';

// Built on the @charm-ux/core base element. Core's breadcrumb item is not extended: it is a focusable element that always
// renders a link, reflects `href`, `current` and a boolean `separator` attribute that its breadcrumb toggles, adds a
// `referrerpolicy` attribute and a `click()` that clicks the link, and has core's `start`/`end` slots and
// `breadcrumb-item-*` parts. Shoelace's item renders a button, a link or a dropdown wrapper, reflects nothing, and its
// separator is an element the breadcrumb clones into the item's `separator` slot, so the two models conflict. The only
// core extension that remains is the non-bubbling `ready` event on first update.
/**
 * Breadcrumb Items are used inside [breadcrumbs](/components/breadcrumb) to represent different links. API modelled on
 * Shoelace's `sl-breadcrumb-item`. It renders no other Velcro element.
 *
 * Velcro extension inherited from the core base element and kept: the non-bubbling `ready` event, emitted on the first
 * update. Shoelace's breadcrumb item has no events.
 *
 * @property {string} lang - The element's language, as set by the `lang` attribute or property. Not reflected.
 *
 * @tag sl-breadcrumb-item
 * @status prototype
 *
 * @slot - The breadcrumb item's label.
 * @slot prefix - An optional prefix, usually an icon or icon button.
 * @slot suffix - An optional suffix, usually an icon or icon button.
 * @slot separator - The separator to use for the breadcrumb item. This will only change the separator for this item. If
 * you want to change it for all items in the group, set the separator on `<sl-breadcrumb>` instead.
 *
 * @csspart base - The component's base wrapper.
 * @csspart label - The breadcrumb item's label.
 * @csspart prefix - The container that wraps the prefix.
 * @csspart suffix - The container that wraps the suffix.
 * @csspart separator - The container that wraps the separator.
 */
export class VelcroBreadcrumbItem extends ShoelaceCompat(CharmElement, { lang: true, dir: true }) {
  public static override baseName = 'breadcrumb-item';

  // Core's base styles are replaced by Shoelace's own (see the styles file).
  public static override styles = [styles];

  private readonly hasSlotController = new HasSlotController(this, 'prefix', 'suffix');

  // Shoelace's public `@query('slot:not([name])')` field: the default slot.
  @query('slot:not([name])')
  public defaultSlot!: HTMLSlotElement;

  // Upstream quirk: the render type starts as `button` and is only recomputed when the default slot reports a change or
  // `href` changes after the first update, so an item that has `href` from the start renders a button until its label's
  // `slotchange` arrives, and one with `href` but no label content keeps the button.
  @state() private renderType: 'button' | 'link' | 'dropdown' = 'button';

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
   * Optional URL to direct the user to when the breadcrumb item is activated. When set, a link will be rendered
   * internally. When unset, a button will be rendered instead.
   */
  @property()
  public href?: string;

  /** Tells the browser where to open the link. Only used when `href` is set. */
  @property()
  public target?: '_blank' | '_parent' | '_self' | '_top';

  /** The `rel` attribute to use on the link. Only used when `href` is set. */
  @property()
  public rel = 'noreferrer noopener';

  private setRenderType() {
    const hasDropdown =
      this.defaultSlot.assignedElements({ flatten: true }).filter(i => i.tagName.toLowerCase() === 'sl-dropdown').length > 0;

    if (this.href) {
      this.renderType = 'link';
      return;
    }

    if (hasDropdown) {
      this.renderType = 'dropdown';
      return;
    }

    this.renderType = 'button';
  }

  // Shoelace's `@watch('href', { waitUntilFirstUpdate: true })`: runs before the render, after the first update only.
  protected override update(changed: PropertyValues<this>) {
    if (this.hasUpdated && changed.has('href') && changed.get('href') !== this.href) {
      this.hrefChanged();
    }
    super.update(changed);
  }

  public hrefChanged() {
    this.setRenderType();
  }

  public handleSlotChange() {
    this.setRenderType();
  }

  protected override render() {
    return html`
      <div
        part="base"
        class=${classMap({
          'breadcrumb-item': true,
          'breadcrumb-item--has-prefix': this.hasSlotController.test('prefix'),
          'breadcrumb-item--has-suffix': this.hasSlotController.test('suffix'),
        })}
      >
        <span part="prefix" class="breadcrumb-item__prefix">
          <slot name="prefix"></slot>
        </span>

        ${this.renderType === 'link'
          ? html`
              <a
                part="label"
                class="breadcrumb-item__label breadcrumb-item__label--link"
                href="${this.href!}"
                target="${ifDefined(this.target ? this.target : undefined)}"
                rel=${ifDefined(this.target ? this.rel : undefined)}
              >
                <slot @slotchange=${this.handleSlotChange}></slot>
              </a>
            `
          : ''}
        ${this.renderType === 'button'
          ? html`
              <button part="label" type="button" class="breadcrumb-item__label breadcrumb-item__label--button">
                <slot @slotchange=${this.handleSlotChange}></slot>
              </button>
            `
          : ''}
        ${this.renderType === 'dropdown'
          ? html`
              <div part="label" class="breadcrumb-item__label breadcrumb-item__label--drop-down">
                <slot @slotchange=${this.handleSlotChange}></slot>
              </div>
            `
          : ''}

        <span part="suffix" class="breadcrumb-item__suffix">
          <slot name="suffix"></slot>
        </span>

        <span part="separator" class="breadcrumb-item__separator" aria-hidden="true">
          <slot name="separator"></slot>
        </span>
      </div>
    `;
  }
}

export default VelcroBreadcrumbItem;
