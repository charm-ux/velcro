import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { definePageData } from '@beatzball/litro';
import { docsShell, shellStyles } from '../../src/shell.js';
import { themeHead } from '../../src/theme.js';
import { examples, exampleDocument } from '../../src/example.js';

export const pageData = definePageData(async () => ({
  seoTitle: 'Visually Hidden - Velcro',
  seoHead: themeHead + '<meta name="description" content="Velcro visually hidden utility (prototype).">',
}));

const gaps = [
  'Whether a given screen reader announces the hidden content was not tested; only the computed styles and the accessibility tree of the example in Chromium, Firefox and WebKit were checked.',
  'The Shoelace documentation examples that use sl-icon (the external-link icon) and sl-card with sl-input (content conveyed by context) are not ported, because those components are not implemented. The external-link example is shown without the icon.',
  'The component extends the core base element, so it also dispatches core\'s non-bubbling "ready" event on first update, which Shoelace does not. Core also keeps its "dir" property and its base styles (including a hidden-attribute rule that hides the element, with no focus exception).',
  'Registration is browser-only and uses the native custom element registry for Velcro\'s own class, without changing the shared core prefix. Scope-dependent core features (declared dependencies, scope-aware templates) are not supported. Server-side rendering is not supported.',
  'Rendering was checked by computed-style assertions in Chromium, Firefox and WebKit; there is no pixel comparison against Shoelace, and no RTL or localization check.',
  'Both the light and dark themes exist. The component needs no theme tokens.',
];

@customElement('page-components-visually-hidden')
export class VisuallyHiddenPage extends LitElement {
  static override styles = [shellStyles];

  override render() {
    const source = examples['visually-hidden/basic'];
    return docsShell('visually-hidden', html`
      <h1>Visually Hidden</h1>
      <p><code>&lt;sl-visually-hidden&gt;</code> is registered by <code>@charm-ux/velcro</code> on top of the <code>@charm-ux/core</code> base element. Prototype status: unreleased.</p>
      <p>The visually hidden utility makes content accessible to assistive devices without displaying it on the screen.</p>
      <p>Since visually hidden content can receive focus when tabbing, the element becomes visible when something inside receives focus, so keyboard users can see where focus is.</p>

      <h2 id="examples">Examples</h2>
      <iframe class="example" title="Visually Hidden example" srcdoc=${exampleDocument(source)}></iframe>
      <pre><code>${source}</code></pre>

      <h2 id="attributes">Attributes and properties</h2>
      <p>None of its own. The inherited core <code>dir</code> property is present.</p>

      <h2 id="slots">Slots</h2>
      <p>The default slot holds the content to be visually hidden.</p>

      <h2 id="parts">CSS parts</h2>
      <p>None.</p>

      <h2 id="css-properties">CSS custom properties</h2>
      <p>None.</p>

      <h2 id="events">Events</h2>
      <p>None from Shoelace. Inherited from core: a non-bubbling <code>ready</code> event on first update.</p>

      <h2 id="methods">Methods</h2>
      <p>None.</p>

      <h2 id="not-implemented">Not implemented or unverified</h2>
      <ul>
        ${gaps.map(g => html`<li>${g}</li>`)}
      </ul>
    `);
  }
}

export default VisuallyHiddenPage;
