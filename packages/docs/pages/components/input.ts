import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { definePageData } from '@beatzball/litro';
import { docsShell, shellStyles } from '../../src/shell.js';
import { themeHead } from '../../src/theme.js';
import { apiReference } from '../../src/api.js';
import { examples, exampleDocument, reactExamples } from '../../src/example.js';

export const pageData = definePageData(async () => ({
  seoTitle: 'Input - Velcro',
  seoHead: themeHead + '<meta name="description" content="Velcro input (prototype).">',
}));

// [id, title, HTML example, text, React example (none for Shoelace's label position example, which has no React version)]
const sections: Array<[string, string, string, string, string?]> = [
  ['overview', 'Overview', 'input/basic', 'Inputs collect data from the user.', 'input/react/basic'],
  ['labels', 'Labels', 'input/labels', 'Use the label attribute to give the input an accessible label. For labels that contain HTML, use the label slot instead.', 'input/react/labels'],
  ['help-text', 'Help Text', 'input/help-text', 'Add descriptive help text to an input with the help-text attribute. For help texts that contain HTML, use the help-text slot instead.', 'input/react/help-text'],
  ['placeholders', 'Placeholders', 'input/placeholders', 'Use the placeholder attribute to add a placeholder.', 'input/react/placeholders'],
  ['clearable', 'Clearable', 'input/clearable', 'Add the clearable attribute to add a clear button when the input has content.', 'input/react/clearable'],
  ['toggle-password', 'Toggle Password', 'input/toggle-password', 'Add the password-toggle attribute to add a toggle button that will show the password when activated.', 'input/react/toggle-password'],
  ['filled', 'Filled Inputs', 'input/filled', 'Add the filled attribute to draw a filled input.', 'input/react/filled'],
  ['disabled', 'Disabled', 'input/disabled', 'Use the disabled attribute to disable an input.', 'input/react/disabled'],
  ['sizes', 'Sizes', 'input/sizes', 'Use the size attribute to change an input\'s size.', 'input/react/sizes'],
  ['pill', 'Pill', 'input/pill', 'Use the pill attribute to give inputs rounded edges.', 'input/react/pill'],
  ['input-types', 'Input Types', 'input/input-types', 'The type attribute controls the type of input the browser renders.', 'input/react/input-types'],
  ['prefix-suffix', 'Prefix & Suffix Icons', 'input/prefix-suffix', 'Use the prefix and suffix slots to add icons.', 'input/react/prefix-suffix'],
  ['label-position', 'Customizing Label Position', 'input/label-position', 'Use CSS parts to customize the way form controls are drawn. This example uses CSS grid to position the label to the left of the control, but the possible orientations are nearly endless. The same technique works for inputs, textareas, radio groups, and similar form controls.'],
];

const quirks = [
  'The hidden attribute does not hide the input: its :host { display: block } rule outranks the browser\'s [hidden] rule.',
  'The form attribute is reflected, so every input carries form="" until it is set.',
  'The inner <input> always points aria-describedby at the help text, even when there is none.',
  'Removing the value attribute sets both value and defaultValue to null (not to an empty string). On a clearable input the next render then fails, because it reads the length of the value.',
  'The password toggle\'s slots are named for the state they appear in, not the action: show-password-icon is the icon shown while the password is visible (the default is the crossed-out eye) and hide-password-icon is the icon shown while it is hidden (the default is the eye).',
  'valueAsNumber also converts the value of an input that is not a number input (a text input holding "42" gives 42), because it falls back to an in-memory number input; valueAsDate does the same for the date types and gives null for others.',
  'The inner <input> always receives title="" (an empty title keeps validation tooltips from appearing on hover), also when title is not set.',
  'focus(), blur(), select(), setSelectionRange(), setRangeText(), showPicker(), stepUp(), stepDown(), checkValidity(), reportValidity(), setCustomValidity() and the validity and validationMessage getters use the rendered inner <input>, so they throw when called before the first render.',
];

