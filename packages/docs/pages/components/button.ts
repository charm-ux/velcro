import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { definePageData } from '@beatzball/litro';
import { docsShell, shellStyles } from '../../src/shell.js';
import { themeHead } from '../../src/theme.js';
import { examples, exampleDocument } from '../../src/example.js';

export const pageData = definePageData(async () => ({
  seoTitle: 'Button - Velcro',
  seoHead: themeHead + '<meta name="description" content="Velcro button (prototype).">',
}));

const attributes: Array<[string, string, string, string]> = [
  ['variant', 'default | primary | success | neutral | warning | danger | text', 'default', 'Theme variant.'],
  ['size', 'small | medium | large', 'medium', 'Button size.'],
  ['caret', 'boolean', 'false', 'Shows a caret.'],
  ['loading', 'boolean', 'false', 'Shows a spinner in place of the content.'],
  ['outline', 'boolean', 'false', 'Outlined appearance.'],
  ['pill', 'boolean', 'false', 'Rounded ends.'],
  ['circle', 'boolean', 'false', 'Circular icon button.'],
  ['disabled', 'boolean', 'false', 'Disables the button (not focusable, swallows clicks).'],
  ['type', 'button | submit | reset', 'button', 'Inherited from the core button; see the form limitations below.'],
  ['name, value, href, target', 'string', '-', 'Inherited from the core button; see the form limitations below.'],
];

const gaps = [
  'download is not supported: the core button declares the property but never puts it on the link, so it has no effect. It is not covered by a test.',
  'Inherited submit/reset call form.submit()/form.reset() directly: no submit event, no validation, and no submitter name/value is sent. name and value are only set on the inner control. Treat type="submit"/"reset" as unverified.',
  'Registration is browser-only and uses the native custom element registry for Velcro\'s own class, without changing the shared core prefix. The package root, which registers all four components, is checked in Chromium against core\'s prefix, project configuration and scope maps, with core\'s own button loaded in either order. Scope-dependent core features (declared dependencies, scope-aware templates) are not supported: a Velcro component that needs them fails when it is created, even when it is the only Charm library on the page. Server-side rendering is not supported.',
  'Form attributes (form, formaction, formenctype, formmethod, formnovalidate, formtarget) and rel are not implemented.',
  'sl-invalid, validity and reportValidity() are not implemented; the core button exposes no form-validity bridge.',
  'The element also carries the core attribute "focusable" (core\'s "button" base-name attribute is not set under Velcro\'s registration), and extra core properties (toggle, pressed, expanded, shows, hides, toggles).',
  'Loading-state click behavior and exact visual parity with Shoelace have not been compared.',
  'Only the light theme exists. Dark and the full token set are not done.',
];

@customElement('page-components-button')
export class ButtonPage extends LitElement {
  static override styles = [shellStyles];

  override render() {
    const source = examples['button/basic'];
    return docsShell('button', html`
      <h1>Button</h1>
      <p><code>&lt;sl-button&gt;</code> is registered by <code>@charm-ux/velcro</code> on top of the <code>@charm-ux/core</code> button. Prototype status: unreleased.</p>

      <h2 id="examples">Examples</h2>
      <p>The preview runs in its own document, so its script uses plain <code>document.querySelector</code>.</p>
      <iframe class="example" title="Button example" srcdoc=${exampleDocument(source)}></iframe>
      <pre><code>${source}</code></pre>

      <h2 id="attributes">Attributes</h2>
      <table>
        <thead><tr><th>Attribute</th><th>Values</th><th>Default</th><th>Description</th></tr></thead>
        <tbody>
          ${attributes.map(([a, v, d, desc]) => html`<tr><td><code>${a}</code></td><td>${v}</td><td>${d}</td><td>${desc}</td></tr>`)}
        </tbody>
      </table>

      <h2 id="slots">Slots</h2>
      <p>Default (label), <code>prefix</code>, <code>suffix</code>.</p>

      <h2 id="parts">CSS parts</h2>
      <p><code>base</code>, <code>prefix</code>, <code>label</code>, <code>suffix</code>, <code>caret</code>, <code>spinner</code>.</p>

      <h2 id="events">Events</h2>
      <p><code>sl-focus</code>, <code>sl-blur</code>, and the native <code>click</code>.</p>

      <h2 id="not-implemented">Not implemented or unverified</h2>
      <ul>
        ${gaps.map(g => html`<li>${g}</li>`)}
      </ul>
    `);
  }
}

export default ButtonPage;
