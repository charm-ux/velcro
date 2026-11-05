import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { definePageData } from '@beatzball/litro';
import { shell, shellStyles } from '../../src/shell.js';
import { examples, exampleDocument } from '../../src/example.js';
import { withBase } from '../../src/base.js';

export const pageData = definePageData(async () => ({
  seoTitle: 'Badge - Velcro',
  seoHead: '<meta name="description" content="Velcro badge (prototype).">',
}));

const attributes: Array<[string, string, string, string]> = [
  ['variant', 'primary | success | neutral | warning | danger', 'primary', "The badge's theme variant."],
  ['pill', 'boolean', 'false', 'Draws a pill-style badge with rounded edges.'],
  ['pulse', 'boolean', 'false', 'Makes the badge pulsate to draw attention.'],
];

const gaps = [
  'The base part carries role="status", as in Shoelace, so each badge is a live region. Whether a given screen reader announces content changes was not tested.',
  'Neither Shoelace 2.20.1 nor this component stops the pulse animation for prefers-reduced-motion; a pulsing badge keeps animating. This is recorded as parity, not as an accessibility endorsement.',
  'The default badge colors just miss WCAG AA text contrast (Shoelace relaxes the same check in its own tests); contrast was not evaluated here beyond that note.',
  'The core badge markup (part "badge-base", the "--badge-*" custom properties and its 20px minimum size) is replaced by the Shoelace structure. The "--badge-*" properties exist on the element through core but have no effect.',
  'Registration is browser-only and uses the native custom element registry for Velcro\'s own class, without changing the shared core prefix; the sl-badge entry and the package root (which the examples load) both register this way. The root import of all four components is checked in Chromium against core\'s prefix, project configuration and scope maps, with core\'s own button loaded in either order. Scope-dependent core features (declared dependencies, scope-aware templates) are not supported: a Velcro component that needs them fails when it is created, even when it is the only Charm library on the page. Server-side rendering is not supported. There is no class-only entry (no @charm-ux/velcro/badge/class subpath or Sl alias) for this component yet.',
  'Rendering was checked by computed-style assertions in Chromium only; there is no pixel comparison against Shoelace, and no Firefox, WebKit, RTL or localization check.',
  'Only the light theme exists, and the theme must be loaded: the badge reads --sl-color-*, --sl-border-radius-* and --sl-font-weight-semibold. Dark and the full token set are not done.',
];

@customElement('page-components-badge')
export class BadgePage extends LitElement {
  static override styles = [shellStyles];

  override render() {
    const source = examples['badge/basic'];
    return shell(html`
      <h1>Badge</h1>
      <p><code>&lt;sl-badge&gt;</code> is registered by <code>@charm-ux/velcro</code> on top of the <code>@charm-ux/core</code> badge. Prototype status: unreleased.</p>
      <p>Badges are used to draw attention and display statuses or counts.</p>
      <p>Next component: <a href=${withBase('/components/skeleton')}>Skeleton</a>.</p>

      <h2 id="examples">Examples</h2>
      <iframe class="example" title="Badge example" srcdoc=${exampleDocument(source)}></iframe>
      <pre><code>${source}</code></pre>

      <h2 id="attributes">Attributes and properties</h2>
      <table>
        <thead><tr><th>Name</th><th>Type</th><th>Default</th><th>Description</th></tr></thead>
        <tbody>
          ${attributes.map(([n, t, d, desc]) => html`<tr><td><code>${n}</code></td><td>${t}</td><td><code>${d}</code></td><td>${desc}</td></tr>`)}
        </tbody>
      </table>
      <p>All three are reflected to attributes and update the rendered badge when changed.</p>

      <h2 id="slots">Slots</h2>
      <p>The default slot holds the badge's content.</p>

      <h2 id="parts">CSS parts</h2>
      <p><code>base</code> (the <code>span</code> element, with <code>role="status"</code>).</p>

      <h2 id="css-properties">CSS custom properties</h2>
      <p>None. Colors and radius come from the theme tokens.</p>

      <h2 id="events">Events</h2>
      <p>None.</p>

      <h2 id="not-implemented">Not implemented or unverified</h2>
      <ul>
        ${gaps.map(g => html`<li>${g}</li>`)}
      </ul>
    `);
  }
}

export default BadgePage;
