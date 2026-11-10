import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { definePageData } from '@beatzball/litro';
import { docsShell, shellStyles } from '../../src/shell.js';
import { themeHead } from '../../src/theme.js';
import { apiReference } from '../../src/api.js';
import { examples, exampleDocument, reactExamples } from '../../src/example.js';

export const pageData = definePageData(async () => ({
  seoTitle: 'QR Code - Velcro',
  seoHead: themeHead + '<meta name="description" content="Velcro QR code (prototype).">',
}));

// Shoelace's examples, in the order of its page: [id, heading, text, example key, React example key]. The first has no
// heading in Shoelace's page (it is the page's opening example).
const sections = [
  ['basic', 'Default', null, 'qr-code/basic', 'qr-code/react/basic'],
  ['colors', 'Colors', html`Use the <code>fill</code> and <code>background</code> attributes to modify the QR code's colors. You should always ensure good contrast for optimal compatibility with QR code scanners.`, 'qr-code/colors', 'qr-code/react/colors'],
  ['size', 'Size', html`Use the <code>size</code> attribute to change the size of the QR code.`, 'qr-code/size', 'qr-code/react/size'],
  ['radius', 'Radius', html`Create a rounded effect with the <code>radius</code> attribute.`, 'qr-code/radius', 'qr-code/react/radius'],
  ['error-correction', 'Error Correction', html`QR codes can be rendered with various levels of <a href="https://www.qrcode.com/en/about/error_correction.html">error correction</a> that can be set using the <code>error-correction</code> attribute. This example generates four codes with the same value using different error correction levels.`, 'qr-code/error-correction', 'qr-code/react/error-correction'],
] as const;
const untitled = new Set<string>(['basic']);

// Shoelace 2.20.1 behaviors that look like bugs but are matched exactly (candidates for a later opt-in fix). One line each.
const quirks = [
  'Each drawing property that changes redraws the code once, and they are not batched: setting fill and background in the same update draws the code twice (Shoelace\'s @watch runs generate() once per changed property).',
  'The canvas is an inline element inside an inline-block host, so in a standards-mode page the host is a few pixels taller than size (the line box keeps room below the baseline); the canvas itself is exactly size by size. In a quirks-mode page, such as the one Shoelace\'s own test runner uses, the host is exactly size tall.',
  'A size that is not a number, or a removed size attribute (which gives null), draws nothing: the canvas bitmap becomes 0 by 0 pixels, and the canvas keeps the displayed size it had before (none, on a new element).',
  'None of the properties is reflected, and removing an attribute does not restore its default: a removed value attribute gives null, which leaves the canvas with an empty aria-label.',
  'The canvas bitmap is always twice size in each direction, whatever the display\'s pixel ratio (Shoelace draws it larger to avoid blurring on high-density displays), so on a display with a pixel ratio above 2 it is scaled up.',
  'The hidden attribute does not hide the QR code: Shoelace\'s styles set the host to display: inline-block, which overrides the browser\'s hidden rule.',
  'fill and background are handed to the canvas as they are, and the canvas ignores a color it cannot parse, such as a CSS custom property (var(--...)): the drawing then uses the last color the canvas had, so an unparsable fill paints the modules in the background color and leaves a blank square.',
  'The code is drawn without a quiet zone (the empty margin QR scanners expect around the code): the finder patterns touch the edges of the canvas, so the code relies on the page around it for that margin.',
];

