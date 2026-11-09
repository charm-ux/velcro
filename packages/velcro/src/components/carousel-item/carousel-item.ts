// Adapted from Shoelace v2.20.1 (src/components/carousel-item/carousel-item.component.ts), Copyright (c) 2020 A Beautiful
// Site, LLC, MIT License. See THIRD_PARTY_NOTICES.md. The API documentation wording and the rendered structure (one
// default slot) follow Shoelace. Velcro changes: built on the @charm-ux/core base element (core has no carousel
// component), with `dir` and `lang` declared as Shoelace's base element declares them. Shoelace's behavior is matched
// exactly.
import { html } from 'lit';
import { property } from 'lit/decorators.js';
import { CharmElement } from '@charm-ux/core/dist/base/charm-element/charm-element.js';
import styles from './carousel-item.styles.js';

/**
 * A carousel item represent a slide within a carousel. API modelled on Shoelace's `sl-carousel-item`.
 *
 * Built on the @charm-ux/core base element: core has no carousel component, so the only core extension is the
 * non-bubbling `ready` event on first update.
 *
 * @tag sl-carousel-item
 * @status prototype
 *
 * @slot - The carousel item's content.
 *
 * @cssproperty --aspect-ratio - The slide's aspect ratio. Inherited from the carousel by default.
 */
export class VelcroCarouselItem extends CharmElement {
  public static override baseName = 'carousel-item';

  // Core's base styles are replaced by Shoelace's own (see the styles file).
  public static override styles = [styles];

  // Shoelace's base element restores a reflected property's initial value when its attribute is removed. The carousel
  // item has no reflected property, so nothing is ever restored and no hook is needed.

  private velcroDir?: string;

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

  protected override render() {
    return html` <slot></slot> `;
  }
}

export default VelcroCarouselItem;
