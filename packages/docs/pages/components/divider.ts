import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { definePageData } from '@beatzball/litro';
import { shell, shellStyles } from '../../src/shell.js';
import { examples, exampleDocument } from '../../src/example.js';

export const pageData = definePageData(async () => ({
  seoTitle: 'Divider - Velcro',
  seoHead: '<meta name="description" content="Velcro divider (prototype).">',
}));

const cssProperties: Array<[string, string, string]> = [
  ['--color', 'var(--sl-panel-border-color)', 'The color of the divider.'],
  ['--width', 'var(--sl-panel-border-width)', 'The width of the divider.'],
  ['--spacing', 'var(--sl-spacing-medium)', 'The spacing of the divider.'],
];

const gaps = [
  'The element itself is the line: role="separator" is set on the host when it connects (replacing any role you set), and aria-orientation follows vertical. Screen reader behavior was not tested.',
  'The vertical divider uses height: 100% of its container, so the container needs a definite height, as in Shoelace.',
  'The inherited core properties orientation, presentation, inset and align-content, the core "divider-*" parts and the core "--divider-*" custom properties exist on the element but have no effect; they are not part of the Shoelace contract and the styles neutralize the core rules for them. Core has no slot content here: the element renders nothing in its shadow root.',
  'Registration is browser-only and uses the native custom element registry for Velcro\'s own class, without changing the shared core prefix; the sl-divider entry and the package root (which the examples load) both register this way. The root import of all four components is checked in Chromium against core\'s prefix, project configuration and scope maps, with core\'s own button loaded in either order. Scope-dependent core features (declared dependencies, scope-aware templates) are not supported: a Velcro component that needs them fails when it is created, even when it is the only Charm library on the page. Server-side rendering is not supported. There is no class-only entry (no @charm-ux/velcro/divider/class subpath or Sl alias) for this component yet.',
  'Rendering was checked by computed-style assertions in Chromium only; there is no pixel comparison against Shoelace, and no Firefox, WebKit, RTL or localization check. Logical (RTL) behavior is not implemented: the vertical line uses border-left, as in Shoelace.',
  'Only the light theme exists, and the theme must be loaded: the divider reads --sl-panel-border-color, --sl-panel-border-width and --sl-spacing-medium. Dark and the full token set are not done.',
];

@customElement('page-components-divider')
export class DividerPage extends LitElement {
  static override styles = [shellStyles];

  override render() {
    const source = examples['divider/basic'];
    return shell(html`
      <h1>Divider</h1>
      <p><code>&lt;sl-divider&gt;</code> is registered by <code>@charm-ux/velcro</code> on top of the <code>@charm-ux/core</code> divider. Prototype status: unreleased.</p>
      <p>Dividers are used to visually separate or group elements.</p>

      <h2 id="examples">Examples</h2>
      <iframe class="example" title="Divider example" srcdoc=${exampleDocument(source)}></iframe>
      <pre><code>${source}</code></pre>

      <h2 id="attributes">Attributes and properties</h2>
      <table>
        <thead><tr><th>Name</th><th>Type</th><th>Default</th><th>Description</th></tr></thead>
        <tbody>
          <tr><td><code>vertical</code></td><td>boolean</td><td><code>false</code></td><td>Draws the divider in a vertical orientation. Reflected; updates <code>aria-orientation</code> when changed.</td></tr>
        </tbody>
      </table>

      <h2 id="slots">Slots</h2>
      <p>None.</p>

      <h2 id="parts">CSS parts</h2>
      <p>None.</p>

      <h2 id="css-properties">CSS custom properties</h2>
      <table>
        <thead><tr><th>Property</th><th>Default</th><th>Description</th></tr></thead>
        <tbody>
          ${cssProperties.map(([p, d, desc]) => html`<tr><td><code>${p}</code></td><td><code>${d}</code></td><td>${desc}</td></tr>`)}
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

export default DividerPage;
