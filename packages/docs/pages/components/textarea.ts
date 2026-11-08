import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { definePageData } from '@beatzball/litro';
import { docsShell, shellStyles } from '../../src/shell.js';
import { themeHead } from '../../src/theme.js';
import { apiReference } from '../../src/api.js';
import { examples, exampleDocument, reactExamples } from '../../src/example.js';

export const pageData = definePageData(async () => ({
  seoTitle: 'Textarea - Velcro',
  seoHead: themeHead + '<meta name="description" content="Velcro textarea (prototype).">',
}));

// [id, title, HTML example, text, React example]
const sections: Array<[string, string, string, string, string]> = [
  ['overview', 'Overview', 'textarea/basic', 'Textareas collect data from the user and allow multiple lines of text.', 'textarea/react/basic'],
  ['labels', 'Labels', 'textarea/labels', 'Use the label attribute to give the textarea an accessible label. For labels that contain HTML, use the label slot instead.', 'textarea/react/labels'],
  ['help-text', 'Help Text', 'textarea/help-text', 'Add descriptive help text to a textarea with the help-text attribute. For help texts that contain HTML, use the help-text slot instead.', 'textarea/react/help-text'],
  ['rows', 'Rows', 'textarea/rows', 'Use the rows attribute to change the number of text rows that get shown.', 'textarea/react/rows'],
  ['placeholders', 'Placeholders', 'textarea/placeholders', 'Use the placeholder attribute to add a placeholder.', 'textarea/react/placeholders'],
  ['filled', 'Filled Textareas', 'textarea/filled', 'Add the filled attribute to draw a filled textarea.', 'textarea/react/filled'],
  ['disabled', 'Disabled', 'textarea/disabled', 'Use the disabled attribute to disable a textarea.', 'textarea/react/disabled'],
  ['sizes', 'Sizes', 'textarea/sizes', 'Use the size attribute to change a textarea\'s size.', 'textarea/react/sizes'],
  ['prevent-resizing', 'Prevent Resizing', 'textarea/prevent-resizing', 'By default, textareas can be resized vertically by the user. To prevent resizing, set the resize attribute to none.', 'textarea/react/prevent-resizing'],
  ['expand-with-content', 'Expand with Content', 'textarea/expand-with-content', 'Textareas will automatically resize to expand to fit their content when resize is set to auto.', 'textarea/react/expand-with-content'],
];

const quirks = [
  'The hidden attribute does not hide the textarea: its :host { display: block } rule outranks the browser\'s [hidden] rule.',
  'scrollPosition() returns the textarea\'s vertical scroll offset as both top and left.',
  'The form attribute is reflected, so every textarea carries form="" until it is set.',
  'The inner <textarea> always points aria-describedby at the help text, even when there is none.',
  'Removing the value attribute sets both value and defaultValue to null (not to an empty string).',
  'The autocomplete property is declared but never passed to the inner <textarea>, so it has no effect.',
  'Changing resize at run time does not re-measure the textarea: the height that auto wrote stays until the value or rows change.',
  'focus(), blur(), select(), scrollPosition(), setSelectionRange(), setRangeText(), checkValidity(), reportValidity(), setCustomValidity() and the validity and validationMessage getters use the rendered inner <textarea>, so they throw when called before the first render.',
];

const gaps = [
  'Velcro builds on the @charm-ux/core text area and keeps its extras, which are not part of the Shoelace contract: hide-label (visually hides the label and help text, which stay in the accessibility tree) and error-message (sets a custom validity message, as setCustomValidity() does; it is not rendered). The core invalid and label-position properties are accepted and reflected but have no effect (use data-invalid, as in Shoelace), and core\'s error text and its core-only parts and custom properties are not rendered. The element also carries the core attribute "focusable" and emits the core ready event (see Events); apart from those two, the extensions change nothing unless they are set. As in Shoelace, dir and lang are plain reactive properties (undefined unless set, not reflected) and focus is not delegated: clicking the help text does not focus the textarea.',
  'Core\'s text area emits change and input events and stops keydown from propagating; this one emits Shoelace\'s sl-change and sl-input instead and leaves keydown alone. As in Shoelace, typing still lets the inner textarea\'s native input event reach the element, but no native change event does.',
  'The core resize values horizontal and both are not Shoelace values and are not styled: as in Shoelace the element applies no resize class for them, so the browser\'s default resize handle of a textarea applies.',
  'As in Shoelace, the element is not form-associated: it does not appear in form.elements and is not disabled by a disabled <fieldset>. Its value is added in the form\'s formdata event. A textarea attached to a form replaces the form\'s checkValidity() and reportValidity() with versions that also check Velcro controls (restored when the last one detaches), and sets data-valid / data-invalid / data-optional / data-required / data-user-valid / data-user-invalid attributes on itself. serialize() and getFormControls() are exported as @charm-ux/velcro/utilities/form, as in Shoelace\'s utilities/form.',
  'TypeScript types: resize, autocomplete and autocorrect are typed any in the source and in the declarations (the React wrapper\'s props follow), not Shoelace\'s \'none\' | \'vertical\' | \'auto\', string and string, because TypeScript does not let a subclass narrow an inherited property to an incompatible type (core declares resize and autocomplete as narrower unions without Shoelace\'s values, lib.dom declares autocorrect as boolean, and an accessor cannot override a property). Assigning any value compiles, so a wrong value is not caught at compile time. The manifest and the API table below show Shoelace\'s types. dir is typed as in the other components: the setter accepts any string, but the read type stays core\'s \'ltr\' | \'rtl\' | \'auto\' until a change in @charm-ux/core (type-tests/textarea-dir.tsx checks the setter).',
  'The element renders no other component and needs no translation: Shoelace\'s textarea has no translatable text. Registration is browser-only and uses the native custom element registry for Velcro\'s own class, without changing the shared core prefix; the tag is sl-textarea although core\'s class is called text-area. Server-side rendering is not supported.',
  'Shoelace\'s own textarea tests, including its axe accessibility check, run against Velcro in Chromium and all 43 pass. The product tests (structure, ARIA, computed styles against Shoelace\'s rules, events, keyboard, forms and the examples with their React versions) were run in Chromium and WebKit when it was written; they are also configured for Firefox, which only CI runs. There is no pixel comparison with Shoelace, no RTL or screen reader check, and the examples\' appearance under the dark theme has not been checked.',
];

