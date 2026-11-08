import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { definePageData } from '@beatzball/litro';
import { docsShell, shellStyles } from '../../src/shell.js';
import { themeHead } from '../../src/theme.js';
import { apiReference } from '../../src/api.js';
import { examples, exampleDocument, reactExamples } from '../../src/example.js';

export const pageData = definePageData(async () => ({
  seoTitle: 'Radio Button - Velcro',
  seoHead: themeHead + '<meta name="description" content="Velcro radio button (prototype).">',
}));

const sections = [
  ['overview', 'Overview', 'radio-button/overview', 'Radio buttons are designed to be used with radio groups. When a radio button has focus, the arrow keys can be used to change the selected option just like standard radio controls.', 'radio-button/react/overview'],
  ['checked-states', 'Checked States', 'radio-button/checked-states', 'To set the initial value and checked state, use the value attribute on the containing radio group.', 'radio-button/react/checked-states'],
  ['disabled', 'Disabled', 'radio-button/disabled', 'Use the disabled attribute to disable a radio button.', 'radio-button/react/disabled'],
  ['sizes', 'Sizes', 'radio-button/sizes', 'Use the size attribute to change a radio button\'s size.', 'radio-button/react/sizes'],
  ['pill', 'Pill Buttons', 'radio-button/pill', 'Use the pill attribute to give radio buttons rounded edges.', 'radio-button/react/pill'],
  ['prefix-suffix', 'Prefix and Suffix Icons', 'radio-button/prefix-suffix', 'Use the prefix and suffix slots to add icons.', 'radio-button/react/prefix-suffix'],
  ['icons', 'Buttons with Icons', 'radio-button/icons', 'You can omit button labels and use icons instead. Make sure to set a label attribute on each icon so screen readers will announce each option correctly.', 'radio-button/react/icons'],
] as const;

// Shoelace 2.20.1 behaviors that look like bugs but are matched exactly (candidates for a later opt-in fix). One line each.
const quirks = [
  'On its own, outside a radio group, a click checks the radio button but never unchecks it, and nothing unchecks the other radio buttons. The arrow keys do nothing; Space and Enter activate the inner native button, whose click checks it, again without unchecking any other. Shoelace leaves exclusive selection and arrow-key handling to the group.',
  'aria-disabled is written on the host only when disabled changes after the first render; a radio button that starts disabled has no host aria-disabled (its inner button has aria-disabled="true").',
  'The hiddenInput member queries a .hidden-input element the template never renders, so it is always null; the .hidden-input styles match nothing.',
  'The hidden attribute does not hide the radio button: its :host { display: inline-block } rule outranks the browser\'s [hidden] rule.',
] as const;

const gaps = [
  'There is no @charm-ux/core radio button, so the element extends the core base element and implements Shoelace\'s radio button directly. It reuses Velcro\'s button styles (adapted from Shoelace\'s, as Shoelace\'s radio button imports its button styles); their only addition, the caret sizing, matches nothing in a radio button. The core ready event is emitted once after the first update (see Events).',
  'checked is Shoelace\'s internal property: it is reflected so button group styles can read it, and a radio group sets it. Like Shoelace\'s, the manifest and the API table below do not list it, because it is marked @internal.',
  'Which content counts as a label (the button--has-label class, which sets the label\'s padding) follows Shoelace\'s rule: non-blank text or any element without a slot attribute, except <sl-visually-hidden>. Core\'s slot controller, which other Velcro components use, also ignores elements with a visually-hidden class and does not ignore <sl-visually-hidden>; the radio button uses Shoelace\'s rule instead.',
  'dir and lang are declared as Shoelace\'s base element declares them: reactive, not reflected and undefined until set. TypeScript types for dir are narrower than Shoelace\'s dir: string: the setter accepts any string (type-tests/radio-button-dir.tsx checks it), but the read type stays core\'s \'ltr\' | \'rtl\' | \'auto\', and the manifest, the API table below, the React wrapper\'s dir prop and the JSX types follow it. Fixing this needs a change in @charm-ux/core and is deferred.',
  'Shoelace\'s React examples are ported with Velcro\'s generated wrappers (@charm-ux/velcro/react/VelcroRadioButton.js, VelcroRadioGroup.js and VelcroIcon.js, imported under Shoelace\'s names). Besides the import lines, Shoelace\'s sizes and pill snippets return three adjacent groups without a parent, which does not compile, so their ports wrap them in a fragment. They are shown as source and run by the product tests.',
  'Shoelace\'s two radio button tests run against Velcro in Chromium and pass. Product tests run in Chromium and WebKit locally and in Firefox in CI. There is no screen reader check or pixel comparison against Shoelace, and dark rendering is not screenshot-checked.',
  'Registration is browser-only and uses the native custom element registry for Velcro\'s own class, without changing the shared core prefix. Server-side rendering is not supported.',
];

@customElement('page-components-radio-button')
export class RadioButtonPage extends LitElement {
  static override styles = [shellStyles];

  override render() {
    return docsShell('radio-button', html`
      <h1>Radio Button</h1>
      <p><code>&lt;sl-radio-button&gt;</code> is registered by <code>@charm-ux/velcro</code>; there is no <code>@charm-ux/core</code> radio button, so it builds on the core base element. Prototype status: unreleased.</p>
      <p>Radios buttons allow the user to select a single option from a group using a button-like control.</p>

      <h2 id="examples">Examples</h2>
      <p>Each preview runs in its own document. Every example also has Shoelace's React version, ported to Velcro's generated React wrappers (see "Not implemented or unverified" below); it is shown as source.</p>
      ${sections.map(
        ([id, title, key, text, react]) => html`
          <h3 id=${id}>${title}</h3>
          <p>${text}</p>
          <iframe class="example" title=${`Radio Button example: ${title}`} srcdoc=${exampleDocument(examples[key])}></iframe>
          <pre><code>${examples[key]}</code></pre>
          <details class="react-example">
            <summary>React</summary>
            <pre><code>${reactExamples[react]}</code></pre>
          </details>
        `
      )}

      ${apiReference('sl-radio-button', {
        attributes: html`<p><code>checked</code>, <code>disabled</code>, <code>size</code> and <code>pill</code> are reflected; <code>value</code> is not. Removing a reflected attribute restores the property's initial value, as in Shoelace. <code>input</code> and <code>hiddenInput</code> are Shoelace's public but undocumented members. <code>dir</code> and <code>lang</code> are reactive properties with no default that are not reflected, as in Shoelace's base element.</p>`,
        events: html`<p><code>sl-focus</code> and <code>sl-blur</code> bubble and are composed. Velcro extension, not in Shoelace: the core <code>ready</code> event, dispatched once on the element after its first update (it does not bubble and is not composed).</p>`,
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

export default RadioButtonPage;
