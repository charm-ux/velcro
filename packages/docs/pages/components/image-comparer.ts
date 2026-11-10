import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { definePageData } from '@beatzball/litro';
import { docsShell, shellStyles } from '../../src/shell.js';
import { themeHead } from '../../src/theme.js';
import { apiReference } from '../../src/api.js';
import { examples, exampleDocument, reactExamples } from '../../src/example.js';

export const pageData = definePageData(async () => ({
  seoTitle: 'Image Comparer - Velcro',
  seoHead: themeHead + '<meta name="description" content="Velcro image comparer (prototype).">',
}));

// Shoelace's examples, in the order of its page: [id, heading, text, example key, React example key]. The first has no
// heading in Shoelace's page (it is the page's opening example).
const sections = [
  ['basic', 'Default', null, 'image-comparer/basic', 'image-comparer/react/basic'],
  ['initial-position', 'Initial Position', html`Use the <code>position</code> attribute to set the initial position of the slider. This is a percentage from <code>0</code> to <code>100</code>.`, 'image-comparer/initial-position', 'image-comparer/react/initial-position'],
] as const;
const untitled = new Set<string>(['basic']);

// Shoelace 2.20.1 behaviors that look like bugs but are matched exactly (candidates for a later opt-in fix). One line each.
const quirks = [
  'sl-change is emitted for every change of position after the first update, including one set from script or by attribute, not only for changes the user makes; several changes before one update emit a single event, and a change back to the old value before the update emits none.',
  'A position set by attribute or property is not clamped or rounded (only the keyboard and the drag clamp to 0-100), so position="150" renders the divider outside the image and aria-valuenow="150".',
  'The keys are handled on the base element, not the handle, so they also move the divider while focus is on focusable content slotted into the before or after slot.',
  'The direction follows the element\'s own dir property, else the document\'s; with dir="auto" the left and right arrows do nothing (Home and End still work) and the divider is laid out left to right.',
  'The drag starts on mousedown or touchstart (not pointerdown), so the drag helper never moves the divider on the press itself: the position only changes on the first pointermove. The press calls preventDefault(), so clicking the handle does not focus it, and any mouse button starts a drag.',
  'The width used by a drag is measured once, when the drag starts; resizing the image comparer during a drag keeps the old width.',
  'Shoelace\'s styles for slotted images (display: block, max-width: 100%) never apply, because its selectors put ::slotted() after the containers\' class instead of after a slot. The images keep the browser\'s inline display, so a few pixels of line space show below them and the image comparer is that much taller than the images, and an image wider than the space available is not scaled down: the image comparer grows to the image\'s width and overflows its container (or, given a smaller width, crops the images on the right). Shoelace\'s own docs site scales its example images down with a global img rule; the example frames here have no such rule, so their placeholder images are 600 pixels wide.',
  'The handle has role="scrollbar" with aria-controls pointing at the base element and no accessible name.',
] as const;

