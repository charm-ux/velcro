import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { definePageData } from '@beatzball/litro';
import { docsShell, shellStyles } from '../../src/shell.js';
import { themeHead } from '../../src/theme.js';
import { apiReference } from '../../src/api.js';
import { examples, exampleDocument, reactExamples } from '../../src/example.js';

export const pageData = definePageData(async () => ({
  seoTitle: 'Option - Velcro',
  seoHead: themeHead + '<meta name="description" content="Velcro option (prototype).">',
}));

// Shoelace's examples, in the order of its page: [id, title, text, example key, React example key]. The first has no heading in
// Shoelace's page; it is the page's opening example. Shoelace's page has no React version of Prefix & Suffix.
const sections = [
  ['basic', 'Default', null, 'option/default', 'option/react/default'],
  ['disabled', 'Disabled', html`Use the <code>disabled</code> attribute to disable an option and prevent it from being selected.`, 'option/disabled', 'option/react/disabled'],
  ['prefix-suffix', 'Prefix & Suffix', html`Add icons to the start and end of menu items using the <code>prefix</code> and <code>suffix</code> slots.`, 'option/prefix-suffix', null],
] as const;

// Shoelace 2.20.1 behaviors that look like bugs but are matched exactly (candidates for a later opt-in fix). One line each.
const quirks = [
  'The hidden attribute does not hide the option: the host\'s own display: block outranks the browser\'s [hidden] rule, so it stays in the listbox and can still be selected.',
  'A value containing spaces is not rejected: each space is replaced with an underscore and a console error is logged. A non-string value is converted to a string.',
  'getTextLabel() reads only the option\'s direct children: text nodes and elements without a slot attribute count, so an element in the prefix or suffix slot is left out, but the text of a non-slotted element is taken whole, including any nested element\'s text.',
  'A disabled option is still reached by the select\'s keyboard navigation and type to select (it is highlighted but cannot be chosen); it only ignores pointer selection.',
] as const;

const gaps = [
  'All three of Shoelace\'s examples (the opening one, Disabled and Prefix & Suffix) are ported with a live preview, in Shoelace\'s order. The first two have React versions, which import Velcro\'s generated wrappers (@charm-ux/velcro/react/VelcroSelect.js and VelcroOption.js) under Shoelace\'s names; nothing else differs. Shoelace\'s page has no React version of Prefix & Suffix, so none is shown here.',
  'Core has no option element (its select uses native <option> elements), so Velcro builds sl-option on the @charm-ux/core base element and takes its markup, styles and behavior from Shoelace. The only core extension that remains is the non-bubbling ready event on first update, which the API tables label as inherited from core.',
  'An option is meant to be used inside sl-select, which sets its current and selected state, its tabindex and its focus. On its own it renders its label with a hidden check mark and sets role="option", aria-selected and aria-disabled on itself; it is not focusable and handles no keys. When its label changes, it tells the closest sl-select to refresh its display label.',
  'The check mark is Velcro\'s sl-icon (the check icon of the system library). The registering entry (@charm-ux/velcro/option or the package root) registers Velcro\'s sl-icon too. Importing the class-only entry (@charm-ux/velcro/option/class) registers nothing; as with Shoelace\'s declared dependencies, constructing an option defines Velcro\'s sl-icon when that tag is not defined yet. If another constructor already owns sl-icon, the option renders that element and, as in Shoelace, logs a console warning when the two versions differ.',
  'dir and lang are declared as Shoelace\'s base element declares them: reactive, not reflected and undefined until set. Core\'s computed dir is not used. TypeScript types for dir are narrower than Shoelace\'s dir: string: at runtime dir is stored and returned as set and the setter accepts any string, but the read type stays core\'s \'ltr\' | \'rtl\' | \'auto\', because a subclass cannot widen an inherited getter\'s type. Fixing this needs a change in @charm-ux/core and is deferred.',
  'Shoelace\'s own option test (5 tests, including an axe accessibility check) runs against Velcro in Chromium and passes. The product tests are configured for Chromium, Firefox and WebKit; this component\'s spec was run locally in Chromium and WebKit, and Firefox is covered only by the project\'s CI run. The accessibility checks are axe (in Shoelace\'s test) and Playwright\'s role, name and ARIA-state assertions, which Playwright computes from the DOM; no screen reader or browser accessibility API was tried, and there is no pixel comparison with Shoelace.',
  'Registration is browser-only and uses the native custom element registry for Velcro\'s own class, without changing the shared core prefix. Server-side rendering is not supported.',
  'The option reads these theme tokens: --sl-font-sans, --sl-font-size-medium, --sl-font-weight-normal, --sl-line-height-normal and -dense, --sl-letter-spacing-normal, --sl-color-neutral-0, -100, -700 and -1000, --sl-color-primary-600, --sl-spacing-2x-small, -x-small and -medium and --sl-transition-fast; both Velcro themes define them. Rendering under the dark theme has not been checked, and color contrast was not evaluated.',
];

@customElement('page-components-option')
export class OptionPage extends LitElement {
  static override styles = [shellStyles];

  override render() {
    return docsShell('option', html`
      <h1>Option</h1>
      <p><code>&lt;sl-option&gt;</code> is registered by <code>@charm-ux/velcro</code> on top of the <code>@charm-ux/core</code> base element. Prototype status: unreleased.</p>
      <p>Options define the selectable items within various form controls such as select.</p>

      <h2 id="examples">Examples</h2>
      <p>Each preview runs in its own document. The React version of each example that has one in Shoelace's page is ported to Velcro's generated React wrappers; only its import lines differ from Shoelace's. It is shown as source.</p>
      ${sections.map(
        ([id, title, text, key, react]) => html`
          <h3 id=${id}>${title}</h3>
          ${text === null ? '' : html`<p>${text}</p>`}
          <iframe class="example" title=${`Option example: ${title}`} srcdoc=${exampleDocument(examples[key])}></iframe>
          <pre><code>${examples[key]}</code></pre>
          ${react === null ? '' : html`
            <details class="react-example">
              <summary>React</summary>
              <pre><code>${reactExamples[react]}</code></pre>
            </details>
          `}
        `
      )}

      ${apiReference('sl-option', {
        attributes: html`<p><code>value</code> and <code>disabled</code> are reflected. Removing a reflected attribute restores the value the property held when the first attribute change was handled, as in Shoelace's base element (a removed Boolean attribute gives <code>false</code>). <code>dir</code> and <code>lang</code> are reactive properties with no default that are not reflected, as in Shoelace's base element. <code>current</code>, <code>selected</code>, <code>hasHover</code>, <code>defaultSlot</code> and the <code>handle*Change()</code> watchers are Shoelace's public but undocumented members; the select sets <code>current</code> and <code>selected</code>.</p>`,
        events: html`<p>None of its own, as in Shoelace. Inherited from core: a non-bubbling <code>ready</code> event on first update, which Shoelace does not have.</p>`,
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

export default OptionPage;
