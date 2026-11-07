import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { definePageData } from '@beatzball/litro';
import { withBase } from '../../src/base.js';
import { docsShell, shellStyles } from '../../src/shell.js';
import { themeHead } from '../../src/theme.js';
import { apiReference } from '../../src/api.js';
import { examples, exampleDocument } from '../../src/example.js';

export const pageData = definePageData(async () => ({
  seoTitle: 'Progress Bar - Velcro',
  seoHead: themeHead + '<meta name="description" content="Velcro progress bar (prototype).">',
}));

const gaps = [
  'The default accessible name (used when label is empty) is the localized "progress" term, as in Shoelace: "Progress" in English, the fallback. It follows the element\'s lang, then the document\'s, and re-renders when either changes or a translation is registered.',
  'A translation is registered by importing @charm-ux/velcro/translations/<code> (Shoelace\'s 29 files, which register themselves) or by calling registerTranslation from @charm-ux/velcro/utilities/localize, as with Shoelace\'s utilities/localize. The translated text is Shoelace\'s and was not reviewed by Velcro; localized output was checked in Chromium, Firefox and WebKit. See the Localization page.',
  'The base part has role="progressbar" with aria-valuemin 0, aria-valuemax 100 and aria-valuenow (0 when indeterminate), as in Shoelace. Whether a given screen reader announces it was not tested.',
  'The value is not clamped: values outside 0 to 100 set the indicator width as given, as in Shoelace.',
  'The right-to-left variant of the indeterminate animation follows the element\'s dir, then the document element\'s, as in Shoelace; an ancestor\'s dir is ignored. The direction comes from the dir attribute, not the property: Shoelace reads the host\'s dir property, which follows the attribute, but the shared localization controller reads only the attribute (core\'s dir getter resolves the computed style), so a dir set only through the property (el.dir = "rtl" without the attribute) is ignored here.',
  'The "Showing Values" example uses text buttons ("-10", "+10") instead of Shoelace\'s circular icon buttons, as ported before Velcro had sl-icon (not yet updated to use it).',
  'Neither Shoelace 2.20.1 nor this component reduces or stops the indeterminate animation or the width transition for prefers-reduced-motion. This is recorded as parity, not as an accessibility endorsement.',
  'The inherited core properties max, meter, hide-label and help-text, the core "progress-bar-*" parts, the "--progress-bar-*" and "--form-control-*" custom properties and the core markup exist on the element or its base class but have no effect; they are not part of the Shoelace contract.',
  'Registration is browser-only and uses the native custom element registry for Velcro\'s own class, without changing the shared core prefix. Scope-dependent core features (declared dependencies, scope-aware templates) are not supported: a Velcro component that needs them fails when it is created, even when it is the only Charm library on the page. Server-side rendering is not supported.',
  'Rendering was checked by computed-style assertions in Chromium, Firefox and WebKit; there is no pixel comparison against Shoelace.',
  'Removing the label attribute restores an empty label (and the default accessible name). This is a deliberate divergence: in Shoelace 2.20.1 only reflected properties are restored, label is not reflected, so removing it leaves label null and the next render throws. Removing the value attribute restores 0, as in Shoelace.',
  'The label font uses --sl-font-sans, which both Velcro themes now define exactly as Shoelace 2.20.1 does.',
  'Both the light and dark themes exist (dark values are token-checked against Shoelace 2.20.1; dark rendering of this component is not screenshot-checked), and the theme must be loaded: the progress bar reads --sl-color-*, --sl-border-radius-pill, --sl-shadow-small, --sl-font-sans and --sl-font-weight-normal.',
];

@customElement('page-components-progress-bar')
export class ProgressBarPage extends LitElement {
  static override styles = [shellStyles];

  override render() {
    const source = examples['progress-bar/basic'];
    return docsShell('progress-bar', html`
      <h1>Progress Bar</h1>
      <p><code>&lt;sl-progress-bar&gt;</code> is registered by <code>@charm-ux/velcro</code> on top of the <code>@charm-ux/core</code> progress bar. Prototype status: unreleased.</p>
      <p>Its built-in text is localized; see <a href=${withBase('/localization')}>Localization</a>.</p>
      <p>Progress bars are used to show the status of an ongoing operation.</p>

      <h2 id="examples">Examples</h2>
      <p>The example covers the default bar, a label for assistive devices, a custom height, custom colors, showing values in the default slot, and the indeterminate state.</p>
      <iframe class="example" title="Progress Bar example" srcdoc=${exampleDocument(source)}></iframe>
      <pre><code>${source}</code></pre>

      ${apiReference('sl-progress-bar', {
        attributes: html`<p><code>value</code> and <code>indeterminate</code> are reflected to attributes; <code>label</code> is not reflected. <code>lang</code> is declared as a reactive property, as on Shoelace's base element, with no initial value; it selects the language of the accessible name.</p>`,
        slots: html`<p>The default slot holds a label to show inside the progress indicator. It is not rendered when <code>indeterminate</code> is set.</p>`,
        parts: html`<p><code>base</code> (the <code>div</code> with <code>role="progressbar"</code>), <code>indicator</code> and <code>label</code> (the default <code>slot</code>).</p>`,
        events: html`<p>None of Shoelace's. One inherited divergence: the core base class dispatches a non-bubbling, non-composed <code>ready</code> event on the element after its first update, which Shoelace does not do. It is kept and checked in the browser spec.</p>`,
      })}

      <h2 id="not-implemented">Not implemented or unverified</h2>
      <ul>
        ${gaps.map(g => html`<li>${g}</li>`)}
      </ul>
    `);
  }
}

export default ProgressBarPage;
