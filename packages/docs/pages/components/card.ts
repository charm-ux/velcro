import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { definePageData } from '@beatzball/litro';
import { shell, shellStyles } from '../../src/shell.js';
import { examples, exampleDocument } from '../../src/example.js';

export const pageData = definePageData(async () => ({
  seoTitle: 'Card - Velcro',
  seoHead: '<meta name="description" content="Velcro card (prototype).">',
}));

const slots: Array<[string, string]> = [
  ['(default)', "The card's main content."],
  ['header', 'An optional header for the card.'],
  ['footer', 'An optional footer for the card.'],
  ['image', 'An optional image to render at the start of the card.'],
];

const parts: Array<[string, string]> = [
  ['base', "The component's base wrapper."],
  ['image', "The container that wraps the card's image."],
  ['header', "The container that wraps the card's header."],
  ['body', "The container that wraps the card's main content."],
  ['footer', "The container that wraps the card's footer."],
];

const cssProperties: Array<[string, string, string]> = [
  ['--border-color', 'var(--sl-color-neutral-200)', "The card's border color, including borders that occur inside the card."],
  ['--border-radius', 'var(--sl-border-radius-medium)', 'The border radius for the card\'s edges.'],
  ['--border-width', '1px', "The width of the card's borders."],
  ['--padding', 'var(--sl-spacing-large)', "The padding to use for the card's sections."],
];

const gaps = [
  'The original Shoelace examples that use sl-rating and sl-icon-button (the overview, header and footer cards) are ported without those elements: sl-rating and sl-icon-button do not exist in Velcro. The remote images are replaced by inline placeholder images.',
  'The card has no host or base role and no other ARIA; header, footer and image sections are plain slots with no landmark semantics, as in Shoelace. Accessibility was not evaluated beyond that.',
  'The header, footer and image sections appear when a direct child carries the matching slot attribute at render time and on slotchange. Adding a slotted child with no later slotchange (for example removing the attribute from an existing child) is not covered by a test.',
  'The inherited core card properties (heading, subheading, media-position), the core parts (card-base, card-header, card-heading, card-subheading, card-media, card-content, card-footer), the core "media", "heading" and "subheading" slots and the "--card-*" custom properties are present through core but have no effect: the core markup is replaced by the Shoelace structure.',
  'Registration is browser-only and uses the native custom element registry for Velcro\'s own class, without changing the shared core prefix. Scope-dependent core features are not supported and server-side rendering is not supported. A class-only entry (@charm-ux/velcro/card/class, with the SlCard alias) exists and registers nothing.',
  'Rendering was checked by computed-style assertions in Chromium only; there is no pixel comparison against Shoelace, and no Firefox, WebKit, RTL or localization check.',
  'Only the light theme exists, and the theme must be loaded: the card reads --sl-color-neutral-200, --sl-border-radius-medium, --sl-spacing-large, --sl-panel-background-color and --sl-shadow-x-small. Dark and the full token set are not done.',
];

@customElement('page-components-card')
export class CardPage extends LitElement {
  static override styles = [shellStyles];

  override render() {
    const source = examples['card/basic'];
    return shell(html`
      <h1>Card</h1>
      <p><code>&lt;sl-card&gt;</code> is registered by <code>@charm-ux/velcro</code> on top of the <code>@charm-ux/core</code> card. Prototype status: unreleased.</p>
      <p>Cards can be used to group related subjects in a container.</p>

      <h2 id="examples">Examples</h2>
      <p>A basic card, a card with a header, a card with a footer, a card with an image, and an overview card combining an image, content and a footer.</p>
      <iframe class="example" title="Card example" srcdoc=${exampleDocument(source)}></iframe>
      <pre><code>${source}</code></pre>

      <h2 id="attributes">Attributes and properties</h2>
      <p>None.</p>

      <h2 id="slots">Slots</h2>
      <table>
        <thead><tr><th>Name</th><th>Description</th></tr></thead>
        <tbody>
          ${slots.map(([n, d]) => html`<tr><td><code>${n}</code></td><td>${d}</td></tr>`)}
        </tbody>
      </table>

      <h2 id="parts">CSS parts</h2>
      <table>
        <thead><tr><th>Name</th><th>Description</th></tr></thead>
        <tbody>
          ${parts.map(([n, d]) => html`<tr><td><code>${n}</code></td><td>${d}</td></tr>`)}
        </tbody>
      </table>

      <h2 id="css-properties">CSS custom properties</h2>
      <table>
        <thead><tr><th>Name</th><th>Default</th><th>Description</th></tr></thead>
        <tbody>
          ${cssProperties.map(([n, v, d]) => html`<tr><td><code>${n}</code></td><td><code>${v}</code></td><td>${d}</td></tr>`)}
        </tbody>
      </table>

      <h2 id="events">Events</h2>
      <p>None.</p>

      <h2 id="not-implemented">Not implemented or unverified</h2>
      <ul>
        ${gaps.map(g => html`<li>${g}</li>`)}
      </ul>
    `);
  }
}

export default CardPage;
