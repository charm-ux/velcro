import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { definePageData } from '@beatzball/litro';
import { shell, shellStyles } from '../../src/shell.js';
import { examples, exampleDocument } from '../../src/example.js';

export const pageData = definePageData(async () => ({
  seoTitle: 'Progress bar - Velcro',
  seoHead: '<meta name="description" content="Velcro progress bar (prototype).">',
}));

const attributes: Array<[string, string, string, string]> = [
  ['value', 'number', '0', 'The current progress as a percentage, 0 to 100.'],
  ['indeterminate', 'boolean', 'false', 'When true, percentage is ignored, the label is hidden, and the progress bar is drawn in an indeterminate state.'],
  ['label', 'string', "''", 'A custom label for assistive devices.'],
];

const cssProperties: Array<[string, string, string]> = [
  ['--height', '1rem', "The progress bar's height."],
  ['--track-color', 'var(--sl-color-neutral-200)', 'The color of the track.'],
  ['--indicator-color', 'var(--sl-color-primary-600)', 'The color of the indicator.'],
  ['--label-color', 'var(--sl-color-neutral-0)', 'The color of the label.'],
];

const gaps = [
  'The default accessible name is the fixed English string "Progress" (used when label is empty). Shoelace localizes it through its localization controller; that is not implemented and localized output has not been compared.',
  'The base part has role="progressbar" with aria-valuemin 0, aria-valuemax 100 and aria-valuenow (0 when indeterminate), as in Shoelace. Whether a given screen reader announces it was not tested.',
  'The value is not clamped: values outside 0 to 100 set the indicator width as given, as in Shoelace.',
  'The right-to-left variant of the indeterminate animation follows the element\'s computed direction when it renders. It is checked in Chromium for an element\'s own dir attribute only; it is not re-evaluated when only an ancestor\'s direction changes.',
  'The "Showing Values" example uses text buttons ("-10", "+10") instead of Shoelace\'s circular icon buttons, because sl-icon is not implemented.',
  'Neither Shoelace 2.20.1 nor this component reduces or stops the indeterminate animation or the width transition for prefers-reduced-motion. This is recorded as parity, not as an accessibility endorsement.',
  'The inherited core properties max, meter, hide-label and help-text, the core "progress-bar-*" parts, the "--progress-bar-*" and "--form-control-*" custom properties and the core markup exist on the element or its base class but have no effect; they are not part of the Shoelace contract.',
  'Registration is browser-only and uses the native custom element registry for Velcro\'s own class, without changing the shared core prefix. Scope-dependent core features (declared dependencies, scope-aware templates) are not supported: a Velcro component that needs them fails when it is created, even when it is the only Charm library on the page. Server-side rendering is not supported.',
  'Rendering was checked by computed-style assertions in Chromium only; there is no pixel comparison against Shoelace, and no Firefox, WebKit or localization check.',
  'Removing the label attribute restores an empty label (and the default accessible name). This is a deliberate divergence: in Shoelace 2.20.1 only reflected properties are restored, label is not reflected, so removing it leaves label null and the next render throws. Removing the value attribute restores 0, as in Shoelace.',
  'The label font uses --sl-font-sans, which both Velcro themes now define exactly as Shoelace 2.20.1 does.',
  'Both the light and dark themes exist (dark values are token-checked against Shoelace 2.20.1; dark rendering of this component is not screenshot-checked), and the theme must be loaded: the progress bar reads --sl-color-*, --sl-border-radius-pill, --sl-shadow-small, --sl-font-sans and --sl-font-weight-normal.',
];

@customElement('page-components-progress-bar')
export class ProgressBarPage extends LitElement {
  static override styles = [shellStyles];

  override render() {
    const source = examples['progress-bar/basic'];
    return shell(html`
      <h1>Progress bar</h1>
      <p><code>&lt;sl-progress-bar&gt;</code> is registered by <code>@charm-ux/velcro</code> on top of the <code>@charm-ux/core</code> progress bar. Prototype status: unreleased.</p>
      <p>Progress bars are used to show the status of an ongoing operation.</p>

      <h2 id="examples">Examples</h2>
      <p>The example covers the default bar, a label for assistive devices, a custom height, custom colors, showing values in the default slot, and the indeterminate state.</p>
      <iframe class="example" title="Progress bar example" srcdoc=${exampleDocument(source)}></iframe>
      <pre><code>${source}</code></pre>

      <h2 id="attributes">Attributes and properties</h2>
      <table>
        <thead><tr><th>Name</th><th>Type</th><th>Default</th><th>Description</th></tr></thead>
        <tbody>
          ${attributes.map(([n, t, d, desc]) => html`<tr><td><code>${n}</code></td><td>${t}</td><td><code>${d}</code></td><td>${desc}</td></tr>`)}
        </tbody>
      </table>
      <p><code>value</code> and <code>indeterminate</code> are reflected to attributes; <code>label</code> is not reflected.</p>

      <h2 id="slots">Slots</h2>
      <p>The default slot holds a label to show inside the progress indicator. It is not rendered when <code>indeterminate</code> is set.</p>

      <h2 id="parts">CSS parts</h2>
      <p><code>base</code> (the <code>div</code> with <code>role="progressbar"</code>), <code>indicator</code> and <code>label</code> (the default <code>slot</code>).</p>

      <h2 id="css-properties">CSS custom properties</h2>
      <table>
        <thead><tr><th>Property</th><th>Default</th><th>Description</th></tr></thead>
        <tbody>
          ${cssProperties.map(([p, d, desc]) => html`<tr><td><code>${p}</code></td><td><code>${d}</code></td><td>${desc}</td></tr>`)}
        </tbody>
      </table>

      <h2 id="events">Events</h2>
      <p>None of Shoelace's. One inherited divergence: the core base class dispatches a non-bubbling, non-composed <code>ready</code> event on the element after its first update, which Shoelace does not do. It is kept and checked in the browser spec.</p>

      <h2 id="methods">Methods</h2>
      <p>None.</p>

      <h2 id="not-implemented">Not implemented or unverified</h2>
      <ul>
        ${gaps.map(g => html`<li>${g}</li>`)}
      </ul>
    `);
  }
}

export default ProgressBarPage;
