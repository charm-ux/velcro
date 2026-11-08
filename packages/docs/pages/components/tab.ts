import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { definePageData } from '@beatzball/litro';
import { docsShell, shellStyles } from '../../src/shell.js';
import { themeHead } from '../../src/theme.js';
import { apiReference } from '../../src/api.js';
import { examples, exampleDocument } from '../../src/example.js';

export const pageData = definePageData(async () => ({
  seoTitle: 'Tab - Velcro',
  seoHead: themeHead + '<meta name="description" content="Velcro tab (prototype).">',
}));

// Shoelace 2.20.1 behaviors that look like bugs but are matched exactly (candidates for a later opt-in fix). One line each.
const quirks = [
  'The generated id is sl-tab-<n>, where n comes from one counter shared by every tab on the page and advances when a tab is constructed, so a tab that is never connected still uses a number. The id is written when the tab renders and only when it has none: an id the page set is kept, and one removed later is regenerated at the next render.',
  'The role is set to tab on every connect, and aria-selected ("true" or "false", following active) and aria-disabled ("true" or "false", following disabled) are written whenever those properties change, including the first update, so they replace values the page set.',
  'A disabled tab that is active keeps tabindex="0", and enabling a tab always sets tabindex to 0, whatever a tab group had set; the tab group sets it back when it next selects a tab.',
  'The close button cannot be reached with the Tab key: it has tabindex="-1". sl-close is not cancelable, and the tab never removes itself: the listener decides what happens (Shoelace\'s Closable example removes the tab and its panel).',
  'Removing a reflected attribute restores the value recorded at the first attribute change, not always the default: for a tab written in markup that is the default (empty panel, false for the Boolean attributes, tabindex 0); a property assigned before the first render is the value that is restored.',
  'A closable tab\'s accessible name includes its close button\'s label (for example "Closable Close"), because the button is rendered inside the element that has the tab role.',
  'The tab\'s transition names an undefined --transition-speed custom property, so it has no transition, as in Shoelace.',
] as const;

const gaps = [
  'Shoelace\'s tab page has no examples of its own; it points to the tab group examples. The example here is Velcro\'s: a tab group with a closable and a disabled tab. Shoelace\'s eight tab group examples, with React versions, are on the tab group page.',
  'Velcro builds sl-tab on the @charm-ux/core tab. Core\'s tab belongs to core\'s own tabs, whose model conflicts with Shoelace\'s, so most of it is switched off: core\'s selected property has no attribute and no effect (it is listed below as a Velcro extension; use active), its internal tabPanel property has no effect, its start and end slots, tab-base part and --tab-* custom properties do not exist (core\'s tab styles are replaced by Shoelace\'s), and core\'s rule that clears aria-selected on a disabled tab does not run. Core\'s connect step is kept: it sets role="tab", as Shoelace\'s does. The only other core extension that remains is the non-bubbling ready event on first update, which the API tables label as inherited from core.',
  'The close button is an sl-icon-button, as in Shoelace. The registering entry (@charm-ux/velcro/tab or the package root) registers Velcro\'s sl-icon-button and sl-icon up front. Importing the class-only entry (@charm-ux/velcro/tab/class) registers nothing; as with Shoelace\'s declared dependencies, constructing a tab defines Velcro\'s sl-icon-button when that tag is not defined yet (and constructing that defines sl-icon). If another constructor already owns sl-icon-button, the tab renders that element and logs nothing, where Shoelace logs a warning when the registered version differs from its own.',
  'The public tab field and the handleActiveChange() and handleDisabledChange() methods exist as in Shoelace, where they are public but undocumented; the API tables below list them without a description. tabIndex is a reactive property reflected to tabindex, as in Shoelace.',
  'dir and lang are declared as Shoelace\'s base element declares them: reactive, not reflected and undefined until set. Core\'s computed dir is not used. TypeScript types for dir are narrower than Shoelace\'s dir: string: at runtime dir is stored and returned as set and the setter accepts any string, but the read type stays core\'s \'ltr\' | \'rtl\' | \'auto\', because a subclass cannot widen an inherited getter\'s type. Fixing this needs a change in @charm-ux/core and is deferred.',
  'The product test suite is configured for Chromium, Firefox and WebKit; this component\'s spec was run locally in Chromium and WebKit only, and Firefox is covered only by the project\'s CI run. Shoelace\'s own tab test (8 tests) runs in Chromium only and passes. The accessibility-tree check is Playwright\'s ARIA snapshot, which Playwright computes from the DOM; no screen reader and no browser accessibility API was tried, and there is no RTL check and no pixel comparison with Shoelace.',
  'Registration is browser-only and uses the native custom element registry for Velcro\'s own class, without changing the shared core prefix. Server-side rendering is not supported.',
  'The tab reads these theme tokens: --sl-font-sans, --sl-font-size-small, --sl-font-weight-semibold, --sl-border-radius-medium, --sl-color-neutral-600, --sl-color-primary-600, --sl-spacing-{3x-small,small,medium,large}, --sl-focus-ring, --sl-focus-ring-width and --sl-focus-ring-offset; both Velcro themes define them. Rendering under the dark theme has not been checked, and color contrast was not evaluated.',
];

@customElement('page-components-tab')
export class TabPage extends LitElement {
  static override styles = [shellStyles];

  override render() {
    return docsShell('tab', html`
      <h1>Tab</h1>
      <p><code>&lt;sl-tab&gt;</code> is registered by <code>@charm-ux/velcro</code> on top of the <code>@charm-ux/core</code> tab. Prototype status: unreleased.</p>
      <p>Tabs are used inside <a href="/components/tab-group">tab groups</a> to represent and activate <a href="/components/tab-panel">tab panels</a>.</p>
      <p>Additional demonstrations can be found in the <a href="/components/tab-group">tab group examples</a>.</p>

      <h2 id="examples">Examples</h2>
      <h3 id="overview">Overview</h3>
      <p>Tabs go in a tab group's <code>nav</code> slot; each tab's <code>panel</code> names the tab panel it shows.</p>
      <iframe class="example" title="Tab example: Overview" srcdoc=${exampleDocument(examples['tab/basic'])}></iframe>
      <pre><code>${examples['tab/basic']}</code></pre>

      ${apiReference('sl-tab', {
        attributes: html`<p><code>panel</code>, <code>active</code>, <code>closable</code> and <code>disabled</code> are reflected, and so is <code>tabIndex</code> (to <code>tabindex</code>). Removing one of their attributes restores the value the property held at the first attribute change, as in Shoelace's base element (see the quirks below). <code>dir</code> and <code>lang</code> are reactive properties with no default that are not reflected, as in Shoelace's base element.</p>`,
        methods: html`<p>None documented, as in Shoelace. The tab is focusable (<code>tabindex</code>), so the native <code>focus()</code> and <code>blur()</code> apply.</p>`,
        events: html`<p><code>sl-close</code> bubbles and is composed, is not cancelable and has an empty <code>detail</code>; it fires when the close button (shown only while <code>closable</code> is set) is clicked, and its <code>target</code> is the tab. The click itself does not propagate past the close button. Inherited from core: a non-bubbling <code>ready</code> event on first update, which Shoelace does not have.</p>`,
        parts: html`<p><code>base</code> is the inner <code>div</code>, which holds the default slot and, while <code>closable</code>, an <code>sl-icon-button</code> (the <code>close-button</code> part, labelled with the localized <code>close</code> term, using the <code>x-lg</code> icon of the <code>system</code> library) that re-exports its own <code>base</code> part as <code>close-button__base</code>.</p>`,
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

export default TabPage;