const gaps = [
  'All five of Shoelace\'s examples are ported with a live preview and a React version, in Shoelace\'s order, with Shoelace\'s value (https://shoelace.style/), which is only encoded: the page makes no request to that site. The React examples import Velcro\'s generated wrappers (@charm-ux/velcro/react/VelcroQrCode.js and, in the first, VelcroInput.js) under Shoelace\'s names; nothing else differs.',
  'Velcro builds sl-qr-code on the @charm-ux/core base element, because @charm-ux/core has no QR code. The only core extension that remains is the non-bubbling ready event on first update (after the code is drawn), which the API tables label as inherited from core. Core\'s base styles are replaced by Shoelace\'s.',
  'The code is drawn by qr-creator 1.0.0, the package and version Shoelace 2.20.1 uses, with Shoelace\'s options; it is a runtime dependency of @charm-ux/velcro, pinned exactly. The product tests compare each drawn canvas pixel for pixel with a canvas that qr-creator draws from Shoelace\'s options in the same browser, and pin the module pattern of the examples\' code; no Shoelace build was run side by side, and no QR scanner app was tried.',
  'The public canvas field and generate() method exist as in Shoelace, which lists them in its manifest without a description; the API tables list them too. generate() is called by the element itself whenever a drawing property changes.',
  'dir and lang are declared as Shoelace\'s base element declares them: reactive, not reflected and undefined until set. They have no effect on the drawing. Core\'s computed dir is not used. TypeScript types for dir are narrower than Shoelace\'s dir: string: at runtime dir is stored and returned as set and the setter accepts any string, but the read type stays core\'s \'ltr\' | \'rtl\' | \'auto\', because a subclass cannot widen an inherited getter\'s type. Fixing this needs a change in @charm-ux/core and is deferred.',
  'The product test suite is configured for Chromium, Firefox and WebKit; this component\'s spec was run locally in Chromium and WebKit only, and Firefox is covered only by the project\'s CI run. Shoelace\'s own QR code test (7 tests, including its axe accessibility check and its color and size checks) runs in Chromium only and passes. The accessibility-tree check is Playwright\'s ARIA snapshot, which Playwright computes from the DOM; no screen reader and no browser accessibility API was tried.',
  'Registration is browser-only and uses the native custom element registry for Velcro\'s own class, without changing the shared core prefix. Server-side rendering is not supported.',
  'Rendering under the dark theme has not been checked; the colors are the fill and background properties (black on white by default) in both themes, as in Shoelace.',
];

@customElement('page-components-qr-code')
export class QrCodePage extends LitElement {
  static override styles = [shellStyles];

  override render() {
    return docsShell('qr-code', html`
      <h1>QR Code</h1>
      <p><code>&lt;sl-qr-code&gt;</code> is registered by <code>@charm-ux/velcro</code> on top of the <code>@charm-ux/core</code> base element. Prototype status: unreleased.</p>
      <p>Generates a QR code and renders it using the Canvas API.</p>
      <p>QR codes are useful for providing small pieces of information to users who can quickly scan them with a smartphone. Most smartphones have built-in QR code scanners, so simply pointing the camera at a QR code will decode it and allow the user to visit a website, dial a phone number, read a message, etc.</p>

      <h2 id="examples">Examples</h2>
      <p>Each preview runs in its own document. The React version of each example is Shoelace's, ported to Velcro's generated React wrappers; only its import lines differ. It is shown as source.</p>
      ${sections.map(
        ([id, title, text, key, react]) => html`
          ${untitled.has(id) ? '' : html`<h3 id=${id}>${title}</h3>`}
          ${text === null ? '' : html`<p>${text}</p>`}
          <iframe class="example" title=${`QR code example: ${title}`} srcdoc=${exampleDocument(examples[key])}></iframe>
          <pre><code>${examples[key]}</code></pre>
          <details class="react-example">
            <summary>React</summary>
            <pre><code>${reactExamples[react]}</code></pre>
          </details>
        `
      )}

      ${apiReference('sl-qr-code', {
        attributes: html`<p>No attribute is reflected. <code>value</code> and <code>label</code> default to empty strings, <code>size</code> to 128, <code>fill</code> to black, <code>background</code> to white, <code>radius</code> to 0 and <code>error-correction</code> to H. The canvas is drawn at twice <code>size</code> (a 256 by 256 pixel bitmap by default) and displayed at <code>size</code> by <code>size</code> CSS pixels. <code>label</code> is not drawn; it only names the code for assistive technology. <code>dir</code> and <code>lang</code> are reactive properties with no default that are not reflected, as in Shoelace's base element.</p>`,
        events: html`<p>Shoelace's QR code emits no events. Inherited from core: a non-bubbling <code>ready</code> event on first update, after the code is first drawn, which Shoelace does not have.</p>`,
        parts: html`<p>The <code>base</code> part is the <code>&lt;canvas&gt;</code>, with <code>role="img"</code> and an <code>aria-label</code> of <code>label</code>, or of <code>value</code> when <code>label</code> is empty. It is not focusable and has no keyboard behavior.</p>`,
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

export default QrCodePage;
