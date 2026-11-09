import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { definePageData } from '@beatzball/litro';
import { docsShell, shellStyles } from '../../src/shell.js';
import { themeHead } from '../../src/theme.js';
import { apiReference } from '../../src/api.js';
import { examples, exampleDocument, reactExamples } from '../../src/example.js';

export const pageData = definePageData(async () => ({
  seoTitle: 'Range - Velcro',
  seoHead: themeHead + '<meta name="description" content="Velcro range (prototype).">',
}));

// Shoelace's examples, in the order of its page: [id, heading, text, example key, React example key]. The first has no
// heading in Shoelace's page (it is the page's opening example).
const sections = [
  ['basic', 'Default', null, 'range/basic', 'range/react/basic'],
  ['labels', 'Labels', html`Use the <code>label</code> attribute to give the range an accessible label. For labels that contain HTML, use the <code>label</code> slot instead.`, 'range/labels', 'range/react/labels'],
  ['help-text', 'Help Text', html`Add descriptive help text to a range with the <code>help-text</code> attribute. For help texts that contain HTML, use the <code>help-text</code> slot instead.`, 'range/help-text', 'range/react/help-text'],
  ['min-max-step', 'Min, Max, and Step', html`Use the <code>min</code> and <code>max</code> attributes to set the range's minimum and maximum values, respectively. The <code>step</code> attribute determines the value's interval when increasing and decreasing.`, 'range/min-max-step', 'range/react/min-max-step'],
  ['disabled', 'Disabled', html`Use the <code>disabled</code> attribute to disable a slider.`, 'range/disabled', 'range/react/disabled'],
  ['tooltip-placement', 'Tooltip Placement', html`By default, the tooltip is shown on top. Set <code>tooltip</code> to <code>bottom</code> to show it below the slider.`, 'range/tooltip-placement', 'range/react/tooltip-placement'],
  ['disable-tooltip', 'Disable the Tooltip', html`To disable the tooltip, set <code>tooltip</code> to <code>none</code>.`, 'range/disable-tooltip', 'range/react/disable-tooltip'],
  ['custom-track-colors', 'Custom Track Colors', html`You can customize the active and inactive portions of the track using the <code>--track-color-active</code> and <code>--track-color-inactive</code> custom properties.`, 'range/custom-track-colors', 'range/react/custom-track-colors'],
  ['custom-track-offset', 'Custom Track Offset', html`You can customize the initial offset of the active track using the <code>--track-active-offset</code> custom property.`, 'range/custom-track-offset', 'range/react/custom-track-offset'],
  ['custom-tooltip-formatter', 'Custom Tooltip Formatter', html`You can change the tooltip's content by setting the <code>tooltipFormatter</code> property to a function that accepts the range's value as an argument.`, 'range/custom-tooltip-formatter', 'range/react/custom-tooltip-formatter'],
] as const;
const untitled = new Set<string>(['basic']);

// Shoelace 2.20.1 behaviors that look like bugs but are matched exactly (candidates for a later opt-in fix). One line each.
const quirks = [
  'value, min, max, step, label, help-text, name and tooltip are not reflected, and removing their attribute sets the property to null rather than its default (for value, defaultValue becomes null too). A null value makes the next render throw a TypeError, because the template reads value.toString(); the range renders again once value is a number.',
  'A range that is disconnected before its first render throws a TypeError from disconnectedCallback, because the resize observer is told to stop observing an input that does not exist yet.',
  'The tooltip is shown while the range has focus or is being pressed, but it hides on the mouse or touch release even though the range keeps the focus, and it stays hidden when the keyboard then changes the value; it shows again after the focus leaves and returns.',
  'Changing min or max does not re-clamp value: the property keeps its old value, and the form submits it, while the native control shows the clamped one, until value is set to something different.',
  'The --percent custom property that draws the track is written with floating-point noise (a value of 55 gives 55.00000000000001%).',
  'The form attribute is reflected, so every range carries form="" until it is set.',
  'The inner <input> always points aria-describedby at the help text, even when there is none, and always carries name, min, max, step and title attributes (name="" and title="" by default).',
  'focus(), blur(), stepUp(), stepDown(), checkValidity(), reportValidity(), setCustomValidity() and the validity and validationMessage getters use the rendered inner <input>, so they throw when called before the first render.',
] as const;

