import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { definePageData } from '@beatzball/litro';
import { docsShell, shellStyles } from '../../src/shell.js';
import { themeHead } from '../../src/theme.js';
import { apiReference } from '../../src/api.js';
import { examples, exampleDocument, reactExamples } from '../../src/example.js';

export const pageData = definePageData(async () => ({
  seoTitle: 'Select - Velcro',
  seoHead: themeHead + '<meta name="description" content="Velcro select (prototype).">',
}));

// Shoelace's examples, in the order of its page: [id, title, text, example key, React example key]. The first has no heading in
// Shoelace's page; it is the page's opening example. Shoelace's page has no React version of Custom Tags or Lazy loading options.
const sections = [
  ['basic', 'Default', html`This component works with standard <code>&lt;form&gt;</code> elements: its value is added to the form's data under its <code>name</code>, and it takes part in the form's validation.`, 'select/default', 'select/react/default'],
  ['labels', 'Labels', html`Use the <code>label</code> attribute to give the select an accessible label. For labels that contain HTML, use the <code>label</code> slot instead.`, 'select/labels', 'select/react/labels'],
  ['help-text', 'Help Text', html`Add descriptive help text to a select with the <code>help-text</code> attribute. For help texts that contain HTML, use the <code>help-text</code> slot instead.`, 'select/help-text', 'select/react/help-text'],
  ['placeholders', 'Placeholders', html`Use the <code>placeholder</code> attribute to add a placeholder.`, 'select/placeholders', 'select/react/placeholders'],
  ['clearable', 'Clearable', html`Use the <code>clearable</code> attribute to make the control clearable. The clear button only appears when an option is selected.`, 'select/clearable', 'select/react/clearable'],
  ['filled', 'Filled Selects', html`Add the <code>filled</code> attribute to draw a filled select.`, 'select/filled', 'select/react/filled'],
  ['pill', 'Pill', html`Use the <code>pill</code> attribute to give selects rounded edges.`, 'select/pill', 'select/react/pill'],
  ['disabled', 'Disabled', html`Use the <code>disabled</code> attribute to disable a select.`, 'select/disabled', 'select/react/disabled'],
  ['multiple', 'Multiple', html`To allow multiple options to be selected, use the <code>multiple</code> attribute. It's a good practice to use <code>clearable</code> when this option is enabled. To set multiple values at once, set <code>value</code> to a space-delimited list of values. Note that multi-select options may wrap, causing the control to expand vertically. You can use the <code>max-options-visible</code> attribute to control the maximum number of selected options to show at once.`, 'select/multiple', 'select/react/multiple'],
  ['initial-value', 'Setting Initial Values', html`Use the <code>value</code> attribute to set the initial selection. When using <code>multiple</code>, the <code>value</code> <em>attribute</em> uses space-delimited values to select more than one option. Because of this, <code>&lt;sl-option&gt;</code> values cannot contain spaces. If you're accessing the <code>value</code> <em>property</em> through Javascript, it will be an array.`, 'select/initial-value', 'select/react/initial-value'],
  ['grouping', 'Grouping Options', html`Use <code>&lt;sl-divider&gt;</code> to group listbox items visually. You can also use <code>&lt;small&gt;</code> to provide labels, but they won't be announced by most assistive devices.`, 'select/grouping', 'select/react/grouping'],
  ['sizes', 'Sizes', html`Use the <code>size</code> attribute to change a select's size. Note that size does not apply to listbox options.`, 'select/sizes', 'select/react/sizes'],
  ['placement', 'Placement', html`The preferred placement of the select's listbox can be set with the <code>placement</code> attribute. Note that the actual position may vary to ensure the panel remains in the viewport. Valid placements are <code>top</code> and <code>bottom</code>.`, 'select/placement', 'select/react/placement'],
  ['prefix-suffix', 'Prefix & Suffix', html`Use the <code>prefix</code> and <code>suffix</code> slots to add presentational icons and text. Avoid slotting in interactive elements, such as buttons, links, etc.`, 'select/prefix-suffix', 'select/react/prefix-suffix'],
  ['custom-tags', 'Custom Tags', html`When multiple options can be selected, you can provide custom tags by passing a function to the <code>getTag</code> property. Your function can return a string of HTML, a Lit template, or an <code>HTMLElement</code>. The <code>getTag()</code> function will be called for each option. The first argument is an <code>&lt;sl-option&gt;</code> element and the second argument is the tag's index (its position in the tag list). Remember that custom tags are rendered in a shadow root. To style them, you can use the <code>style</code> attribute in your template or you can add your own parts and target them with the <code>::part()</code> selector. Be sure you trust the content you are outputting! Passing unsanitized user input to <code>getTag()</code> can result in XSS vulnerabilities.`, 'select/custom-tags', null],
  ['lazy-loading', 'Lazy loading options', html`Lazy loading options is very hard to get right. <code>&lt;sl-select&gt;</code> largely follows how a native <code>&lt;select&gt;</code> works. If a <code>&lt;sl-select&gt;</code> is created without any options, but is given a <code>value</code> attribute, its <code>value</code> will be <code>""</code>, and then when options are added, if any of the options have a value equal to the <code>&lt;sl-select&gt;</code> value, the value of the <code>&lt;sl-select&gt;</code> will equal that of the option. If a <code>&lt;sl-select multiple&gt;</code> with an initial value has multiple values, but only some of the options are present, it will only respect the options that are present, and if a selected option is loaded in later, <em>and</em> the value of the select has not changed via user interaction or direct property assignment, it will add the selected option to the form value and to the <code>.value</code> of the select.`, 'select/lazy-loading', null],
] as const;

