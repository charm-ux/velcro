import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { definePageData } from '@beatzball/litro';
import { docsShell, shellStyles } from '../../src/shell.js';
import { themeHead } from '../../src/theme.js';
import { examples, exampleDocument } from '../../src/example.js';

export const pageData = definePageData(async () => ({
  seoTitle: 'Card - Velcro',
  seoHead: themeHead + '<meta name="description" content="Velcro card (prototype).">',
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
  'The card sets no role or other ARIA on the host or the base part (the browser spec checks that none is present), as in Shoelace. The header, footer and image sections are plain slots without landmark semantics. Screen reader behavior and color contrast were not evaluated.',
  'The ready event is a divergence: it comes from the core base element and Shoelace\'s card emits no events. It is emitted once, without bubbling, after the first render; the browser spec checks that it is the only event the card dispatches while it renders and while its slotted content changes.',
  'The inherited core card properties heading, subheading and media-position (and the reflected media-position attribute) are still declared on the element but have no effect; the browser spec checks that setting them changes nothing. The core markup, the core "card-*" parts and the core "media", "heading" and "subheading" slots are not rendered, so content with those slot names is not displayed. The core card styles are not applied, so the core "--card-*" custom properties are not defined and do nothing.',
  "The host hidden attribute hides the card, because the core base styles add :host([hidden]) { display: none !important }; the browser spec checks this. In Shoelace 2.20.1 the shared component styles only hide [hidden] elements inside the shadow root, and the card's :host display rule overrides the browser's default hidden rule, so the attribute alone does not hide an sl-card there (derived from its source and the CSS cascade; Shoelace itself was not run).",
  "The core base styles set box-sizing: border-box on the host and on every element in the shadow tree, whereas Shoelace sets it on the host and lets the shadow elements inherit it. The default rendering is the same. If an author sets box-sizing on sl-card, Shoelace's internal elements follow it but Velcro's stay border-box: with box-sizing: content-box on the host and an explicit width on a padded part such as ::part(body), the padding stays inside that width here (the browser spec checks this) and would be added to it in Shoelace (derived from its source; Shoelace itself was not run).",
  'Registration is browser-only and uses the native custom element registry for Velcro\'s own class, without changing the shared core prefix. Scope-dependent core features are not supported and server-side rendering is not supported. A class-only entry (@charm-ux/velcro/card/class, with the SlCard alias) exists and registers nothing; the browser regression for class-only entries checks that.',
  'Rendering was checked by computed-style assertions in Chromium only; there is no pixel comparison against Shoelace, and no Firefox, WebKit, RTL or localization check.',
  'Only the light theme exists, and the theme must be loaded: the card reads --sl-color-neutral-200, --sl-border-radius-medium, --sl-spacing-large, --sl-panel-background-color and --sl-shadow-x-small. Dark and the full token set are not done.',
];

@customElement('page-components-card')
export class CardPage extends LitElement {
  static override styles = [shellStyles];

  override render() {
    const source = examples['card/basic'];
    return docsShell('card', html`
      <h1>Card</h1>
      <p><code>&lt;sl-card&gt;</code> is registered by <code>@charm-ux/velcro</code> on top of the <code>@charm-ux/core</code> card. Prototype status: unreleased.</p>
      <p>Cards can be used to group related subjects in a container.</p>

      <h2 id="examples">Examples</h2>
      <p>A basic card, a card with a header, a card with a footer, a card with an image, and an overview card combining an image, content and a footer.</p>
      <iframe class="example" title="Card example" srcdoc=${exampleDocument(source)}></iframe>
      <pre><code>${source}</code></pre>

      <h2 id="attributes">Attributes and properties</h2>
      <p>None of its own, as in Shoelace. The inherited core <code>heading</code>, <code>subheading</code> and <code>media-position</code> properties have no effect (see below).</p>

      <h2 id="methods">Methods</h2>
      <p>None.</p>

      <h2 id="slots">Slots</h2>
      <table>
        <thead><tr><th>Name</th><th>Description</th></tr></thead>
        <tbody>
          ${slots.map(([n, d]) => html`<tr><td><code>${n}</code></td><td>${d}</td></tr>`)}
        </tbody>
      </table>
      <p>The header, footer and image sections are shown only while a direct child of the card carries the matching <code>slot</code> attribute. This is re-evaluated when slotted content changes, including when a child is added, removed or moved to another slot.</p>

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
      <table>
        <thead><tr><th>Name</th><th>Description</th></tr></thead>
        <tbody>
          <tr><td><code>ready</code></td><td>Emitted once, without bubbling, after the first render. Inherited from the core base element; not part of Shoelace's card, which emits no events.</td></tr>
        </tbody>
      </table>

      <h2 id="not-implemented">Not implemented or unverified</h2>
      <ul>
        ${gaps.map(g => html`<li>${g}</li>`)}
      </ul>
    `);
  }
}

export default CardPage;