const gaps = [
  'Velcro builds on the @charm-ux/core input and keeps its extras, which are not part of the Shoelace contract: hide-label (visually hides the label and help text, which stay in the accessibility tree) and error-message (sets a custom validity message, as setCustomValidity() does; it is not rendered). The core invalid and label-position properties are accepted and reflected but have no effect (use data-invalid, as in Shoelace). The element also carries the core attribute "focusable" and emits the core ready event (see Events); apart from those two, the extensions change nothing unless they are set. As in Shoelace, dir and lang are plain reactive properties (undefined unless set, not reflected) and focus is not delegated: clicking the help text does not focus the input.',
  'The template, styles, parts and custom properties are Shoelace\'s, so the parts of the core input are not rendered: core\'s start and end slots (use prefix and suffix), the slotted <option> elements it turns into a datalist, its error text, its range slider styling and its --input-* and --form-control-* custom properties. Core\'s number clamping of the value to min and max is not applied (as in Shoelace the native validity reports a value out of range), and core\'s valueAsDate and valueAsNumber, which only worked for the date and number types, are replaced by Shoelace\'s conversions.',
  'Core\'s input emits change and input events and handles keydown itself; this one emits Shoelace\'s sl-change and sl-input instead and its Enter handling is Shoelace\'s. As in Shoelace, typing still lets the inner input\'s native input event reach the element, but no native change event does.',
  'As in Shoelace, the element is not form-associated: it does not appear in form.elements and is not disabled by a disabled <fieldset>. Its value is added in the form\'s formdata event. An input attached to a form replaces the form\'s checkValidity() and reportValidity() with versions that also check Velcro controls (restored when the last one detaches), and sets data-valid / data-invalid / data-optional / data-required / data-user-valid / data-user-invalid attributes on itself. Pressing Enter (without a modifier key, and not while an input method editor is composing) submits the form after a tick, unless the keydown was cancelled. serialize() and getFormControls() are exported as @charm-ux/velcro/utilities/form, as in Shoelace\'s utilities/form.',
  'TypeScript types: min, max and step have Shoelace\'s own types (number | string, number | string and number | \'any\') even though the core input declares number for all three, which TypeScript would otherwise reject; an internal typing layer (src/components/input/core-typing.ts) isolates that, and type-tests/input-types.tsx checks the types, including that wrong values do not compile, on the element class and in the React wrapper\'s props. autocorrect is the exception: Shoelace types it \'off\' | \'on\', but lib.dom declares autocorrect: boolean on HTMLElement, and a class with an \'off\' | \'on\' property is no longer an HTMLElement for TypeScript (the generated JSX types and every API that takes an HTMLElement would reject it). So autocorrect is an accessor that reads as any and accepts only \'off\' | \'on\' when assigned on the element; the manifest and the API table show \'off\' | \'on\', and the React prop, which follows the read type, accepts any value. dir is typed as in the other components: the setter accepts any string, but the read type stays core\'s \'ltr\' | \'rtl\' | \'auto\' until a change in @charm-ux/core (type-tests/input-dir.tsx checks the setter).',
  'The clear and password toggle icons are Velcro\'s <sl-icon> from the system icon library. The registering entry (@charm-ux/velcro/input or the package root) registers Velcro\'s sl-icon up front. Importing the class-only entry (@charm-ux/velcro/input/class) registers nothing; as with Shoelace\'s declared dependencies, constructing an input defines Velcro\'s sl-icon when that tag is not defined yet, so no extra step is needed. If another constructor already owns sl-icon, the input renders that element and logs nothing, where Shoelace logs a warning when the registered version differs from its own.',
  'The accessible names of the clear and password toggle buttons are the localized "clearEntry", "showPassword" and "hidePassword" terms, as in Shoelace: "Clear entry", "Show password" and "Hide password" in English, the fallback. They follow the element\'s lang, then the document\'s, and re-render when either changes or a translation is registered (see the Localization page). The translated text is Shoelace\'s and was not reviewed by Velcro.',
  'Registration is browser-only and uses the native custom element registry for Velcro\'s own class, without changing the shared core prefix. Server-side rendering is not supported.',
  'Shoelace\'s own input tests, including its axe accessibility check, run against Velcro in Chromium and all 58 pass. The product tests (structure, ARIA, computed styles against Shoelace\'s rules, events, keyboard, forms and the examples with their React versions) are configured for Chromium, Firefox and WebKit. There is no pixel comparison with Shoelace, no right-to-left or screen reader check, and the examples\' appearance under the dark theme has not been checked.',
];

@customElement('page-components-input')
export class InputPage extends LitElement {
  static override styles = [shellStyles];