// Shoelace 2.20.1 behaviors that look like bugs but are matched exactly (candidates for a later opt-in fix). One line each.
const quirks = [
  'The hidden attribute does not hide the select: the host\'s own display: block outranks the browser\'s [hidden] rule, so it stays displayed. Core\'s own base styles would hide it, so they are replaced by Shoelace\'s.',
  'A select never starts open: connecting it sets open to false, so an open attribute written in the markup is removed and the listbox stays closed until the user or a script opens it.',
  'Opening the listbox moves the focus to the highlighted option, so the select emits sl-blur when it opens, and sl-focus again when a selection or Escape returns the focus to the display input.',
  'Disabling a select emits sl-hide and sl-after-hide even when it is already closed: the disabled watcher runs the close sequence without checking.',
  'show() on a select that is already open closes it (it sets open to false and resolves to undefined at once); hide() on a closed select resolves to undefined at once.',
  'The keyboard does not skip disabled options: the arrow, Home and End keys and type to select move the highlight onto a disabled option, and Enter or Space on it does nothing (it is neither selected nor is the listbox closed). Pointer clicks on a disabled option are ignored.',
  'The placeholder only counts as visible for a multiple select: the select--placeholder-visible class is set when a multiple select has no selection, and never for a single select (an empty string is not "visible" in Shoelace\'s check). The placeholder text itself shows in both, through the display input\'s native placeholder.',
  'The value property is not reflected: the value attribute only sets defaultValue (and, while the user has not changed the selection, the value). Selecting an option leaves the attribute as written, and form reset returns to it.',
] as const;

const gaps = [
  'All sixteen of Shoelace\'s examples are ported with a live preview, in Shoelace\'s order. Fourteen have React versions, which import Velcro\'s generated wrappers (@charm-ux/velcro/react/VelcroSelect.js and VelcroOption.js, plus VelcroIcon.js and VelcroDivider.js where an example uses them) under Shoelace\'s names. One other change: Shoelace\'s Placement React example closes its <SlSelect> with </SlDropdown>, which does not compile, so the port closes it with </SlSelect>. Shoelace\'s page has no React version of Custom Tags or Lazy loading options, so none is shown here.',
  'Core\'s select wraps a native <select> with slotted <option> and <optgroup> elements, start and end slots and a numeric size; Shoelace\'s is a combobox over an <sl-popup> listbox of <sl-option> elements. Velcro builds sl-select on the core select but replaces its template, styles and behavior with Shoelace\'s: size takes Shoelace\'s small, medium and large, value is a string or, with multiple, an array, and native <option> children are not rendered. Core extras kept: hide-label (visually hides the label and help text) and error-message (sets a custom validity message, not rendered); invalid, label-position and readonly are accepted and reflected but have no effect; autofocus is core\'s reflected Boolean; ready is core\'s non-bubbling first-update event. The API tables label each one.',
  'The select is not form-associated, as in Shoelace: it finds its form from the form attribute or the closest <form>, adds its value (one entry per selected option when multiple) in the form\'s formdata event, and keeps validity on a hidden native input; it does not appear in form.elements and does not follow a disabled <fieldset>.',
  'sl-option is a separate component, as in Shoelace: the select\'s registering entry (@charm-ux/velcro/select) registers Velcro\'s sl-popup, sl-tag, sl-icon-button and sl-icon but not sl-option; import @charm-ux/velcro/option (or the package root, which registers both). Importing a class-only entry (@charm-ux/velcro/select/class) registers nothing; as with Shoelace\'s declared dependencies, constructing a select defines Velcro\'s sl-icon, sl-popup and sl-tag when those tags are not defined yet (and the tag defines sl-icon-button). If another constructor already owns one of those tags, the select renders that element and, as in Shoelace, logs a console warning when the two versions differ.',
  'The show and hide animations come from the animation registry, as in Shoelace: select.show and select.hide (opacity and scale, 100 ms ease), changed per element with setAnimation() or for every select with setDefaultAnimation(). When the user prefers reduced motion they run with a duration of 0. As in Shoelace, an animation\'s rtlKeyframes variant is used when the select\'s own dir property (set directly or through the attribute) is rtl, else when the document\'s direction, as the localization module last recorded it, is rtl. The tags\' and clear button\'s text comes from the localization module (numOptionsSelected and clearEntry).',
  'The value property has no type in the Custom Elements Manifest, as in Shoelace\'s manifest (its getter has no return annotation); its TypeScript type is string | string[]. The getTag manifest type names the option class SlOption, the alias the option\'s class entry exports for VelcroOption.',
  'dir and lang are declared as Shoelace\'s base element declares them: reactive, not reflected and undefined until set. Core\'s computed dir is not used. TypeScript types for dir are narrower than Shoelace\'s dir: string: at runtime dir is stored and returned as set and the setter accepts any string, but the read type stays core\'s \'ltr\' | \'rtl\' | \'auto\', because a subclass cannot widen an inherited getter\'s type. Fixing this needs a change in @charm-ux/core and is deferred.',
  'Shoelace\'s own select test (58 tests, including the shared form-control tests and axe accessibility checks) runs against Velcro in Chromium and passes. The product tests are configured for Chromium, Firefox and WebKit; this component\'s spec was run locally in Chromium and WebKit, and Firefox is covered only by the project\'s CI run. The accessibility checks are axe (in Shoelace\'s test) and Playwright\'s role, name and ARIA-state assertions, which Playwright computes from the DOM; no screen reader or browser accessibility API was tried, there is no right-to-left or touch check, and there is no pixel comparison with Shoelace.',
  'Registration is browser-only and uses the native custom element registry for Velcro\'s own class, without changing the shared core prefix. Server-side rendering is not supported.',
  'The select reads these theme tokens: --sl-input-* (font, height, border, background, colors, padding, focus ring and the label and help-text sizes), --sl-spacing-*, --sl-panel-background-color, --sl-panel-border-color, --sl-panel-border-width, --sl-border-radius-medium, --sl-shadow-large, --sl-z-index-dropdown and --sl-transition-*; both Velcro themes define them. Without a theme the select has no border, height or colors. Rendering under the dark theme has not been checked, and color contrast was not evaluated.',
];

