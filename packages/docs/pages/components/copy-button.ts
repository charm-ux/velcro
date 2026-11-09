import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { definePageData } from '@beatzball/litro';
import { docsShell, shellStyles } from '../../src/shell.js';
import { themeHead } from '../../src/theme.js';
import { apiReference } from '../../src/api.js';
import { examples, exampleDocument, reactExamples } from '../../src/example.js';
import { withBase } from '../../src/base.js';

export const pageData = definePageData(async () => ({
  seoTitle: 'Copy Button - Velcro',
  seoHead: themeHead + '<meta name="description" content="Velcro copy button (prototype).">',
}));

// Shoelace's examples, in the order of its page: [id, title, paragraphs, example key, React example key]. The first has no heading in
// Shoelace's page; it is the page's opening example. Every example is live and has a React version.
const sections = [
  ['basic', 'Default', null, 'copy-button/basic', 'copy-button/react/basic'],
  ['custom-labels', 'Custom Labels', [html`Copy Buttons display feedback in a tooltip. You can customize the labels using the <code>copy-label</code>, <code>success-label</code>, and <code>error-label</code> attributes.`], 'copy-button/custom-labels', 'copy-button/react/custom-labels'],
  ['custom-icons', 'Custom Icons', [html`Use the <code>copy-icon</code>, <code>success-icon</code>, and <code>error-icon</code> slots to customize the icons that get displayed for each state. You can use <a href=${withBase('/components/icon')}><code>&lt;sl-icon&gt;</code></a> or your own images.`], 'copy-button/custom-icons', 'copy-button/react/custom-icons'],
  ['copying-values-from-other-elements', 'Copying Values From Other Elements', [html`Normally, the data that gets copied will come from the component's <code>value</code> attribute, but you can copy data from any element within the same document by providing its <code>id</code> to the <code>from</code> attribute.`, html`When using the <code>from</code> attribute, the element's <a href="https://developer.mozilla.org/en-US/docs/Web/API/Node/textContent"><code>textContent</code></a> will be copied by default. Passing an attribute or property modifier will let you copy data from one of the element's attributes or properties instead.`, html`To copy data from an attribute, use <code>from="id[attr]"</code> where <code>id</code> is the id of the target element and <code>attr</code> is the name of the attribute you'd like to copy. To copy data from a property, use <code>from="id.prop"</code> where <code>id</code> is the id of the target element and <code>prop</code> is the name of the property you'd like to copy.`], 'copy-button/from', 'copy-button/react/from'],
  ['handling-errors', 'Handling Errors', [html`A copy error will occur if the value is an empty string, if the <code>from</code> attribute points to an id that doesn't exist, or if the browser rejects the operation for any reason. When this happens, the <code>sl-error</code> event will be emitted.`, html`This example demonstrates what happens when a copy error occurs. You can customize the error label and icon using the <code>error-label</code> attribute and the <code>error-icon</code> slot, respectively.`], 'copy-button/errors', 'copy-button/react/errors'],
  ['disabled', 'Disabled', [html`Copy buttons can be disabled by adding the <code>disabled</code> attribute.`], 'copy-button/disabled', 'copy-button/react/disabled'],
  ['changing-feedback-duration', 'Changing Feedback Duration', [html`A success indicator is briefly shown after copying. You can customize the length of time the indicator is shown using the <code>feedback-duration</code> attribute.`], 'copy-button/feedback-duration', 'copy-button/react/feedback-duration'],
  ['custom-styles', 'Custom Styles', [html`You can customize the button to your liking with CSS.`], 'copy-button/custom-styles', 'copy-button/react/custom-styles'],
] as const;

