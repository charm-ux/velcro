import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { definePageData } from '@beatzball/litro';
import { docsShell, shellStyles } from '../../src/shell.js';
import { themeHead } from '../../src/theme.js';
import { apiReference } from '../../src/api.js';
import { examples, exampleDocument } from '../../src/example.js';

export const pageData = definePageData(async () => ({
  seoTitle: 'Switch - Velcro',
  seoHead: themeHead + '<meta name="description" content="Velcro switch (prototype).">',
}));

const sections: Array<[string, string, string, string]> = [
  ['overview', 'Overview', 'switch/basic', 'Switches allow the user to toggle an option on or off. Click the switch or its label, press Space, or use ArrowRight to turn it on and ArrowLeft to turn it off.'],
  ['checked', 'Checked', 'switch/checked', 'Use the checked attribute to activate the switch.'],
  ['disabled', 'Disabled', 'switch/disabled', 'Use the disabled attribute to disable the switch.'],
  ['sizes', 'Sizes', 'switch/sizes', 'Use the size attribute to change a switch\'s size.'],
  ['help-text', 'Help text', 'switch/help-text', 'Add descriptive help text to a switch with the help-text attribute. For help texts that contain HTML, use the help-text slot instead.'],
  ['custom-styles', 'Custom styles', 'switch/custom-styles', 'Use the available custom properties to change how the switch is styled.'],
  ['forms', 'Forms', 'switch/forms', 'This component works with standard <form> elements. A checked switch submits its name with its value, or "on" when it has no value; an unchecked or disabled switch submits nothing. A required switch must be checked before the form submits, and a form reset restores the checked state the switch started with.'],
];

const quirks = [
  'The hidden attribute does not hide the switch: its :host { display: inline-block } rule outranks the browser\'s [hidden] rule.',
  'ArrowLeft on a switch that is already off, and ArrowRight on one that is already on, still emit sl-change and sl-input.',
  'The form attribute is reflected, so every switch carries form="" until it is set.',
  'The inner checkbox always points aria-describedby at the help text, even when there is none.',
];

const gaps = [
  'Velcro builds on the @charm-ux/core switch and keeps its extras, which are not part of the Shoelace contract: readonly (the switch keeps its state on clicks and arrow keys), label (label text shown when the default slot is empty), hide-label (visually hides the label and help text, which stay in the accessibility tree), error-message (sets a custom validity message, as setCustomValidity() does; it is not rendered) and autofocus (passed to the inner checkbox). The element also carries the core attribute "focusable" and emits the core ready event (see Events). The core invalid and label-position properties are accepted but have no effect (use data-invalid, as in Shoelace), and core\'s checked-message / unchecked-message slots and error text are not rendered. These extensions change nothing unless they are set.',
  'Core\'s switch emits change and input events; this one emits Shoelace\'s sl-change and sl-input instead. As in Shoelace, a click still lets the inner checkbox\'s native input event reach the element, but no change event does.',
  'As in Shoelace, the element is not form-associated: it does not appear in form.elements and is not disabled by a disabled <fieldset>. Its value is added in the form\'s formdata event. A switch attached to a form replaces the form\'s checkValidity() and reportValidity() with versions that also check Velcro controls (restored when the last one detaches), and sets data-valid / data-invalid / data-optional / data-required / data-user-valid / data-user-invalid attributes on itself.',
  'The validity, validationMessage, checkValidity(), reportValidity(), setCustomValidity(), click(), focus() and blur() members use the rendered inner checkbox, so, as in Shoelace, they throw when called before the first render.',
  'Registration is browser-only and uses the native custom element registry for Velcro\'s own class, without changing the shared core prefix. The core switch reads its scope while it is constructed; Velcro gives it a local scope that resolves core tags to sl-* names, never touches core\'s shared scope, and fails loudly if a declared dependency has no registered Velcro counterpart. The switch renders no other component. Server-side rendering is not supported.',
  'Shoelace\'s own switch tests run against Velcro and all pass. Rendering is checked by computed-style assertions in Chromium; there is no pixel comparison against Shoelace, and no Firefox or WebKit run. Dark rendering is not screenshot-checked.',
];

@customElement('page-components-switch')
export class SwitchPage extends LitElement {
  static override styles = [shellStyles];

  override render() {
    return docsShell('switch', html`
      <h1>Switch</h1>
      <p><code>&lt;sl-switch&gt;</code> is registered by <code>@charm-ux/velcro</code> on top of the <code>@charm-ux/core</code> switch. Prototype status: unreleased.</p>
      <p>Switches allow the user to toggle an option on or off.</p>

      <h2 id="examples">Examples</h2>
      <p>Each preview runs in its own document, so its script uses plain <code>document.querySelector</code>.</p>
      ${sections.map(
        ([id, title, key, text]) => html`
          <h3 id=${id}>${title}</h3>
          <p>${text}</p>
          <iframe class="example" title=${`Switch example: ${title}`} srcdoc=${exampleDocument(examples[key as keyof typeof examples])}></iframe>
          <pre><code>${examples[key as keyof typeof examples]}</code></pre>
        `
      )}

      ${apiReference('sl-switch', {
        attributes: html`<p>Removing a reflected attribute restores the property's initial value, as in Shoelace. Changing the <code>checked</code> attribute also updates <code>defaultChecked</code>, which a form reset restores.</p>`,
        events: html`<p><code>sl-change</code>, <code>sl-input</code>, <code>sl-focus</code> and <code>sl-blur</code> bubble and are composed; <code>sl-invalid</code> does not bubble and is cancelable. A click emits <code>sl-change</code>; ArrowLeft and ArrowRight emit <code>sl-change</code> then <code>sl-input</code>. Velcro extension, not in Shoelace: the core <code>ready</code> event, dispatched once on the element after its first update (it does not bubble and is not composed).</p>`,
      })}

      <h2 id="upstream-quirks">Upstream quirks matched</h2>
      <p>Shoelace 2.20.1 behaviour that Velcro reproduces on purpose, each a candidate for a later opt-in fix.</p>
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

export default SwitchPage;