@customElement('page-components-textarea')
export class TextareaPage extends LitElement {
  static override styles = [shellStyles];

  override render() {
    return docsShell('textarea', html`
      <h1>Textarea</h1>
      <p><code>&lt;sl-textarea&gt;</code> is registered by <code>@charm-ux/velcro</code> on top of the <code>@charm-ux/core</code> text area. Prototype status: unreleased.</p>
      <p>Textareas collect data from the user and allow multiple lines of text. This component works with standard <code>&lt;form&gt;</code> elements: its name and value are submitted with the form, it takes part in client-side validation (<code>required</code>, <code>minlength</code>, <code>maxlength</code> and <code>setCustomValidity()</code>), and a form reset restores the value the textarea started with.</p>

      <h2 id="examples">Examples</h2>
      <p>Each preview runs in its own document, so its script uses plain <code>document.querySelector</code>. Every example also has Shoelace's React version, ported to Velcro's generated React wrapper (<code>@charm-ux/velcro/react/VelcroTextarea.js</code>, imported under Shoelace's name); only the import line differs from Shoelace's. They are shown as source and run by the product tests.</p>
      ${sections.map(
        ([id, title, key, text, react]) => html`
          <h3 id=${id}>${title}</h3>
          <p>${text}</p>
          <iframe class="example" title=${`Textarea example: ${title}`} srcdoc=${exampleDocument(examples[key as keyof typeof examples])}></iframe>
          <pre><code>${examples[key as keyof typeof examples]}</code></pre>
          <details class="react-example">
            <summary>React</summary>
            <pre><code>${reactExamples[react as keyof typeof reactExamples]}</code></pre>
          </details>
        `
      )}

      ${apiReference('sl-textarea', {
        attributes: html`<p>Removing a reflected attribute (<code>size</code>, <code>filled</code>, <code>disabled</code>, <code>readonly</code>, <code>form</code>, <code>required</code>) restores the property's initial value, as in Shoelace. Changing the <code>value</code> attribute also updates <code>defaultValue</code>, which a form reset restores. <code>autocapitalize</code>, <code>autocorrect</code>, <code>autocomplete</code>, <code>autofocus</code>, <code>enterkeyhint</code>, <code>inputmode</code>, <code>minlength</code> and <code>maxlength</code> are undefined until set. <code>input</code> and <code>sizeAdjuster</code> (the inner <code>&lt;textarea&gt;</code> and the layout adjuster), <code>title</code> and the three <code>handle…Change</code> methods are Shoelace's public but undocumented members. Velcro extensions, not in Shoelace: <code>hideLabel</code> and <code>errorMessage</code> (inherited from core and kept working), and <code>invalid</code> and <code>labelPosition</code>, which are accepted and reflected but have no effect (the API table marks them inert).</p>`,
        events: html`<p><code>sl-change</code>, <code>sl-input</code>, <code>sl-focus</code> and <code>sl-blur</code> bubble and are composed; <code>sl-invalid</code> does not bubble and is cancelable. <code>sl-input</code> is emitted for every edit and <code>sl-change</code> when the user commits a change (on blur); neither is emitted when the value is set by script or by <code>setRangeText()</code>. Velcro extension, not in Shoelace: the core <code>ready</code> event, dispatched once on the element after its first update (it does not bubble and is not composed).</p>`,
        slots: html`<p>The <code>label</code> and <code>help-text</code> slots take precedence over the attributes of the same name when both are present.</p>`,
        parts: html`<p><code>textarea-adjuster</code> is in Shoelace's markup but not in its documented parts.</p>`,
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

export default TextareaPage;