// Shoelace 2.20.1 behaviors that look like bugs but are matched exactly (candidates for a later opt-in fix). One line each.
const quirks = [
  'The hidden attribute does not hide the copy button: the host\'s own display: inline-block outranks the browser\'s [hidden] rule, so it stays displayed. Core\'s own base styles would hide it, so they are replaced by Shoelace\'s.',
  'A from that names no element reports the error and carries on: sl-error is emitted and the error feedback starts, and then the value attribute, if there is one, is copied after all (sl-copy follows, and its feedback runs on top of the error one). With no value either, the empty-value check reports a second sl-error and starts a second error feedback, so a click emits sl-error twice.',
  'The from syntax is two string tests, not a parser: any dot makes it a property lookup (split at every dot, so only the first two parts are used: "a.b.c" reads b from the element a, and an id that contains a dot cannot be referenced), and the attribute form id[attr] is only recognized when there is no dot (from="a[data.x]" is a property lookup of x] on the element a[data). A missing attribute or a property that is empty, 0, false or undefined gives an empty value, which is an error; any other property value is passed to the clipboard, which converts it to a string. Whitespace is trimmed only when a dot or a bracket is present.',
  'from is resolved in the copy button\'s own tree (the document, or the shadow root that holds it), not always in the document; an id in another tree is not found.',
  'A click is ignored while feedback is showing (the feedback duration plus the two 100 ms icon animations on each side), not only while the clipboard call is pending, and a disabled button ignores it too.',
  'The feedback animations always use the left-to-right keyframes: the direction passed to the animation registry is fixed to ltr, so an animation\'s rtlKeyframes are never used by the copy button.',
  'The feedback tooltip text is written straight onto the tooltip element, not through the template: it replaces whatever label is showing, and when the feedback ends it restores the copy label as it was when the copy started, so a copy-label changed in between is not shown until it changes again.',
  'The feedback animations are plain element animations, not the registry\'s animateTo helper, so they do not honor prefers-reduced-motion, and the sl-copy and sl-error events are emitted when the feedback starts, not when it ends.',
  'The button has no accessible name of its own: its content is two hidden icon slots and a visible default icon, which has no label. Shoelace relies on the tooltip\'s aria-live region to announce the labels, and its own accessibility test ignores axe\'s button-name rule for that reason; the same rule is ignored by the vendored upstream test that runs here.',
  'Removing the disabled attribute restores the value the property held when the first attribute change was handled (false for a button written in markup); a reflected property assigned null is restored the same way, as in Shoelace\'s base element. Other properties are not reflected and are not restored.',
] as const;

const gaps = [
  'All eight of Shoelace\'s examples (the opening one, Custom Labels, Custom Icons, Copying Values From Other Elements, Handling Errors, Disabled, Changing Feedback Duration and Custom Styles) are ported with a live preview and a React version, in Shoelace\'s order. Changes: the opening example\'s text says Velcro rocks, the link in the "from" example points at example.com instead of Shoelace\'s website, the React examples import Velcro\'s generated wrappers (@charm-ux/velcro/react/VelcroCopyButton.js and the like) under Shoelace\'s names and use the wrapper\'s property names for the label and duration props (copyLabel, successLabel, errorLabel and feedbackDuration, where Shoelace\'s page wrote the attribute names), and the React "from" example gives its sl-input the value its HTML example has (Shoelace\'s React example has no value, so its first copy would report an error).',
  'Core has no copy button, so Velcro builds sl-copy-button on the @charm-ux/core base element and takes its markup, styles and behavior from Shoelace. The only core extension that remains is the non-bubbling ready event on first update, which the API tables label as inherited from core.',
  'The copy button renders an sl-tooltip and, for its default icons, sl-icon, as in Shoelace. The registering entry (@charm-ux/velcro/copy-button or the package root) registers Velcro\'s sl-tooltip, sl-popup and sl-icon up front, each when its tag is not defined yet. Importing the class-only entry (@charm-ux/velcro/copy-button/class) registers nothing; as with Shoelace\'s declared dependencies, constructing a copy button defines Velcro\'s sl-icon and sl-tooltip when those tags are not defined yet (and constructing a tooltip defines sl-popup), so no extra step is needed. If another constructor already owns one of those tags, the copy button renders that element and, as in Shoelace, logs a console warning when the two versions differ (Velcro\'s classes declare no version, so the warning appears only when the other constructor declares one, such as a Shoelace element).',
  'The feedback animations come from the animation registry, as in Shoelace: copy.in and copy.out, with Shoelace\'s defaults (scale and opacity over 100 ms), changed per element with setAnimation() or for every copy button with setDefaultAnimation(), both exported from @charm-ux/velcro/utilities/animation-registry.',
  'The default labels (Copy, Copied and Error) come from the localization module\'s terms in the copy button\'s own language (its lang property or attribute, else the document\'s), read when the button renders and again when either language changes. The labels are the ones the registered translations have; Velcro ships Shoelace\'s 29 translations.',
  'dir and lang are declared as Shoelace\'s base element declares them: reactive, not reflected and undefined until set. Core\'s computed dir is not used. TypeScript types for dir are narrower than Shoelace\'s dir: string: at runtime dir is stored and returned as set and the setter accepts any string, but the read type stays core\'s \'ltr\' | \'rtl\' | \'auto\', because a subclass cannot widen an inherited getter\'s type. Fixing this needs a change in @charm-ux/core and is deferred.',
  'The product test suite is configured for Chromium, Firefox and WebKit; this component\'s spec was run locally in Chromium and WebKit only, and Firefox is covered only by the project\'s CI run. Shoelace\'s own copy button test (one test, an axe accessibility check that ignores the button-name rule) runs in Chromium only and passes. The product tests replace navigator.clipboard.writeText with a recording stub in every engine (a real clipboard needs a permission only Chromium grants without a prompt), and one Chromium-only test reads the real clipboard. The accessibility-tree check is Playwright\'s ARIA snapshot, which Playwright computes from the DOM; no screen reader and no browser accessibility API was tried, and there is no RTL check and no pixel comparison with Shoelace.',
  'Registration is browser-only and uses the native custom element registry for Velcro\'s own class, without changing the shared core prefix. Server-side rendering is not supported.',
  'The copy button reads these theme tokens: --sl-color-danger-600, --sl-color-success-600, --sl-border-radius-medium, --sl-spacing-x-small, --sl-transition-x-fast, --sl-focus-ring and --sl-focus-ring-offset; both Velcro themes define them. Without a theme the button has no feedback colors, rounded corners, padding or focus ring. Rendering under the dark theme has not been checked, and color contrast was not evaluated.',
];

