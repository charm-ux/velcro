import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { definePageData } from '@beatzball/litro';
import { docsShell, shellStyles } from '../../src/shell.js';
import { themeHead } from '../../src/theme.js';
import { apiReference } from '../../src/api.js';
import { examples, exampleDocument, reactExamples } from '../../src/example.js';

export const pageData = definePageData(async () => ({
  seoTitle: 'Tag - Velcro',
  seoHead: themeHead + '<meta name="description" content="Velcro tag (prototype).">',
}));

// Shoelace's examples, in the order of its page: [id, title, text, example key, React example key]. The first has no heading in
// Shoelace's page; it is the page's opening example. Every example is live and has a React version.
const sections = [
  ['basic', 'Default', null, 'tag/basic', 'tag/react/basic'],
  ['sizes', 'Sizes', html`Use the <code>size</code> attribute to change a tag's size.`, 'tag/sizes', 'tag/react/sizes'],
  ['pill', 'Pill', html`Use the <code>pill</code> attribute to give tags rounded edges.`, 'tag/pill', 'tag/react/pill'],
  ['removable', 'Removable', html`Use the <code>removable</code> attribute to add a remove button to the tag.`, 'tag/removable', 'tag/react/removable'],
] as const;

// Shoelace 2.20.1 behaviors that look like bugs but are matched exactly (candidates for a later opt-in fix). One line each.
const quirks = [
  'The hidden attribute does not hide the tag: the host\'s own display: inline-block outranks the browser\'s [hidden] rule, so it stays displayed. Core\'s own base styles would hide it, so they are replaced by Shoelace\'s.',
  'variant="text" is accepted (it is in the variant type and the base part gets the tag--text class), but no style rule targets it: the tag has no background, and its 1px border and its text both take the inherited text color, so it looks like a boxed text span rather than a plain one. It also has no pressed color for the remove button.',
  'A variant or size value outside the documented lists is written to the property and the attribute as given, and the base part gets no variant or size class: the tag has no colors (a bare 1px border in the text color), or no height, font size and padding.',
  'Removing a reflected attribute does not restore the declared default; it restores what the property held when the tag\'s first attribute change was handled. For a tag written in markup, or created from script and rendered before any assignment, that is the default (neutral, medium); for a tag created from script with variant or size assigned before its first render, it is those assigned values, which Lit reflects as the first attribute change. pill is never restored: a removed Boolean attribute gives false.',
  'The remove button cannot be reached with the Tab key: it has tabindex="-1", and the tag itself is not focusable, so Tab walks past both. Once something else has focused the button (a pointer press or script), it is a native button, so Enter and Space press it, while Delete and Backspace do nothing (nothing in the tag handles them). sl-remove is not cancelable.',
  'The tag never removes itself: sl-remove only reports the activation, and the listener decides what happens. removable is not reflected, so setting the property leaves no attribute; removing the attribute sets the property to false.',
  'The remove button\'s label comes from the localization module\'s remove term in the tag\'s own language (its lang property or attribute, else the document\'s; an ancestor\'s lang does not count), read when the tag renders and again when either language changes.',
  'The remove button is not drawn in the tag\'s text color: at rest it takes the color of the sl-icon-button host itself (--sl-color-neutral-600) for every variant, and it turns the variant\'s -600 color only while the tag is pressed (:active, through a rule on the sl-icon-button element, for the five colored variants; variant="text" and out-of-list variants get none). The icon button\'s own hover color never shows, because the tag\'s ::part(base) rule outranks it. The tag--removable class has no style rule of its own.',
] as const;