  override render() {
    return docsShell('input', html`
      <h1>Input</h1>
      <p><code>&lt;sl-input&gt;</code> is registered by <code>@charm-ux/velcro</code> on top of the <code>@charm-ux/core</code> input. Prototype status: unreleased.</p>
      <p>Inputs collect data from the user. This component works with standard <code>&lt;form&gt;</code> elements: its name and value are submitted with the form, it takes part in client-side validation (<code>required</code>, <code>pattern</code>, <code>minlength</code>, <code>maxlength</code>, <code>min</code>, <code>max</code>, <code>step</code>, the type's own checks and <code>setCustomValidity()</code>), pressing Enter submits the form, and a form reset restores the value the input started with.</p>

      <h2 id="examples">Examples</h2>
      <p>Each preview runs in its own document, so its script uses plain <code>document.querySelector</code>. Every example except the label position one (which has no React version in Shoelace's documentation) also has Shoelace's React version, ported to Velcro's generated React wrapper (<code>@charm-ux/velcro/react/VelcroInput.js</code>, imported under Shoelace's name); only the import lines differ from Shoelace's. They are shown as source and run by the product tests.</p>
      ${sections.map(
        ([id, title, key, text, react]) => html`
          <h3 id=${id}>${title}</h3>
          <p>${text}</p>
          <iframe class="example" title=${`Input example: ${title}`} srcdoc=${exampleDocument(examples[key as keyof typeof examples])}></iframe>
          <pre><code>${examples[key as keyof typeof examples]}</code></pre>
          ${react
            ? html`<details class="react-example">
                <summary>React</summary>
                <pre><code>${reactExamples[react as keyof typeof reactExamples]}</code></pre>
              </details>`
            : ''}
        `
      )}

      ${apiReference('sl-input', {
        attributes: html`<p>Removing a reflected attribute (<code>type</code>, <code>size</code>, <code>filled</code>, <code>pill</code>, <code>disabled</code>, <code>readonly</code>, <code>form</code>, <code>required</code>) restores the property's initial value, as in Shoelace. Changing the <code>value</code> attribute also updates <code>defaultValue</code>, which a form reset restores. <code>min</code>, <code>max</code> and <code>step</code> stay strings when set from an attribute. <code>pattern</code>, <code>minlength</code>, <code>maxlength</code>, <code>min</code>, <code>max</code>, <code>step</code>, <code>autocapitalize</code>, <code>autocorrect</code>, <code>autocomplete</code>, <code>autofocus</code>, <code>enterkeyhint</code> and <code>inputmode</code> are undefined until set. <code>input</code> (the inner <code>&lt;input&gt;</code>), <code>title</code> and the three <code>handle…Change</code> methods are Shoelace's public but undocumented members. Velcro extensions, not in Shoelace: <code>hideLabel</code> and <code>errorMessage</code> (inherited from core and kept working), and <code>invalid</code> and <code>labelPosition</code>, which are accepted and reflected but have no effect (the API table marks them inert).</p>`,
        events: html`<p><code>sl-change</code>, <code>sl-input</code>, <code>sl-focus</code>, <code>sl-blur</code> and <code>sl-clear</code> bubble and are composed; <code>sl-invalid</code> does not bubble and is cancelable. <code>sl-input</code> is emitted for every edit and <code>sl-change</code> when the user commits a change (on blur); neither is emitted when the value is set by script, by <code>setRangeText()</code>, <code>stepUp()</code> or <code>stepDown()</code>. Activating the clear button of a non-empty input emits <code>sl-clear</code>, <code>sl-input</code> and <code>sl-change</code>, in that order, and focuses the input. Velcro extension, not in Shoelace: the core <code>ready</code> event, dispatched once on the element after its first update (it does not bubble and is not composed).</p>`,
        slots: html`<p>The <code>label</code> and <code>help-text</code> slots take precedence over the attributes of the same name when both are present. <code>show-password-icon</code> and <code>hide-password-icon</code> replace the icons of the password toggle (see Upstream quirks matched for which is which); <code>clear-icon</code> replaces the clear icon.</p>`,
        parts: html`<p>All parts are Shoelace's. The <code>form-control</code> wrapper, its label and help text and the <code>input</code> part follow Shoelace's structure, so CSS written against Shoelace's parts applies unchanged.</p>`,
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

export default InputPage;
