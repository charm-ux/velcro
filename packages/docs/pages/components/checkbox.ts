import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { definePageData } from '@beatzball/litro';
import { docsShell, shellStyles } from '../../src/shell.js';
import { themeHead } from '../../src/theme.js';
import { apiReference } from '../../src/api.js';
import { examples, exampleDocument, reactExamples } from '../../src/example.js';

export const pageData = definePageData(async () => ({
  seoTitle: 'Checkbox - Velcro',
  seoHead: themeHead + '<meta name="description" content="Velcro checkbox (prototype).">',
}));

// [id, title, HTML example, text, React example]
const sections: Array<[string, string, string, string, string]> = [
  ['overview', 'Overview', 'checkbox/basic', 'Checkboxes allow the user to toggle an option on or off. Click the checkbox or its label, or press Space while it has focus.', 'checkbox/react/basic'],
  ['checked', 'Checked', 'checkbox/checked', 'Use the checked attribute to activate the checkbox.', 'checkbox/react/checked'],
  ['indeterminate', 'Indeterminate', 'checkbox/indeterminate', 'Use the indeterminate attribute to make the checkbox indeterminate.', 'checkbox/react/indeterminate'],
  ['disabled', 'Disabled', 'checkbox/disabled', 'Use the disabled attribute to disable the checkbox.', 'checkbox/react/disabled'],
  ['sizes', 'Sizes', 'checkbox/sizes', 'Use the size attribute to change a checkbox\'s size.', 'checkbox/react/sizes'],
  ['help-text', 'Help Text', 'checkbox/help-text', 'Add descriptive help text to a checkbox with the help-text attribute. For help texts that contain HTML, use the help-text slot instead.', 'checkbox/react/help-text'],
  ['custom-validity', 'Custom Validity', 'checkbox/custom-validity', 'Use the setCustomValidity() method to set a custom validation message. This will prevent the form from submitting and make the browser display the error message you provide. To clear the error, call this function with an empty string.', 'checkbox/react/custom-validity'],
];

const quirks = [
  'The hidden attribute does not hide the checkbox: its :host { display: inline-block } rule outranks the browser\'s [hidden] rule.',
  'The form attribute is reflected, so every checkbox carries form="" until it is set.',
  'The inner checkbox always points aria-describedby at the help text, even when there is none.',
  'The inner checkbox carries aria-checked="true" or "false" even while the checkbox is indeterminate (the native indeterminate state is set as well).',
  'A form reset restores checked but leaves indeterminate as it is.',
];

const gaps = [
  'Velcro builds on the @charm-ux/core checkbox and keeps its extras, which are not part of the Shoelace contract: readonly (the checkbox keeps its state on clicks and Space), label (label text shown when the default slot is empty), hide-label (visually hides the label and help text, which stay in the accessibility tree), and error-message (sets a custom validity message, as setCustomValidity() does; it is not rendered). The core invalid, label-position and autofocus properties are accepted and reflected but have no effect (use data-invalid, as in Shoelace; as in Shoelace, autofocus does not focus the checkbox), and core\'s label slot, error text and core-only parts and custom properties are not rendered. The element also carries the core attribute "focusable" and emits the core ready event (see Events); apart from those two, the extensions change nothing unless they are set. As in Shoelace, dir and lang are plain reactive properties (undefined unless set, not reflected) and focus is not delegated: clicking the help text does not focus the checkbox.',
  'Core\'s checkbox emits change and input events; this one emits Shoelace\'s sl-change and sl-input instead. As in Shoelace, a click still lets the inner checkbox\'s native input event reach the element, but no change event does.',
  'As in Shoelace, the element is not form-associated: it does not appear in form.elements and is not disabled by a disabled <fieldset>. Its value is added in the form\'s formdata event. A checkbox attached to a form replaces the form\'s checkValidity() and reportValidity() with versions that also check Velcro controls (restored when the last one detaches), and sets data-valid / data-invalid / data-optional / data-required / data-user-valid / data-user-invalid attributes on itself. serialize() and getFormControls() are exported as @charm-ux/velcro/utilities/form, as in Shoelace\'s utilities/form.',
  'The validity, validationMessage, checkValidity(), reportValidity(), setCustomValidity(), click(), focus() and blur() members use the rendered inner checkbox, so, as in Shoelace, they throw when called before the first render.',
  'TypeScript types: dir is typed as in the other components: the setter accepts any string, but the read type stays core\'s \'ltr\' | \'rtl\' | \'auto\' until a change in @charm-ux/core (type-tests/checkbox-dir.tsx checks the setter).',
  'The checked and indeterminate icons are Velcro\'s <sl-icon> from the system icon library. As in Shoelace, constructing a checkbox defines <sl-icon> when no element owns that tag yet, so the class-only entry needs no extra registration. The checkbox has no translatable text. Registration is browser-only and uses the native custom element registry for Velcro\'s own class, without changing the shared core prefix. Server-side rendering is not supported.',
  'Shoelace\'s own checkbox tests, including its axe accessibility check, run against Velcro in Chromium and all 42 pass. The product tests (structure, ARIA, computed styles against Shoelace\'s rules, events, keyboard, forms and the examples with their React versions) are configured for Chromium, Firefox and WebKit. There is no pixel comparison with Shoelace, no RTL or screen reader check, and the examples\' appearance under the dark theme has not been checked.',
];

