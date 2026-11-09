import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { definePageData } from '@beatzball/litro';
import { docsShell, shellStyles } from '../../src/shell.js';
import { themeHead } from '../../src/theme.js';
import { apiReference } from '../../src/api.js';
import { examples, exampleDocument, reactExamples } from '../../src/example.js';

export const pageData = definePageData(async () => ({
  seoTitle: 'Color Picker - Velcro',
  seoHead: themeHead + '<meta name="description" content="Velcro color picker (prototype).">',
}));

// Shoelace's examples, in the order of its page: [id, heading, text, example key, React example key]. The first has no
// heading in Shoelace's page (it is the page's opening example).
const sections = [
  ['basic', 'Default', null, 'color-picker/basic', 'color-picker/react/basic'],
  ['initial-value', 'Initial Value', html`Use the <code>value</code> attribute to set an initial value for the color picker.`, 'color-picker/initial-value', 'color-picker/react/initial-value'],
  ['opacity', 'Opacity', html`Use the <code>opacity</code> attribute to enable the opacity slider. When this is enabled, the value will be displayed as HEXA, RGBA, HSLA, or HSVA based on <code>format</code>.`, 'color-picker/opacity', 'color-picker/react/opacity'],
  ['formats', 'Formats', html`Set the color picker's format with the <code>format</code> attribute. Valid options include <code>hex</code>, <code>rgb</code>, <code>hsl</code>, and <code>hsv</code>. Note that the color picker's input will accept any parsable format (including CSS color names) regardless of this option.`, 'color-picker/formats', 'color-picker/react/formats'],
  ['swatches', 'Swatches', html`Use the <code>swatches</code> attribute to add convenient presets to the color picker. Any format the color picker can parse is acceptable (including CSS color names), but each value must be separated by a semicolon (<code>;</code>). Alternatively, you can pass an array of color values to this property using JavaScript.`, 'color-picker/swatches', 'color-picker/react/swatches'],
  ['sizes', 'Sizes', html`Use the <code>size</code> attribute to change the color picker's trigger size.`, 'color-picker/sizes', 'color-picker/react/sizes'],
  ['inline', 'Inline', html`The color picker can be rendered inline instead of in a dropdown using the <code>inline</code> attribute.`, 'color-picker/inline', 'color-picker/react/inline'],
] as const;
const untitled = new Set<string>(['basic']);
// Sections whose Shoelace text has a second paragraph.
const more: Record<string, ReturnType<typeof html>> = {
  formats: html`To prevent users from toggling the format themselves, add the <code>no-format-toggle</code> attribute.`,
};

// Shoelace 2.20.1 behaviors that look like bugs but are matched exactly (candidates for a later opt-in fix). One line each.
const quirks = [
  'Enter on a swatch applies its color without emitting sl-change or sl-input; a click on the same swatch emits both.',
  'Without opacity, a value with an alpha channel (for example #ff000080) is rewritten as hex without alpha (#ff0000), but the trigger, the preview and the grid handle keep drawing it with that transparency.',
  'Setting value to a string that cannot be parsed keeps that string as the value, while the input keeps showing the previous color.',
  'Changing inline after the first render makes that update throw a TypeError (the validity is read from the new inner input before it has rendered); the picker is still drawn in its new layout and later updates work.',
  'The format toggle re-reads the color from the rounded value string, so cycling through all four formats can drift (#4a90e2 comes back as #4b92e3).',
  'In the dropdown (not inline), the panel\'s aria-labelledby="label" names an element that only exists inline, so the panel has no accessible name; the label is read from the trigger button instead.',
] as const;

const gaps = [
  'All of Shoelace\'s examples are ported with a live preview and a React version, in Shoelace\'s order. The React examples import Velcro\'s generated wrapper (@charm-ux/velcro/react/VelcroColorPicker.js) under Shoelace\'s name; nothing else differs. As in Shoelace\'s page, the React versions of Opacity and Formats differ from the HTML ones (no initial value with opacity, no label on the formats).',
  'Colors are parsed and formatted by Velcro\'s color adapter (internal/color.ts), which exposes only the TinyColor calls Shoelace makes. Shoelace uses @ctrl/tinycolor; whether Velcro takes that dependency or ships its own copy is not decided yet, and the adapter is an interim implementation of the same rules. Until that is settled, CSS color names are resolved by the browser\'s canvas parser, so a name the browser knows but TinyColor does not (a CSS system color such as canvas) is accepted.',
  'Velcro builds sl-color-picker on the @charm-ux/core base element, because @charm-ux/core has no color picker. The only core extension that remains is the non-bubbling ready event on first update, which the API tables label as inherited from core. Core\'s base styles are replaced by Shoelace\'s.',
  'The public base, input, dropdown, previewButton and trigger fields and the handleFormatChange, handleOpacityChange and handleValueChange methods exist as in Shoelace, which lists them in its manifest without a description; the API tables below list them too.',
  'dir and lang are declared as Shoelace\'s base element declares them: reactive, not reflected and undefined until set. lang selects the translation of the copy button, the input\'s label, the format toggle and the eye dropper icon. TypeScript types for dir are narrower than Shoelace\'s dir: string: the read type stays core\'s \'ltr\' | \'rtl\' | \'auto\'. Fixing this needs a change in @charm-ux/core and is deferred.',
  'The eye dropper button appears only where the browser has the EyeDropper API (Chromium); it was not exercised, because the API needs a real user gesture and screen access. The copy button uses document.execCommand(\'copy\'), as Shoelace does; the clipboard contents were not checked.',
  'The product test suite is configured for Chromium, Firefox and WebKit; this component\'s spec was run locally in Chromium and WebKit only, and Firefox is covered only by the project\'s CI run. Shoelace\'s own color picker test (52 tests, one skipped upstream, including its axe accessibility checks) runs in Chromium only and passes. Touch handling is ported from Shoelace but checked only with synthetic events, not on a touch device; there is no pixel comparison with Shoelace.',
  'Registration is browser-only and uses the native custom element registry for Velcro\'s own class, without changing the shared core prefix. Server-side rendering is not supported.',
  'Rendering under the dark theme has not been checked, and color contrast was not evaluated.',
];

