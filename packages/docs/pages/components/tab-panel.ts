import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { definePageData } from '@beatzball/litro';
import { docsShell, shellStyles } from '../../src/shell.js';
import { themeHead } from '../../src/theme.js';
import { apiReference } from '../../src/api.js';
import { examples, exampleDocument } from '../../src/example.js';

export const pageData = definePageData(async () => ({
  seoTitle: 'Tab Panel - Velcro',
  seoHead: themeHead + '<meta name="description" content="Velcro tab panel (prototype).">',
}));

const sections = [
  ['overview', 'Overview', 'tab-panel/basic', 'Shoelace\'s example puts these panels in an sl-tab-group next to sl-tab elements. Velcro has neither yet, so the buttons here do what a tab group does to a panel: they make one panel active. Only the active panel is displayed.'],
  ['padding', 'Custom padding', 'tab-panel/padding', 'Use the --padding custom property to change the padding around the panel\'s content. It is 0 by default.'],
] as const;

// Shoelace 2.20.1 behaviors that look like bugs but are matched exactly (candidates for a later opt-in fix). One line each.
const quirks = [
  'The generated id is sl-tab-panel-<n>, where n comes from one counter shared by every tab panel on the page. The counter advances when a panel is constructed, not when it is connected, so a panel that is created and never connected still uses a number. The id is only written on connect, and only when the element has no id then: an id the page set is kept, and one removed later is not regenerated until the panel is connected again.',
  'The role is set to tabpanel on every connect, replacing any role the page gave the element.',
  'aria-hidden is written whenever active changes, including the first update ("true" while inactive, "false" while active), so it replaces an aria-hidden the page set. Nothing else updates it.',
  'The hidden attribute does not hide an active panel: the panel\'s own display: block outranks the browser\'s [hidden] rule. An inactive panel is always display: none.',
  'Removing a reflected attribute restores the value recorded when the first observed attribute (including dir and lang) changed, not the default. The first change is name="" being reflected at the first update, so removing the name attribute normally leaves an empty name. A name assigned as a property before the first update is the value that reflects first, so it is the one restored and the attribute returns.',
] as const;

const gaps = [
  'The Shoelace example uses sl-tab-group and sl-tab, which Velcro does not implement yet. The ported example makes panels active with sl-button elements instead. With no tab group, nothing sets aria-labelledby on a panel, and tab keyboard navigation does not exist. The Shoelace React example is not ported.',
  'Velcro builds on the @charm-ux/core tab panel. Core\'s own tab coordination conflicts with Shoelace\'s model, so it is switched off rather than kept: core sets slot="tabpanel" and hidden on the panel and listens for transitionend (none of that happens), core\'s internal visible and tab properties are accepted but do nothing, and the tab-show, tab-hide, tab-after-show and tab-after-hide events are never emitted. Core\'s --tab-panel-* custom properties and tab-panel-base part do not exist either, because core\'s panel styles are replaced by Shoelace\'s. The only core extension that remains is the non-bubbling ready event on first update, which the API tables label as inherited from core.',
  'dir and lang are declared as Shoelace\'s base element declares them: reactive, not reflected and undefined until set. Core\'s computed dir is not used.',
  'The element is checked in Chromium by product tests and by Shoelace\'s five tab panel tests, which all pass: the generated id, role and aria-hidden, reflection and the accessibility check. There is no Firefox, WebKit, RTL or screen reader check, and no pixel comparison with Shoelace.',
  'Registration is browser-only and uses the native custom element registry for Velcro\'s own class, without changing the shared core prefix. Server-side rendering is not supported.',
  'The component has no theme tokens of its own (only --padding), so it works with both themes. The examples\' appearance under the dark theme has not been checked.',
];

@customElement('page-components-tab-panel')
export class TabPanelPage extends LitElement {
  static override styles = [shellStyles];

  override render() {
    return docsShell('tab-panel', html`
      <h1>Tab Panel</h1>
      <p><code>&lt;sl-tab-panel&gt;</code> is registered by <code>@charm-ux/velcro</code> on top of the <code>@charm-ux/core</code> tab panel. Prototype status: unreleased.</p>
      <p>Tab panels are used inside tab groups to display tabbed content.</p>

      <h2 id="examples">Examples</h2>
      <p>Each preview runs in its own document, so its script uses plain <code>document.querySelector</code>.</p>
      ${sections.map(
        ([id, title, key, text]) => html`
          <h3 id=${id}>${title}</h3>
          <p>${text}</p>
          <iframe class="example" title=${`Tab Panel example: ${title}`} srcdoc=${exampleDocument(examples[key])}></iframe>
          <pre><code>${examples[key]}</code></pre>
        `
      )}

      ${apiReference('sl-tab-panel', {
        attributes: html`<p>Removing a reflected attribute restores the value recorded at the first attribute change, as in Shoelace (see the quirks below). <code>dir</code> and <code>lang</code> are reactive properties with no default that are not reflected, as in Shoelace's base element.</p>`,
        events: html`<p>Shoelace's tab panel has no events. Inherited from core: a non-bubbling <code>ready</code> event on first update, which Shoelace does not have. Core's <code>tab-show</code>, <code>tab-hide</code>, <code>tab-after-show</code> and <code>tab-after-hide</code> are never emitted.</p>`,
        slots: html`<p>The default slot holds the panel's content and carries the <code>base</code> part.</p>`,
        parts: html`<p>The <code>base</code> part is the slot element itself, as in Shoelace.</p>`,
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

export default TabPanelPage;
