import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { definePageData } from '@beatzball/litro';
import { docsShell, shellStyles } from '../../src/shell.js';
import { themeHead } from '../../src/theme.js';
import { apiReference } from '../../src/api.js';
import { examples, exampleDocument } from '../../src/example.js';

export const pageData = definePageData(async () => ({
  seoTitle: 'Resize Observer - Velcro',
  seoHead: themeHead + '<meta name="description" content="Velcro resize observer (prototype).">',
}));

const gaps = [
  'The Shoelace documentation example logs event.detail to the console; the ported example writes the first entry\'s content size and an event count into the page instead, so it can be checked. The Shoelace React example is not ported.',
  'The component extends the core base element, so it also dispatches core\'s non-bubbling "ready" event on first update, which Shoelace does not. Core also keeps its "dir" property and its base styles (including a hidden-attribute rule).',
  'Observation was checked in Chromium with the example only: the initial report, resize reports, disabling, re-enabling, slot changes and disconnecting. Nested or flattened slots and elements slotted into the observer from another shadow root were not tested.',
  'The element has no role and exposes nothing to assistive technology; no screen reader testing was done.',
  'Registration is browser-only and uses the native custom element registry for Velcro\'s own class, without changing the shared core prefix. Scope-dependent core features (declared dependencies, scope-aware templates) are not supported. Server-side rendering is not supported.',
  'Rendering was checked by computed-style assertions in Chromium only; there is no Firefox, WebKit or RTL check.',
  'Both the light and dark themes exist. The component needs no theme tokens; the example uses --sl-input-border-color, which is defined by both themes.',
];

@customElement('page-components-resize-observer')
export class ResizeObserverPage extends LitElement {
  static override styles = [shellStyles];

  override render() {
    const source = examples['resize-observer/basic'];
    return docsShell('resize-observer', html`
      <h1>Resize Observer</h1>
      <p><code>&lt;sl-resize-observer&gt;</code> is registered by <code>@charm-ux/velcro</code> on top of the <code>@charm-ux/core</code> base element. Prototype status: unreleased.</p>
      <p>The Resize Observer component offers a thin, declarative interface to the <a href="https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver"><code>ResizeObserver</code> API</a>. It reports changes to the dimensions of the elements it wraps through the <code>sl-resize</code> event. A collection of <code>ResizeObserverEntry</code> objects is attached to <code>event.detail.entries</code>.</p>

      <h2 id="examples">Examples</h2>
      <iframe class="example" title="Resize Observer example" srcdoc=${exampleDocument(source)}></iframe>
      <pre><code>${source}</code></pre>

      ${apiReference('sl-resize-observer', {
        slots: html`<p>The default slot holds one or more elements to watch for resizing. The host is <code>display: contents</code>.</p>`,
        events: html`<p>Inherited from core: a non-bubbling <code>ready</code> event on first update.</p>`,
      })}

      <h2 id="not-implemented">Not implemented or unverified</h2>
      <ul>
        ${gaps.map(g => html`<li>${g}</li>`)}
      </ul>
    `);
  }
}

export default ResizeObserverPage;