@customElement('page-components-copy-button')
export class CopyButtonPage extends LitElement {
  static override styles = [shellStyles];

  override render() {
    return docsShell('copy-button', html`
      <h1>Copy Button</h1>
      <p><code>&lt;sl-copy-button&gt;</code> is registered by <code>@charm-ux/velcro</code> on top of the <code>@charm-ux/core</code> base element. Prototype status: unreleased.</p>
      <p>Copies data to the clipboard when the user clicks the button.</p>

      <h2 id="examples">Examples</h2>
      <p>Each preview runs in its own document. The React version of each live example is Shoelace's, ported to Velcro's generated React wrappers; only its import lines and the points listed under "Not implemented or unverified" differ. It is shown as source.</p>
      ${sections.map(
        ([id, title, text, key, react]) => html`
          <h3 id=${id}>${title}</h3>
          ${text === null ? '' : text.map(paragraph => html`<p>${paragraph}</p>`)}
          <iframe class="example" title=${`Copy Button example: ${title}`} srcdoc=${exampleDocument(examples[key])}></iframe>
          <pre><code>${examples[key]}</code></pre>
          <details class="react-example">
            <summary>React</summary>
            <pre><code>${reactExamples[react]}</code></pre>
          </details>
        `
      )}

      ${apiReference('sl-copy-button', {
        attributes: html`<p>Only <code>disabled</code> is reflected. Removing the <code>disabled</code> attribute restores the value the property held when the button's first attribute change was handled, as in Shoelace's base element. <code>dir</code> and <code>lang</code> are reactive properties with no default that are not reflected, as in Shoelace's base element. <code>isCopying</code> and <code>status</code> are Shoelace's public reactive state (they re-render the button, are not attributes and are not meant to be set); <code>copyIcon</code>, <code>successIcon</code>, <code>errorIcon</code> and <code>tooltip</code> are its public queries of the rendered slots and tooltip.</p>`,
        methods: html`<p>None, as in Shoelace. The copy is started by a click on the inner button, which is focusable, so it also answers to Enter and Space.</p>`,
        events: html`<p><code>sl-copy</code> (its <code>detail</code> is <code>{ value }</code>, the text that was copied) and <code>sl-error</code> (an empty <code>detail</code>) bubble and are composed, are not cancelable, and are emitted from the copy button. Inherited from core: a non-bubbling <code>ready</code> event on first update, which Shoelace does not have.</p>`,
        parts: html`<p><code>button</code> is the inner <code>button</code>; it holds the <code>copy-icon</code>, <code>success-icon</code> and <code>error-icon</code> parts (the three slots, of which only one is visible at a time). The <code>tooltip__*</code> parts are the exported parts of the <code>sl-tooltip</code> that wraps the button.</p>`,
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

export default CopyButtonPage;
