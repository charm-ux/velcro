import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { definePageData } from '@beatzball/litro';
import { docsShell, shellStyles } from '../../src/shell.js';
import { themeHead } from '../../src/theme.js';
import { apiReference } from '../../src/api.js';
import { examples, exampleDocument, reactExamples } from '../../src/example.js';

export const pageData = definePageData(async () => ({
  seoTitle: 'Radio Group - Velcro',
  seoHead: themeHead + '<meta name="description" content="Velcro radio group (prototype).">',
}));

const sections = [
  ['overview', 'Overview', 'radio-group/overview', 'Radio groups are used to group multiple radios or radio buttons so they function as a single form control.', 'radio-group/react/overview'],
  ['help-text', 'Help Text', 'radio-group/help-text', 'Add descriptive help text to a radio group with the help-text attribute. For help texts that contain HTML, use the help-text slot instead.', 'radio-group/react/help-text'],
  ['radio-buttons', 'Radio Buttons', 'radio-group/radio-buttons', 'Radio buttons offer an alternate way to display radio controls. In this case, an internal button group is used to group the buttons into a single, cohesive control.', 'radio-group/react/radio-buttons'],
  ['disabling-options', 'Disabling Options', 'radio-group/disabling-options', 'Radios and radio buttons can be disabled by adding the disabled attribute to the respective options inside the radio group.', 'radio-group/react/disabling-options'],
  ['sizing-options', 'Sizing Options', 'radio-group/sizing-options', 'The size of radios and radio buttons will be determined by the radio group\'s size attribute. Radios and radio buttons also have a size attribute, which is ignored inside a radio group.', 'radio-group/react/sizing-options'],
  ['validation', 'Validation', 'radio-group/validation', 'Setting the required attribute to make selecting an option mandatory. If a value has not been selected, it will prevent the form from submitting and display an error message.', 'radio-group/react/validation'],
  ['custom-validity', 'Custom Validity', 'radio-group/custom-validity', 'Use the setCustomValidity() method to set a custom validation message. This will prevent the form from submitting and make the browser display the error message you provide. To clear the error, call this function with an empty string.', 'radio-group/react/custom-validity'],
] as const;

// Shoelace 2.20.1 behaviors that look like bugs but are matched exactly (candidates for a later opt-in fix). One line each.
const quirks = [
  'reportValidity() with a custom validity message leaves the visually hidden error region empty: Shoelace\'s expression reads (custom message || valid) ? \'\' : message, so only the required message is ever announced there. setCustomValidity() itself writes the message into the region.',
  'required is satisfied by any non-empty value, even one that matches no radio, so value="x" with no radio of that value is valid and no radio is checked.',
  'name defaults to "option", so a group without a name still submits its value as option=value.',
  'sl-change is emitted before sl-input, on a click and on an arrow key or Space alike.',
  'defaultValue (what a form reset restores) is taken from value each time the group connects, so a group that is moved in the page resets to the value it had when it moved.',
  'The group\'s size overrides each radio\'s own size, but only when the slot changes or the group\'s size changes; a radio\'s size set later stays until then.',
  'The hidden attribute does not hide the group: its :host { display: block } rule outranks the browser\'s [hidden] rule.',
] as const;