const gaps = [
  'All four of Shoelace\'s examples (the opening one, Sizes, Pill and Removable) are ported with a live preview and a React version, in Shoelace\'s order. The React examples import Velcro\'s generated wrapper (@charm-ux/velcro/react/VelcroTag.js) under Shoelace\'s name; nothing else differs.',
  'Core has no tag, so Velcro builds sl-tag on the @charm-ux/core base element and takes its markup, styles and behavior from Shoelace. The only core extension that remains is the non-bubbling ready event on first update, which the API tables label as inherited from core.',
  'The remove button is an sl-icon-button, as in Shoelace. The registering entry (@charm-ux/velcro/tag or the package root) registers Velcro\'s sl-icon-button and sl-icon up front. Importing the class-only entry (@charm-ux/velcro/tag/class) registers nothing; as with Shoelace\'s declared dependencies, constructing a tag defines Velcro\'s sl-icon-button when that tag is not defined yet (and constructing that defines sl-icon), so no extra step is needed. If another constructor already owns sl-icon-button, the tag renders that element and logs nothing, where Shoelace logs a warning when the registered version differs from its own.',
  'dir and lang are declared as Shoelace\'s base element declares them: reactive, not reflected and undefined until set. Core\'s computed dir is not used. TypeScript types for dir are narrower than Shoelace\'s dir: string: at runtime dir is stored and returned as set and the setter accepts any string, but the read type stays core\'s \'ltr\' | \'rtl\' | \'auto\', because a subclass cannot widen an inherited getter\'s type. Fixing this needs a change in @charm-ux/core and is deferred.',
  'The product test suite is configured for Chromium, Firefox and WebKit; this component\'s spec was run locally in Chromium and WebKit only, and Firefox is covered only by the project\'s CI run. Shoelace\'s own tag test (6 tests, which has no axe accessibility checks) runs in Chromium only and passes. The accessibility-tree check is Playwright\'s ARIA snapshot, which Playwright computes from the DOM; no screen reader and no browser accessibility API was tried, and there is no RTL check and no pixel comparison with Shoelace.',
  'Registration is browser-only and uses the native custom element registry for Velcro\'s own class, without changing the shared core prefix. Server-side rendering is not supported.',
  'The tag reads these theme tokens: --sl-color-{primary,success,neutral,warning,danger}-{50,200,600,800}, --sl-button-font-size-{small,medium,large}, --sl-input-height-{small,medium,large}, --sl-input-border-width, --sl-input-border-radius-{small,medium,large}, --sl-spacing-{x-small,small,medium} and --sl-border-radius-pill; both Velcro themes define them. Without a theme the tag has no colors, height, padding or rounded corners. Rendering under the dark theme has not been checked, and color contrast was not evaluated.',
];

@customElement('page-components-tag')
export class TagPage extends LitElement {
  static override styles = [shellStyles];

  override render() {
    return docsShell('tag', html`
      <h1>Tag</h1>
      <p><code>&lt;sl-tag&gt;</code> is registered by <code>@charm-ux/velcro</code> on top of the <code>@charm-ux/core</code> base element. Prototype status: unreleased.</p>
      <p>Tags are used as labels to organize things or to indicate a selection.</p>

      <h2 id="examples">Examples</h2>
      <p>Each preview runs in its own document. The React version of each live example is Shoelace's, ported to Velcro's generated React wrapper; only its import line differs. It is shown as source.</p>
      ${sections.map(
        ([id, title, text, key, react]) => html`
          <h3 id=${id}>${title}</h3>
          ${text === null ? '' : html`<p>${text}</p>`}
          <iframe class="example" title=${`Tag example: ${title}`} srcdoc=${exampleDocument(examples[key])}></iframe>
          <pre><code>${examples[key]}</code></pre>
          <details class="react-example">
            <summary>React</summary>
            <pre><code>${reactExamples[react]}</code></pre>
          </details>
        `
      )}

      ${apiReference('sl-tag', {
        attributes: html`<p><code>variant</code>, <code>size</code> and <code>pill</code> are reflected. Removing the <code>variant</code> or <code>size</code> attribute restores the value the property held when the tag's first attribute change was handled, as in Shoelace's base element: normally the default (<code>neutral</code>, <code>medium</code>), but not for a tag created from script whose properties were assigned before its first render (see the quirks below); removing <code>pill</code> sets it to <code>false</code>. <code>removable</code> is not reflected. <code>dir</code> and <code>lang</code> are reactive properties with no default that are not reflected, as in Shoelace's base element.</p>`,
        methods: html`<p>None, as in Shoelace. The tag is not focusable, so it has no <code>focus()</code> or <code>blur()</code> of its own.</p>`,
        events: html`<p><code>sl-remove</code> bubbles and is composed, is not cancelable and has an empty <code>detail</code>; it fires when the remove button (shown only while <code>removable</code> is set) is clicked, and its <code>target</code> is the tag. Inherited from core: a non-bubbling <code>ready</code> event on first update, which Shoelace does not have.</p>`,
        parts: html`<p><code>base</code> is the inner <code>span</code>, which holds the default slot (the <code>content</code> part) and, while <code>removable</code>, an <code>sl-icon-button</code> (the <code>remove-button</code> part, labelled with the localized <code>remove</code> term, using the <code>x-lg</code> icon of the <code>system</code> library) that re-exports its own <code>base</code> part as <code>remove-button__base</code>.</p>`,
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

export default TagPage;
