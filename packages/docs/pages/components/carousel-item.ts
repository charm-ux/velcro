import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { definePageData } from '@beatzball/litro';
import { docsShell, shellStyles } from '../../src/shell.js';
import { themeHead } from '../../src/theme.js';
import { withBase } from '../../src/base.js';
import { apiReference } from '../../src/api.js';
import { examples, exampleDocument, reactExamples } from '../../src/example.js';

export const pageData = definePageData(async () => ({
  seoTitle: 'Carousel Item - Velcro',
  seoHead: themeHead + '<meta name="description" content="Velcro carousel item (prototype).">',
}));

// Shoelace's page has one example (the opening one, with no heading) and a tip that points to the carousel's examples.
const sections = [
  ['overview', 'Overview', 'carousel-item/basic', 'carousel-item/react/basic', 'Shoelace\'s example: an sl-carousel with five slides, each an sl-carousel-item that holds an image.'],
] as const;

// Shoelace 2.20.1 behaviors that look like bugs but are matched exactly (candidates for a later opt-in fix). One line each.
const quirks = [
  'The hidden attribute does not hide a carousel item: the host\'s own display: flex outranks the browser\'s [hidden] rule, so it stays displayed. Core\'s own base styles would hide it, so they are replaced by Shoelace\'s.',
  'A slotted img is always forced to 100% width and height with object-fit: cover, whatever its own width and height (an !important rule on ::slotted(img)), so an image cannot keep its own proportions in a slide.',
] as const;

const gaps = [
  'Shoelace\'s example is ported with a live preview and a React version, with inline placeholder images (SVG data: URLs drawn for Velcro) in place of Shoelace\'s photographs, as on the carousel page, where the other examples are; the React example is the carousel page\'s Pagination one, which is the same markup.',
  'Velcro builds sl-carousel-item on the @charm-ux/core base element: core has no carousel component, so there is no core model to keep or switch off. The only core extension is the non-bubbling ready event on first update. Shoelace\'s item has no properties, attributes or events of its own, and neither does this one.',
  'The carousel, not the item, does the work: it writes role, aria-label, id, aria-hidden, inert and the --in-view and --is-active classes onto its items, and looping adds clones (data-clone). An item on its own is a plain flex container with a slot.',
  'dir and lang are declared as Shoelace\'s base element declares them: reactive, not reflected and undefined until set. Core\'s computed dir is not used. TypeScript types for dir are narrower than Shoelace\'s dir: string: at runtime dir is stored and returned as set, and the setter accepts any string.',
  'Shoelace\'s two carousel item tests (it renders; it passes the accessibility check) are vendored unchanged and pass in Chromium. The product test suite is configured for Chromium, Firefox and WebKit; this component\'s spec was run locally in Chromium and WebKit only, and Firefox is covered only by the project\'s CI run. There is no pixel comparison with Shoelace.',
  'Registration is browser-only and uses the native custom element registry for Velcro\'s own class, without changing the shared core prefix. Server-side rendering is not supported.',
  'The item reads no theme token; its only custom property is --aspect-ratio, which it inherits from the carousel, so it works with both themes.',
];

@customElement('page-components-carousel-item')
export class CarouselItemPage extends LitElement {
  static override styles = [shellStyles];

  override render() {
    return docsShell('carousel-item', html`
      <h1>Carousel Item</h1>
      <p><code>&lt;sl-carousel-item&gt;</code> is registered by <code>@charm-ux/velcro</code> on top of the <code>@charm-ux/core</code> base element. Prototype status: unreleased.</p>
      <p>A carousel item represent a slide within a <a href=${withBase('/components/carousel')}>carousel</a>.</p>

      <h2 id="examples">Examples</h2>
      <p>Each preview runs in its own document. Additional demonstrations can be found in the <a href=${withBase('/components/carousel')}>carousel examples</a>.</p>
      ${sections.map(
        ([id, title, key, react, text]) => html`
          <h3 id=${id}>${title}</h3>
          <p>${text}</p>
          <iframe class="example" title=${`Carousel Item example: ${title}`} srcdoc=${exampleDocument(examples[key])}></iframe>
          <pre><code>${examples[key]}</code></pre>
          <details class="react-example">
            <summary>React</summary>
            <pre><code>${reactExamples[react]}</code></pre>
          </details>
        `
      )}

      ${apiReference('sl-carousel-item', {
        attributes: html`<p>Shoelace's carousel item has no attributes of its own. <code>dir</code> and <code>lang</code> are reactive properties with no default that are not reflected, as in Shoelace's base element.</p>`,
        events: html`<p>Shoelace's carousel item has no events. Inherited from core: a non-bubbling <code>ready</code> event on first update, which Shoelace does not have.</p>`,
        slots: html`<p>The default slot holds the slide's content.</p>`,
        parts: html`<p>The carousel item has no parts.</p>`,
      })}

      <h2 id="upstream-quirks">Upstream quirks matched</h2>
      <p>Velcro matches Shoelace 2.20.1 exactly, including behavior that looks like a bug. Each of these is covered by a product test. Each is a candidate for a later opt-in fix.</p>
      <ul>
        ${quirks.map(q => html`<li>${q}</li>`)}
      </ul>

      <h2 id="not-implemented">Not implemented or unverified</h2>
      <p>Differences from Shoelace 2.20.1 and limits of what has been checked.</p>
      <ul>
        ${gaps.map(g => html`<li>${g}</li>`)}
      </ul>
    `);
  }
}

export default CarouselItemPage;