@customElement('page-components-color-picker')
export class ColorPickerPage extends LitElement {
  static override styles = [shellStyles];

  override render() {
    return docsShell('color-picker', html`
      <h1>Color Picker</h1>
      <p><code>&lt;sl-color-picker&gt;</code> is registered by <code>@charm-ux/velcro</code> on top of the <code>@charm-ux/core</code> base element. Prototype status: unreleased.</p>
      <p>Color pickers allow the user to select a color.</p>
      <p>This component works with standard <code>&lt;form&gt;</code> elements: its value is submitted under its <code>name</code>, a form reset restores the initial value, and <code>required</code> takes part in the form's validation.</p>

      <h2 id="examples">Examples</h2>
      <p>Each preview runs in its own document. The React version of each example is Shoelace's, ported to Velcro's generated React wrapper; only its import line differs. It is shown as source.</p>
      ${sections.map(
        ([id, title, text, key, react]) => html`
          ${untitled.has(id) ? '' : html`<h3 id=${id}>${title}</h3>`}
          ${text === null ? '' : html`<p>${text}</p>`}
          ${id in more ? html`<p>${more[id]}</p>` : ''}
          <iframe class="example" title=${`Color Picker example: ${title}`} srcdoc=${exampleDocument(examples[key])}></iframe>
          <pre><code>${examples[key]}</code></pre>
          <details class="react-example">
            <summary>React</summary>
            <pre><code>${reactExamples[react]}</code></pre>
          </details>
        `
      )}

      ${apiReference('sl-color-picker', {
        attributes: html`<p><code>inline</code>, <code>size</code>, <code>disabled</code>, <code>form</code> and <code>required</code> are reflected; the others are not. Setting <code>value</code> parses it and rewrites it in the current <code>format</code> and letter case (for example <code>#FFF</code> becomes <code>#ffffff</code>), without an event. An empty value shows an empty trigger. The <code>value</code> attribute also sets <code>defaultValue</code>, which a form reset restores. Setting a reflected property to null or undefined restores its initial value, as in Shoelace's base element. <code>dir</code> and <code>lang</code> are reactive properties with no default that are not reflected, as in Shoelace's base element.</p>`,
        methods: html`<p><code>focus()</code> focuses the trigger, or the <code>base</code> element when inline (it has <code>tabindex="0"</code>). <code>blur()</code> moves the focus out of the picker and closes the dropdown. <code>getFormattedValue()</code> returns the current color as <code>hex</code>, <code>hexa</code>, <code>rgb</code>, <code>rgba</code>, <code>hsl</code>, <code>hsla</code>, <code>hsv</code> or <code>hsva</code>. <code>checkValidity()</code>, <code>reportValidity()</code> and <code>setCustomValidity()</code> use the inner input's validity; <code>reportValidity()</code> opens the dropdown first when it is invalid.</p>`,
        events: html`<p><code>sl-focus</code> and <code>sl-blur</code> are emitted when the focus enters and leaves the picker (moving between its own controls emits neither). <code>sl-change</code> and <code>sl-input</code> are emitted together when the user changes the color with the keyboard, a swatch click, the format toggle, the eye dropper or the input; dragging emits <code>sl-input</code> as the color changes and <code>sl-change</code> when the drag ends. Setting <code>value</code> from script emits nothing. <code>sl-invalid</code> does not bubble. The arrow keys move the grid handle and the sliders by 1 (by 10 with Shift); Home and End go to the ends of the sliders. Inherited from core: a non-bubbling <code>ready</code> event on first update, which Shoelace does not have.</p>`,
        parts: html`<p>The grid handle has <code>role="application"</code> and <code>aria-label="HSV"</code>; the hue and opacity handles have <code>role="slider"</code> with <code>aria-valuenow</code>. The format and eye dropper buttons export their own parts with the <code>format-button__</code> and <code>eye-dropper-button__</code> prefixes.</p>`,
      })}

      <h2 id="upstream-quirks">Upstream quirks matched</h2>
      <p>Velcro matches Shoelace 2.20.1 exactly, including behavior that looks like a bug. Each of these is covered by a product test. Each is a candidate for a later opt-in fix.</p>
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

export default ColorPickerPage;