const gaps = [
  'Velcro builds on the @charm-ux/core radio group and keeps four of its extras, which are not part of the Shoelace contract and change nothing unless set: disabled (disables every radio the group holds, also radios added while it is set, and when removed re-enables exactly the radios it disabled, so radios disabled on their own stay disabled; a disabled group is left out of form data, ignores the arrow keys and Space and, like a disabled native control, is barred from validation: it is valid, checkValidity() and reportValidity(), also the form\'s, return true without an sl-invalid event or message, and enabling it restores its required or custom validity), readonly (clicks, arrow keys and Space do not change the value; sl-radio also gets readonly), hide-label (visually hides the label and help text, which stay accessible) and error-message (applies setCustomValidity() with that message after the next update). Core\'s layout, invalid and label-position are accepted and reflected but have no effect (the API table marks them inert). autofocus is the platform\'s own property, which reflects synchronously, as in Shoelace; core\'s reactive autofocus is not used, and the API table lists it with core\'s description. Core\'s change, input, blur and focus events are not emitted; core\'s error text part and icon, its host tab stop and its form association through ElementInternals are not used. The core ready event is emitted once after the first update (see Events).',
  'The group takes part in forms as Shoelace\'s does: it is not form-associated, it finds its form through form or the closest <form>, adds name=value in the formdata event and checks validity on submit. It works with native <form> elements; form.checkValidity() and form.reportValidity() include it, as in Shoelace.',
  'Constructing a radio group defines sl-button-group (Velcro\'s button group) if no element owns that tag yet, as Shoelace\'s dependencies do; the group\'s entry also registers it, under the same rule (an sl-button-group another constructor owns is left in place, without an error, with Shoelace\'s console warning when the two versions differ). sl-radio and sl-radio-button are registered by their own entries, as in Shoelace.',
  'dir and lang are declared as Shoelace\'s base element declares them: reactive, not reflected and undefined until set. TypeScript types for dir are narrower than Shoelace\'s dir: string: the setter accepts any string (type-tests/radio-group-dir.tsx checks it), but the read type stays core\'s \'ltr\' | \'rtl\' | \'auto\', and the manifest, the API table below, the React wrapper\'s dir prop and the JSX types follow it. Fixing this needs a change in @charm-ux/core and is deferred.',
  'Shoelace\'s React examples are ported with Velcro\'s generated wrappers (@charm-ux/velcro/react/VelcroRadioGroup.js, VelcroRadio.js, VelcroRadioButton.js, VelcroButton.js and VelcroIcon.js, imported under Shoelace\'s names). Two of Shoelace\'s React snippets do not compile or throw as published, so their ports are fixed: the validation example\'s misspelt <SlRadiovalue="2"> and its reference to an undefined handleChange are corrected and removed, and the custom validity example calls setCustomValidity() on radioGroup.current instead of the undefined radio.current, after the group\'s first render (its updateComplete), because React runs the effect before the element has rendered the validation input that setCustomValidity() uses, which throws in Shoelace too. They are shown as source and run by the product tests.',
  'Shoelace\'s 43 radio group tests run against Velcro in Chromium; 42 pass and one is skipped by Shoelace itself (it.skip). Product tests run in Chromium and WebKit locally and in Firefox in CI. There is no screen reader check, no pixel comparison against Shoelace, and the browser\'s own validation bubble is not checked beyond the validity state. Dark rendering is not screenshot-checked.',
  'Registration is browser-only and uses the native custom element registry for Velcro\'s own class, without changing the shared core prefix; core\'s scope lookups go through Velcro\'s local scope resolver. Server-side rendering is not supported.',
];

@customElement('page-components-radio-group')
export class RadioGroupPage extends LitElement {
  static override styles = [shellStyles];

  override render() {
    return docsShell('radio-group', html`
      <h1>Radio Group</h1>
      <p><code>&lt;sl-radio-group&gt;</code> is registered by <code>@charm-ux/velcro</code> on top of the <code>@charm-ux/core</code> radio group. Prototype status: unreleased.</p>
      <p>Radio groups are used to group multiple radios or radio buttons so they function as a single form control.</p>

      <h2 id="examples">Examples</h2>
      <p>Each preview runs in its own document, so its script uses plain <code>document.querySelector</code>; the scripts are module scripts (Shoelace's are classic), so they run after Velcro has registered the elements, as on Shoelace's page. Every example also has Shoelace's React version, ported to Velcro's generated React wrappers (see "Not implemented or unverified" below); it is shown as source.</p>
      ${sections.map(
        ([id, title, key, text, react]) => html`
          <h3 id=${id}>${title}</h3>
          <p>${text}</p>
          <iframe class="example" title=${`Radio Group example: ${title}`} srcdoc=${exampleDocument(examples[key])}></iframe>
          <pre><code>${examples[key]}</code></pre>
          <details class="react-example">
            <summary>React</summary>
            <pre><code>${reactExamples[react]}</code></pre>
          </details>
        `
      )}

      ${apiReference('sl-radio-group', {
        attributes: html`<p><code>value</code>, <code>size</code>, <code>form</code> and <code>required</code> are reflected; <code>label</code>, <code>help-text</code> and <code>name</code> are not, as in Shoelace. Removing a reflected attribute restores the property's initial value, as in Shoelace. <code>defaultValue</code>, <code>defaultSlot</code> and <code>validationInput</code> are Shoelace's public but undocumented members. <code>dir</code> and <code>lang</code> are reactive properties with no default that are not reflected, as in Shoelace's base element.</p>`,
        events: html`<p><code>sl-change</code> and <code>sl-input</code> bubble and are composed; <code>sl-invalid</code> does not bubble and is cancelable, as in Shoelace. Velcro extension, not in Shoelace: the core <code>ready</code> event, dispatched once on the element after its first update (it does not bubble and is not composed).</p>`,
        parts: html`<p>The <code>button-group</code> and <code>button-group__base</code> parts exist only while the group holds radio buttons.</p>`,
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

export default RadioGroupPage;