@customElement('page-components-select')
export class SelectPage extends LitElement {
  static override styles = [shellStyles];

  override render() {
    return docsShell('select', html`
      <h1>Select</h1>
      <p><code>&lt;sl-select&gt;</code> is registered by <code>@charm-ux/velcro</code> on top of the <code>@charm-ux/core</code> select. Prototype status: unreleased.</p>
      <p>Selects allow you to choose items from a menu of predefined options.</p>

      <h2 id="examples">Examples</h2>
      <p>Each preview runs in its own document, so its script uses plain <code>document.querySelector</code>. The React version of each example that has one in Shoelace's page is ported to Velcro's generated React wrappers; only its import lines differ from Shoelace's (and the Placement example's closing tag, see below). It is shown as source and run by the product tests.</p>
      ${sections.map(
        ([id, title, text, key, react]) => html`
          <h3 id=${id}>${title}</h3>
          <p>${text}</p>
          <iframe class="example" title=${`Select example: ${title}`} srcdoc=${exampleDocument(examples[key])}></iframe>
          <pre><code>${examples[key]}</code></pre>
          ${react === null ? '' : html`
            <details class="react-example">
              <summary>React</summary>
              <pre><code>${reactExamples[react]}</code></pre>
            </details>
          `}
        `
      )}

      ${apiReference('sl-select', {
        attributes: html`<p><code>size</code>, <code>multiple</code>, <code>disabled</code>, <code>open</code>, <code>filled</code>, <code>pill</code>, <code>placement</code>, <code>form</code> and <code>required</code> are reflected. The <code>value</code> attribute maps to <code>defaultValue</code>; the <code>value</code> property is a string, or an array of strings when <code>multiple</code> is set, and is not reflected. Removing a reflected attribute restores the value the property held when the first attribute change was handled, as in Shoelace's base element (a removed Boolean attribute gives <code>false</code>). <code>dir</code> and <code>lang</code> are reactive properties with no default that are not reflected, as in Shoelace's base element. <code>popup</code>, <code>combobox</code>, <code>displayInput</code>, <code>valueInput</code>, <code>listbox</code>, <code>displayLabel</code>, <code>currentOption</code>, <code>selectedOptions</code>, <code>handleDefaultSlotChange()</code> and the <code>handle*Change()</code> watchers are Shoelace's public but undocumented members.</p>`,
        methods: html`<p><code>show()</code> and <code>hide()</code> return a promise that settles on <code>sl-after-show</code> or <code>sl-after-hide</code> (see the quirks for the already-open and already-closed cases). <code>focus()</code> and <code>blur()</code> act on the display input.</p>`,
        events: html`<p>Every event except <code>sl-invalid</code> bubbles, is composed and is not cancelable; <code>sl-invalid</code> does not bubble and is cancelable (canceling it also cancels the native <code>invalid</code> event). <code>sl-input</code> and <code>sl-change</code> follow a selection made by the user (pointer, keyboard, clear button or a tag's remove button), after the update, not one made by setting <code>value</code>; <code>sl-clear</code> precedes them when the clear button is used. <code>sl-show</code>, <code>sl-hide</code> and the after events follow every change of <code>open</code>. Inherited from core: a non-bubbling <code>ready</code> event on first update, which Shoelace does not have.</p>`,
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

export default SelectPage;
