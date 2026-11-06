import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { definePageData } from '@beatzball/litro';
import { docsShell, shellStyles } from '../../src/shell.js';
import { themeHead } from '../../src/theme.js';
import { apiReference } from '../../src/api.js';
import { examples, exampleDocument } from '../../src/example.js';

export const pageData = definePageData(async () => ({
  seoTitle: 'Progress Ring - Velcro',
  seoHead: themeHead + '<meta name="description" content="Velcro progress ring (prototype).">',
}));

const gaps = [
  'There is no core progress ring: the component extends core\'s base element directly, so no core behavior is reused.',
  'The default accessible name is the fixed English string "Progress". Shoelace localizes it through its localization controller; that is not implemented and localized output has not been compared.',
  'value is not clamped or validated: aria-valuenow and the drawn arc follow whatever number is set, as in Shoelace. Whether a given screen reader announces the progressbar was not tested.',
  'The Shoelace docs example that pairs the ring with sl-icon circle buttons is ported with plain buttons, because sl-icon is not implemented. The React examples are not ported.',
  'The indicator transition is not reduced or stopped for prefers-reduced-motion, as in Shoelace; this is recorded as parity, not as an accessibility endorsement.',
  'Registration is browser-only and uses the native custom element registry for Velcro\'s own class, without changing the shared core prefix. Scope-dependent core features (declared dependencies, scope-aware templates) are not supported. Server-side rendering is not supported.',
  'Geometry and styles were checked by computed-style assertions in Chromium, Firefox and WebKit; there is no pixel comparison against Shoelace, and no RTL or localization check. Playwright\'s WebKit is not Safari: the Safari-specific dash-offset workaround and whether the transition animates in Safari itself are not checked.',
  'Both the light and dark themes exist (dark values are token-checked against Shoelace 2.20.1; dark rendering of this component is not screenshot-checked), and the theme should be loaded: the ring reads --sl-color-neutral-200 and --sl-color-primary-600 (with built-in fallbacks).',
];

@customElement('page-components-progress-ring')
export class ProgressRingPage extends LitElement {
  static override styles = [shellStyles];

  override render() {
    const source = examples['progress-ring/basic'];
    return docsShell('progress-ring', html`
      <h1>Progress Ring</h1>
      <p><code>&lt;sl-progress-ring&gt;</code> is registered by <code>@charm-ux/velcro</code> directly on the <code>@charm-ux/core</code> base element. Prototype status: unreleased.</p>
      <p>Progress rings are used to show the progress of a determinate operation in a circular fashion.</p>

      <h2 id="examples">Examples</h2>
      <p>Default, size, track and indicator width, colors, a custom label, and showing values in the default slot with buttons that change the value.</p>
      <iframe class="example" title="Progress ring example" srcdoc=${exampleDocument(source)}></iframe>
      <pre><code>${source}</code></pre>

      ${apiReference('sl-progress-ring', {
        attributes: html`<p><code>value</code> is reflected to an attribute, and removing the attribute restores the default <code>0</code>, as in Shoelace. <code>label</code> is not reflected and, as in Shoelace, is not reset when its attribute is removed.</p>`,
        slots: html`<p>The default slot holds a label shown inside the ring.</p>`,
        parts: html`<p><code>base</code> (the wrapper <code>div</code>, with <code>role="progressbar"</code>, <code>aria-valuemin="0"</code>, <code>aria-valuemax="100"</code> and <code>aria-valuenow</code>) and <code>label</code> (the default slot).</p>`,
        events: html`<p>The component declares no events of its own. It inherits the core base element's <code>ready</code> event, dispatched on the host after the first update; it does not bubble and is not composed. Shoelace's progress ring does not emit it, so this is a divergence.</p>`,
      })}

      <h2 id="not-implemented">Not implemented or unverified</h2>
      <ul>
        ${gaps.map(g => html`<li>${g}</li>`)}
      </ul>
    `);
  }
}

export default ProgressRingPage;