const gaps = [
  'All of Shoelace\'s examples are ported with a live preview and a React version, in Shoelace\'s order. The React examples import Velcro\'s generated wrapper (@charm-ux/velcro/react/VelcroRange.js) under Shoelace\'s name; nothing else differs. Shoelace\'s own HTML and React versions of Custom Track Colors differ (the inactive track is primary-100 in HTML and primary-200 in React) and are ported as they are.',
  'Shoelace\'s opening tip links to its "form controls" guide, which Velcro does not have; the intro above describes the form behavior instead.',
  'Velcro builds sl-range on the @charm-ux/core base element, because @charm-ux/core has no range. The only core extension that remains is the non-bubbling ready event on first update, which the API tables label as inherited from core. Core\'s base styles are replaced by Shoelace\'s.',
  'The public input and output fields (the inner <input> and the tooltip <output>, null while there is no tooltip), title and the handleValueChange, handleDisabledChange and syncRange methods exist as in Shoelace, which lists them in its manifest without a description; the API tables below list them too.',
  'dir and lang are declared as Shoelace\'s base element declares them: reactive, not reflected and undefined until set. Core\'s computed dir is not used. TypeScript types for dir are narrower than Shoelace\'s dir: string: at runtime dir is stored and returned as set and the setter accepts any string, but the read type stays core\'s \'ltr\' | \'rtl\' | \'auto\', because a subclass cannot widen an inherited getter\'s type. Fixing this needs a change in @charm-ux/core and is deferred.',
  'As in Shoelace, the element is not form-associated: it does not appear in form.elements and is not disabled by a disabled <fieldset>. Its value is added in the form\'s formdata event. A range attached to a form replaces the form\'s checkValidity() and reportValidity() with versions that also check Velcro controls (restored when the last one detaches), and sets data-valid / data-invalid / data-optional / data-required / data-user-valid / data-user-invalid attributes on itself. serialize() and getFormControls() are exported as @charm-ux/velcro/utilities/form, as in Shoelace\'s utilities/form.',
  'Shoelace\'s range has no translatable text, so there is nothing to localize; a change of the document\'s direction re-renders the range, which flips the tooltip placement. Registration is browser-only and uses the native custom element registry for Velcro\'s own class, without changing the shared core prefix. Server-side rendering is not supported.',
  'The tooltip\'s position is computed by estimating where the native thumb is (as Shoelace does, it can be a pixel or two off); the product tests check it against that formula with a tolerance, not against pixels. There is no pixel comparison with Shoelace, no screen reader check, and the examples\' appearance under the dark theme has not been checked.',
  'The product test suite is configured for Chromium, Firefox and WebKit; this component\'s spec was run locally in Chromium and WebKit only, and Firefox is covered only by the project\'s CI run. Shoelace\'s own range test (37 tests, including its axe accessibility check) runs in Chromium only and passes. The accessibility-tree check is Playwright\'s ARIA snapshot, which Playwright computes from the DOM; no screen reader and no browser accessibility API was tried.',
];

@customElement('page-components-range')
export class RangePage extends LitElement {
  static override styles = [shellStyles];

  override render() {
    return docsShell('range', html`
      <h1>Range</h1>
      <p><code>&lt;sl-range&gt;</code> is registered by <code>@charm-ux/velcro</code> on top of the <code>@charm-ux/core</code> base element. Prototype status: unreleased.</p>
      <p>Ranges allow the user to select a single value within a given range using a slider. This component works with standard <code>&lt;form&gt;</code> elements: its name and value are submitted with the form, it takes part in client-side validation (<code>min</code>, <code>max</code>, <code>step</code> and <code>setCustomValidity()</code>), and a form reset restores the value the range started with.</p>

      <h2 id="examples">Examples</h2>
      <p>Each preview runs in its own document, so its script uses plain <code>document.querySelector</code>. Every example also has Shoelace's React version, ported to Velcro's generated React wrapper (<code>@charm-ux/velcro/react/VelcroRange.js</code>, imported under Shoelace's name); only the import line differs from Shoelace's. They are shown as source and run by the product tests.</p>
      ${sections.map(
        ([id, title, text, key, react]) => html`
          ${untitled.has(id) ? '' : html`<h3 id=${id}>${title}</h3>`}
          ${text === null ? '' : html`<p>${text}</p>`}
          <iframe class="example" title=${`Range example: ${title}`} srcdoc=${exampleDocument(examples[key])}></iframe>
          <pre><code>${examples[key]}</code></pre>
          <details class="react-example">
            <summary>React</summary>
            <pre><code>${reactExamples[react]}</code></pre>
          </details>
        `
      )}

      ${apiReference('sl-range', {
        attributes: html`<p>Only <code>disabled</code> and <code>form</code> are reflected. Setting one of them to null or undefined restores its initial value, as in Shoelace's base element, which records the initial values on the element's first attribute change (for a range at the latest its first update, which writes the reflected <code>form=""</code> attribute); the other properties are not restored (see the quirks below). Changing the <code>value</code> attribute also updates <code>defaultValue</code>, which a form reset restores. <code>value</code> is clamped to <code>min</code> and <code>max</code> when the range connects, and after each update it is read back from the native input, so a value set by script outside the range, or off the step, reads back as the native input holds it (for example 150 becomes 100) without an event. <code>input</code> and <code>output</code> (the inner <code>&lt;input type="range"&gt;</code> and the tooltip <code>&lt;output&gt;</code>), <code>title</code> and the three public watcher methods are Shoelace's public but undocumented members. <code>dir</code> and <code>lang</code> are reactive properties with no default that are not reflected, as in Shoelace's base element; a right-to-left direction mirrors the track and the tooltip placement.</p>`,
        methods: html`<p><code>focus()</code> and <code>blur()</code> focus and blur the inner <code>&lt;input&gt;</code>. <code>stepUp()</code> and <code>stepDown()</code> move the value by <code>step</code> and emit no event.</p>`,
        events: html`<p><code>sl-change</code>, <code>sl-input</code>, <code>sl-focus</code> and <code>sl-blur</code> bubble and are composed; <code>sl-invalid</code> does not bubble and is cancelable. <code>sl-input</code> is emitted for every movement of the thumb and <code>sl-change</code> when the user commits a value; neither is emitted when the value is set by script, by <code>stepUp()</code> or by <code>stepDown()</code>. Velcro extension, not in Shoelace: the core <code>ready</code> event, dispatched once on the element after its first update (it does not bubble and is not composed).</p>`,
        slots: html`<p>The <code>label</code> and <code>help-text</code> slots take precedence over the attributes of the same name when both are present.</p>`,
        parts: html`<p>All parts are Shoelace's. The <code>form-control</code> wrapper, its label and help text, the <code>base</code> box, the <code>input</code> part and the <code>tooltip</code> follow Shoelace's structure, so CSS written against Shoelace's parts applies unchanged.</p>`,
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

export default RangePage;