@customElement('page-components-checkbox')
export class CheckboxPage extends LitElement {
  static override styles = [shellStyles];

  override render() {
    return docsShell('checkbox', html`
      <h1>Checkbox</h1>
      <p><code>&lt;sl-checkbox&gt;</code> is registered by <code>@charm-ux/velcro</code> on top of the <code>@charm-ux/core</code> checkbox. Prototype status: unreleased.</p>
      <p>Checkboxes allow the user to toggle an option on or off. This component works with standard <code>&lt;form&gt;</code> elements: a checked checkbox submits its name with its value, or "on" when it has no value; an unchecked or disabled checkbox submits nothing. It takes part in client-side validation (<code>required</code> and <code>setCustomValidity()</code>), and a form reset restores the checked state the checkbox started with.</p>

      <h2 id="examples">Examples</h2>
      <p>Each preview runs in its own document, so its script uses plain <code>document.querySelector</code>. Every example also has Shoelace's React version, ported to Velcro's generated React wrappers (<code>@charm-ux/velcro/react/VelcroCheckbox.js</code>, imported under Shoelace's name); only the import lines differ from Shoelace's. They are shown as source and run by the product tests.</p>
      ${sections.map(
        ([id, title, key, text, react]) => html`
          <h3 id=${id}>${title}</h3>
          <p>${text}</p>
          <iframe class="example" title=${`Checkbox example: ${title}`} srcdoc=${exampleDocument(examples[key as keyof typeof examples])}></iframe>
          <pre><code>${examples[key as keyof typeof examples]}</code></pre>
          <details class="react-example">
            <summary>React</summary>
            <pre><code>${reactExamples[react as keyof typeof reactExamples]}</code></pre>
          </details>
        `
      )}

      ${apiReference('sl-checkbox', {
        attributes: html`<p>Removing a reflected attribute (<code>size</code>, <code>disabled</code>, <code>checked</code>, <code>indeterminate</code>, <code>form</code>, <code>required</code>) restores the property's initial value, as in Shoelace. Changing the <code>checked</code> attribute also updates <code>defaultChecked</code>, which a form reset restores. <code>value</code> is undefined until set and, like <code>name</code>, is not reflected. <code>input</code> (the inner checkbox), <code>title</code>, <code>handleDisabledChange()</code> and <code>handleStateChange()</code> are Shoelace's public but undocumented members. Velcro extensions, not in Shoelace: <code>readonly</code>, <code>label</code>, <code>hideLabel</code> and <code>errorMessage</code> (inherited from core and kept working), and <code>invalid</code>, <code>labelPosition</code> and <code>autofocus</code>, which are accepted and reflected but have no effect (the API table marks them inert).</p>`,
        events: html`<p><code>sl-change</code>, <code>sl-input</code>, <code>sl-focus</code> and <code>sl-blur</code> bubble and are composed; <code>sl-invalid</code> does not bubble and is cancelable. <code>sl-change</code> and <code>sl-input</code> are emitted when the user toggles the checkbox, not when <code>checked</code> or <code>indeterminate</code> is set by script. Velcro extension, not in Shoelace: the core <code>ready</code> event, dispatched once on the element after its first update (it does not bubble and is not composed). The native <code>focus</code> and <code>blur</code> events of the inner checkbox are retargeted to the element, as in Shoelace.</p>`,
        slots: html`<p>The <code>help-text</code> slot takes precedence over the attribute of the same name when both are present.</p>`,
      })}

      <h2 id="upstream-quirks">Upstream quirks matched</h2>
      <p>Velcro matches Shoelace 2.20.1 exactly, including behavior that looks like a bug. Each of these is covered by a product test and is a candidate for a later opt-in fix.</p>
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

export default CheckboxPage;
