// Portions of the API documentation wording in this file and the rendered structure (a `div` with the `base` part
// around `image`, `header`, `body` and `footer` slots, and the `card` / `card--has-*` class names) are adapted from
// Shoelace v2.20.1 (src/components/card/card.component.ts), Copyright (c) 2020 A Beautiful Site, LLC, MIT License.
// See THIRD_PARTY_NOTICES.md. No Shoelace source file or runtime is included.
import { html } from 'lit';
import { classMap } from 'lit/directives/class-map.js';
import { CoreCard } from '@charm-ux/core/dist/components/card/card.js';
import { HasSlotController } from '@charm-ux/core/dist/controller/index.js';
import styles from './card.styles.js';

/**
 * Cards can be used to group related subjects in a container. API modelled on Shoelace's `sl-card`.
 *
 * @tag sl-card
 * @status prototype
 *
 * @slot - The card's main content.
 * @slot header - An optional header for the card.
 * @slot footer - An optional footer for the card.
 * @slot image - An optional image to render at the start of the card.
 *
 * @csspart base - The component's base wrapper.
 * @csspart image - The container that wraps the card's image.
 * @csspart header - The container that wraps the card's header.
 * @csspart body - The container that wraps the card's main content.
 * @csspart footer - The container that wraps the card's footer.
 *
 * @cssproperty --border-color - The card's border color, including borders that occur inside the card.
 * @cssproperty --border-radius - The border radius for the card's edges.
 * @cssproperty --border-width - The width of the card's borders.
 * @cssproperty --padding - The padding to use for the card's sections.
 */
export class VelcroCard extends CoreCard {
  public static override styles = [...super.styles, styles];

  // Core's own controller watches core's slots (media, footer, heading, subheading); Shoelace's are different.
  private readonly shoelaceSlots = new HasSlotController(this, 'footer', 'header', 'image');

  // Core's article markup, `card-*` parts, `heading` / `subheading` / `media-position` properties and `--card-*`
  // custom properties are replaced by Shoelace's structure; they remain on the element but have no effect.
  protected override cardTemplate() {
    return html`
      <div
        part="base"
        class=${classMap({
          card: true,
          'card--has-footer': this.shoelaceSlots.test('footer'),
          'card--has-image': this.shoelaceSlots.test('image'),
          'card--has-header': this.shoelaceSlots.test('header'),
        })}
      >
        <slot name="image" part="image" class="card__image"></slot>
        <slot name="header" part="header" class="card__header"></slot>
        <slot part="body" class="card__body"></slot>
        <slot name="footer" part="footer" class="card__footer"></slot>
      </div>
    `;
  }
}

export default VelcroCard;