const gaps = [
  'All of Shoelace\'s examples are ported with a live preview and a React version, in Shoelace\'s order. The examples use inline placeholder images (data: URLs drawn for Velcro, with the same dimensions in each pair) where Shoelace\'s use photos from images.unsplash.com, so the docs site makes no third-party request; their alt texts describe the placeholders. The React examples import Velcro\'s generated wrapper (@charm-ux/velcro/react/VelcroImageComparer.js) under Shoelace\'s name; nothing else differs.',
  'Difference from Shoelace: the image comparer defines Velcro\'s sl-icon (its default grip-vertical handle icon) when it is constructed, as Velcro\'s other components define their dependencies, and its registering entry registers sl-icon too. Shoelace 2.20.1 documents sl-icon as the image comparer\'s dependency but declares it in a static scopedElement field that its base element never reads, so importing only Shoelace\'s image comparer leaves sl-icon undefined and the handle without an icon until something else registers it.',
  'Velcro builds sl-image-comparer on the @charm-ux/core base element, because @charm-ux/core has no image comparer. The only core extension that remains is the non-bubbling ready event on first update, which the API tables label as inherited from core. Core\'s base styles are replaced by Shoelace\'s.',
  'The public base and handle fields (the base and handle elements) and the handlePositionChange method exist as in Shoelace, which lists them in its manifest without a description; the API tables below list them too.',
  'dir and lang are declared as Shoelace\'s base element declares them: reactive, not reflected and undefined until set. Core\'s computed dir is not used. TypeScript types for dir are narrower than Shoelace\'s dir: string: at runtime dir is stored and returned as set and the setter accepts any string, but the read type stays core\'s \'ltr\' | \'rtl\' | \'auto\', because a subclass cannot widen an inherited getter\'s type. Fixing this needs a change in @charm-ux/core and is deferred.',
  'The product test suite is configured for Chromium, Firefox and WebKit; this component\'s spec was run locally in Chromium and WebKit only, and Firefox is covered only by the project\'s CI run. Shoelace\'s own image comparer test (12 tests) runs in Chromium only and passes. The accessibility-tree check is Playwright\'s ARIA snapshot, which Playwright computes from the DOM; no screen reader and no browser accessibility API was tried. Touch dragging is ported from Shoelace but was not tried on a touch device; there is no pixel comparison with Shoelace.',
  'Registration is browser-only and uses the native custom element registry for Velcro\'s own class, without changing the shared core prefix. Server-side rendering is not supported.',
  'Rendering under the dark theme has not been checked, and color contrast was not evaluated.',
];

@customElement('page-components-image-comparer')
export class ImageComparerPage extends LitElement {
  static override styles = [shellStyles];

  override render() {
    return docsShell('image-comparer', html`
      <h1>Image Comparer</h1>
      <p><code>&lt;sl-image-comparer&gt;</code> is registered by <code>@charm-ux/velcro</code> on top of the <code>@charm-ux/core</code> base element. Prototype status: unreleased.</p>
      <p>Compare visual differences between similar photos with a sliding panel.</p>
      <p>For best results, use images that share the same dimensions. The slider can be controlled by dragging or pressing the left and right arrow keys. (Tip: press shift + arrows to move the slider in larger intervals, or home + end to jump to the beginning or end.)</p>

      <h2 id="examples">Examples</h2>
      <p>Each preview runs in its own document. The React version of each example is Shoelace's, ported to Velcro's generated React wrapper; only its import line and the placeholder images differ. It is shown as source.</p>
      ${sections.map(
        ([id, title, text, key, react]) => html`
          ${untitled.has(id) ? '' : html`<h3 id=${id}>${title}</h3>`}
          ${text === null ? '' : html`<p>${text}</p>`}
          <iframe class="example" title=${`Image comparer example: ${title}`} srcdoc=${exampleDocument(examples[key])}></iframe>
          <pre><code>${examples[key]}</code></pre>
          <details class="react-example">
            <summary>React</summary>
            <pre><code>${reactExamples[react]}</code></pre>
          </details>
        `
      )}

      ${apiReference('sl-image-comparer', {
        attributes: html`<p><code>position</code> is reflected and defaults to 50. It is not clamped when set (see the quirks below). Setting it to null or undefined (or removing the attribute) restores its initial value, as in Shoelace's base element (which records the initial values on the element's first attribute change). <code>dir</code> and <code>lang</code> are reactive properties with no default that are not reflected, as in Shoelace's base element; a right-to-left direction mirrors the clipping, the divider, the drag and the arrow keys.</p>`,
        events: html`<p><code>sl-change</code> bubbles, is composed and has no detail; it is emitted whenever <code>position</code> changes after the first update. ArrowRight and ArrowLeft move the divider by 1 (by 10 with Shift; swapped in right-to-left), Home sets 0 and End sets 100, each clamped to 0-100. Dragging the divider sets the position from the pointer, rounded to two decimals and clamped to 0-100. Inherited from core: a non-bubbling <code>ready</code> event on first update, which Shoelace does not have.</p>`,
        parts: html`<p>The <code>handle</code> part has <code>role="scrollbar"</code>, <code>tabindex="0"</code>, <code>aria-valuenow</code>, <code>aria-valuemin="0"</code>, <code>aria-valuemax="100"</code> and <code>aria-controls</code> pointing at the <code>base</code> part.</p>`,
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

export default ImageComparerPage;
