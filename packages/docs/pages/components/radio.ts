import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { definePageData } from '@beatzball/litro';
import { docsShell, shellStyles } from '../../src/shell.js';
import { themeHead } from '../../src/theme.js';
import { apiReference } from '../../src/api.js';
import { examples, exampleDocument, reactExamples } from '../../src/example.js';

export const pageData = definePageData(async () => ({
  seoTitle: 'Radio - Velcro',
  seoHead: themeHead + '<meta name="description" content="Velcro radio (prototype).">',
}));

const sections: Array<[string, string, keyof typeof examples, string, keyof typeof reactExamples]> = [
  ['overview', 'Overview', 'radio/overview', 'Radios are designed to be used with radio groups.', 'radio/react/overview'],
  ['initial-value', 'Initial Value', 'radio/initial-value', 'To set the initial value and checked state, use the value attribute on the containing radio group.', 'radio/react/initial-value'],
  ['disabled', 'Disabled', 'radio/disabled', 'Use the disabled attribute to disable a radio.', 'radio/react/disabled'],
  ['sizes', 'Sizes', 'radio/sizes', 'Add the size attribute to the radio group to change the radios\' size.', 'radio/react/sizes'],
];

const quirks = [
  'checked is internal state, not an attribute: <sl-radio checked> is not checked, and the property is never reflected. Only a radio group (or script) checks a radio.',
  'A click checks the radio but never unchecks it, and a radio on its own does not respond to Space or the arrow keys; Shoelace leaves selection and keyboard handling to the radio group.',
  'Every connect sets tabindex="-1", also on a checked radio, until checked next changes; a radio that is moved in the page while checked therefore leaves the tab order.',
  'A disabled radio keeps its checked state, and a checked disabled radio keeps tabindex="0".',
  'role, tabindex and aria-disabled are written on every connect, replacing values the page set; aria-checked and tabindex are written whenever checked changes.',
  'The hidden attribute does not hide the radio: its :host { display: block } rule outranks the browser\'s [hidden] rule.',
  'The .radio wrapper declares align-items: top, which is not a valid value, so browsers ignore it.',
];

const gaps = [
  'The examples put the radios in Velcro\'s <sl-radio-group>, as Shoelace\'s do. The React examples are Shoelace\'s, ported to Velcro\'s generated wrappers (@charm-ux/velcro/react/VelcroRadio.js and VelcroRadioGroup.js, imported under Shoelace\'s names); Shoelace\'s sizes snippet uses SlRadioGroup without importing it, so the port adds that import. Shoelace\'s one radio test (should not get checked when disabled) runs against Velcro and passes.',
  'Velcro builds on the @charm-ux/core radio and keeps its extras, which are not part of the Shoelace contract and change nothing unless they are set: readonly (a click does not check the radio), label (label text shown when the default slot is empty), hide-label (visually hides the label, which stays in the accessibility tree), vertical (stacks the label under the control) and the core selected event, emitted whenever the radio becomes checked. The element also emits the core ready event (see Events). Core\'s Space-key handling, its unchecking of a radio that becomes disabled, its reactive autofocus property (autofocus is the platform\'s own property, which reflects synchronously, as in Shoelace; the API table lists it with core\'s description), its own blur and focus events and its radio-* parts and --radio-* custom properties are not used.',
  'dir and lang are declared as Shoelace\'s base element declares them: reactive, not reflected and undefined until set. TypeScript types for dir are narrower than Shoelace\'s dir: string: the setter accepts any string (type-tests/radio-dir.tsx checks it), but the read type stays core\'s \'ltr\' | \'rtl\' | \'auto\', and the manifest, the API table below, the React wrapper\'s dir prop and the JSX types follow it. Fixing this needs a change in @charm-ux/core and is deferred.',
  'Registration is browser-only and uses the native custom element registry for Velcro\'s own class, without changing the shared core prefix; the radio uses Velcro\'s local scope resolver. A checked radio renders an <sl-icon> from the system library, so the radio\'s entry registers Velcro\'s icon too. Server-side rendering is not supported.',
  'Rendering is checked by computed-style assertions in Chromium and WebKit locally and in Firefox in CI; there is no pixel comparison against Shoelace. Dark rendering is not screenshot-checked. Shoelace\'s radio uses no localized terms.',
];

@customElement('page-components-radio')
export class RadioPage extends LitElement {
  static override styles = [shellStyles];

  override render() {
    return docsShell('radio', html`
      <h1>Radio</h1>
      <p><code>&lt;sl-radio&gt;</code> is registered by <code>@charm-ux/velcro</code> on top of the <code>@charm-ux/core</code> radio. Prototype status: unreleased.</p>
      <p>Radios allow the user to select a single option from a group.</p>

      <h2 id="examples">Examples</h2>
      <p>Each preview runs in its own document. Radios are placed in a <code>&lt;sl-radio-group&gt;</code>, as in Shoelace. Each example also has Shoelace's React version, ported to Velcro's generated React wrappers; it is shown as source.</p>
      ${sections.map(
        ([id, title, key, text, react]) => html`
          <h3 id=${id}>${title}</h3>
          <p>${text}</p>
          <iframe class="example" title=${`Radio example: ${title}`} srcdoc=${exampleDocument(examples[key])}></iframe>
          <pre><code>${examples[key]}</code></pre>
          <details class="react-example">
            <summary>React</summary>
            <pre><code>${reactExamples[react]}</code></pre>
          </details>
        `
      )}

      ${apiReference('sl-radio', {
        attributes: html`<p>Removing a reflected attribute restores the property's initial value, as in Shoelace. <code>checked</code> is a property only; <code>value</code> is not reflected. <code>dir</code> and <code>lang</code> are reactive properties with no default that are not reflected, as in Shoelace's base element.</p>`,
        events: html`<p><code>sl-focus</code> and <code>sl-blur</code> bubble and are composed. Velcro extensions, not in Shoelace: the core <code>ready</code> event, dispatched once on the element after its first update (it does not bubble and is not composed), and the core <code>selected</code> event (bubbles, composed), dispatched whenever the radio becomes checked.</p>`,
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

export default RadioPage;
