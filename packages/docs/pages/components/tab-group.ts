import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { definePageData } from '@beatzball/litro';
import { docsShell, shellStyles } from '../../src/shell.js';
import { themeHead } from '../../src/theme.js';
import { withBase } from '../../src/base.js';
import { apiReference } from '../../src/api.js';
import { examples, exampleDocument, reactExamples } from '../../src/example.js';

export const pageData = definePageData(async () => ({
  seoTitle: 'Tab Group - Velcro',
  seoHead: themeHead + '<meta name="description" content="Velcro tab group (prototype).">',
}));

// Shoelace's examples, in the order of its page: [id, title, text, example key, React example key]. The first has no heading in
// Shoelace's page; it is the page's opening example. Every example is live and has a React version.
const sections = [
  ['basic', 'Default', null, 'tab-group/basic', 'tab-group/react/basic'],
  ['bottom', 'Tabs on Bottom', html`Tabs can be shown on the bottom by setting <code>placement</code> to <code>bottom</code>.`, 'tab-group/bottom', 'tab-group/react/bottom'],
  ['start', 'Tabs on Start', html`Tabs can be shown on the starting side by setting <code>placement</code> to <code>start</code>.`, 'tab-group/start', 'tab-group/react/start'],
  ['end', 'Tabs on End', html`Tabs can be shown on the ending side by setting <code>placement</code> to <code>end</code>.`, 'tab-group/end', 'tab-group/react/end'],
  ['closable', 'Closable Tabs', html`Add the <code>closable</code> attribute to a tab to show a close button. This example shows how you can dynamically remove tabs from the DOM when the close button is activated.`, 'tab-group/closable', 'tab-group/react/closable'],
  ['scrolling', 'Scrolling Tabs', html`When there are more tabs than horizontal space allows, the nav will be scrollable.`, 'tab-group/scrolling', 'tab-group/react/scrolling'],
  ['fixed-scroll-controls', 'Fixed scroll controls', html`When tabs are scrolled all the way to one side, the scroll button on that side can't be clicked. Set the <code>fixed-scroll-controls</code> attribute to keep the effected button visible in that case.`, 'tab-group/fixed-scroll-controls', 'tab-group/react/fixed-scroll-controls'],
  ['manual', 'Manual Activation', html`When focused, keyboard users can press <kbd>Left</kbd> or <kbd>Right</kbd> to select the desired tab. By default, the corresponding tab panel will be shown immediately (automatic activation). You can change this behavior by setting <code>activation="manual"</code> which will require the user to press <kbd>Space</kbd> or <kbd>Enter</kbd> before showing the tab panel (manual activation).`, 'tab-group/manual', 'tab-group/react/manual'],
] as const;

// Shoelace 2.20.1 behaviors that look like bugs but are matched exactly (candidates for a later opt-in fix). One line each.
const quirks = [
  'placement is not reflected: setting the property leaves no attribute (and the attribute as written in markup stays as it was), so sl-tab-group[placement=...] selectors do not follow the property.',
  'The first tab (or the tab marked active) is only selected once the tab group becomes visible: an intersection observer waits for it. A tab group that starts out hidden (for example inside a display: none ancestor) has no active tab and shows no panel until it is displayed.',
  'Setting active to false on the active tab from script leaves no tab active while its panel stays displayed, and clicking that tab again does nothing, because the tab group still holds it as its active tab. Selecting another tab recovers.',
  'aria-controls and aria-labelledby are written only when the group first becomes visible and after a later change of its tabs or panels (in a timeout), and only for a tab whose panel exists then; nothing removes them.',
  'The scroll buttons have tabindex="-1" and aria-hidden="true", so they cannot be reached with the keyboard or by assistive technology; the arrow keys scroll the active tab into view instead.',
  'The initial selection emits no sl-tab-show, and a click on the active tab or on a disabled tab emits nothing; sl-tab-show and sl-tab-hide are not cancelable.',
] as const;

const gaps = [
  'All eight of Shoelace\'s examples (the opening one, Tabs on Bottom, Start and End, Closable Tabs, Scrolling Tabs, Fixed scroll controls and Manual Activation) are ported with a live preview and a React version, in Shoelace\'s order. The React examples import Velcro\'s generated wrappers (@charm-ux/velcro/react/VelcroTabGroup.js, VelcroTab.js and VelcroTabPanel.js) under Shoelace\'s names; nothing else differs. As in Shoelace, the React Closable example passes onSlClose to the tab group wrapper too, which has no such event prop, and the React Fixed scroll controls example sets an auto-hide-scroll-buttons attribute that nothing reads, so its controls are not fixed.',
  'Velcro builds sl-tab-group on the @charm-ux/core base element, not on core\'s tabs component: core\'s tabs put tabs in the default slot and panels in a tabpanel slot, select by an active-id attribute and have layout and manual-activation attributes and a tabs-change event, which is a different model from Shoelace\'s nav slot, panel names and active tabs. The only core extension that remains is the non-bubbling ready event on first update, which the API tables label as inherited from core.',
  'The scroll buttons are sl-icon-button elements and the tabs are measured through an sl-resize-observer, as in Shoelace. The registering entry (@charm-ux/velcro/tab-group or the package root) registers Velcro\'s sl-icon-button, sl-icon and sl-resize-observer up front. Importing the class-only entry (@charm-ux/velcro/tab-group/class) registers nothing; as with Shoelace\'s declared dependencies, constructing a tab group defines Velcro\'s sl-icon-button and sl-resize-observer when they are not defined yet. If another constructor already owns one of those tags, the tab group renders that element and logs nothing, where Shoelace logs a warning when the registered version differs from its own. As in Shoelace, sl-tab and sl-tab-panel are separate components: the tab group entry does not register them, and the tab group only sets itself up once both are defined.',
  'Like Shoelace, importing the tab group applies Shoelace\'s scrollend polyfill: where the browser has no native scrollend event, adding a scrollend listener to any event target is patched to dispatch one after scrolling stops. The polyfill module is listed in the package\'s sideEffects, so bundlers keep it, including for the class-only entry.',
  'The public tabGroup, body, nav and indicator fields and the syncIndicator() and updateScrollControls() methods exist as in Shoelace, where they are public but undocumented; the API tables below list them without a description.',
  'dir and lang are declared as Shoelace\'s base element declares them: reactive, not reflected and undefined until set. Core\'s computed dir is not used. TypeScript types for dir are narrower than Shoelace\'s dir: string: at runtime dir is stored and returned as set and the setter accepts any string, but the read type stays core\'s \'ltr\' | \'rtl\' | \'auto\', because a subclass cannot widen an inherited getter\'s type. Fixing this needs a change in @charm-ux/core and is deferred.',
  'The product test suite is configured for Chromium, Firefox and WebKit; this component\'s spec was run locally in Chromium and WebKit only, and Firefox is covered only by the project\'s CI run. Shoelace\'s own tab group test (23 tests, 3 of which upstream skips) runs in Chromium only; all 20 that run pass. The accessibility-tree check is Playwright\'s ARIA snapshot, which Playwright computes from the DOM; no screen reader and no browser accessibility API was tried. Right-to-left keyboard navigation and the indicator position are checked; the right-to-left scroll buttons are not, and there is no pixel comparison with Shoelace.',
  'Registration is browser-only and uses the native custom element registry for Velcro\'s own class, without changing the shared core prefix. Server-side rendering is not supported.',
  'The tab group reads these theme tokens: --sl-color-primary-600, --sl-color-neutral-200, --sl-spacing-medium, --sl-spacing-x-large and --sl-transition-fast; both Velcro themes define them. Rendering under the dark theme has not been checked, and color contrast was not evaluated.',
];

@customElement('page-components-tab-group')
export class TabGroupPage extends LitElement {
  static override styles = [shellStyles];

  override render() {
    return docsShell('tab-group', html`
      <h1>Tab Group</h1>
      <p><code>&lt;sl-tab-group&gt;</code> is registered by <code>@charm-ux/velcro</code> on top of the <code>@charm-ux/core</code> base element. Prototype status: unreleased.</p>
      <p>Tab groups organize content into a container that shows one section at a time.</p>
      <p>Tab groups make use of <a href=${withBase('/components/tab')}>tabs</a> and <a href=${withBase('/components/tab-panel')}>tab panels</a>. Each tab must be slotted into the <code>nav</code> slot and its <code>panel</code> must refer to a tab panel of the same name.</p>

      <h2 id="examples">Examples</h2>
      <p>Each preview runs in its own document, so its script uses plain <code>document.querySelector</code>. The React version of each live example is Shoelace's, ported to Velcro's generated React wrappers; only its import lines differ. It is shown as source.</p>
      ${sections.map(
        ([id, title, text, key, react]) => html`
          <h3 id=${id}>${title}</h3>
          ${text === null ? '' : html`<p>${text}</p>`}
          <iframe class="example" title=${`Tab Group example: ${title}`} srcdoc=${exampleDocument(examples[key])}></iframe>
          <pre><code>${examples[key]}</code></pre>
          <details class="react-example">
            <summary>React</summary>
            <pre><code>${reactExamples[react]}</code></pre>
          </details>
        `
      )}

      ${apiReference('sl-tab-group', {
        attributes: html`<p>None of the attributes is reflected, as in Shoelace, so nothing is restored when one is removed: removing <code>placement</code> or <code>activation</code> sets the property to <code>null</code>, removing a Boolean attribute sets it to <code>false</code>. <code>dir</code> and <code>lang</code> are reactive properties with no default that are not reflected, as in Shoelace's base element. The direction used for the arrow keys, the indicator and the scroll buttons is the tab group's own <code>dir</code>, set by the attribute or the property, else the document's (<code>&lt;html dir&gt;</code>), as in Shoelace; an intermediate ancestor's does not count.</p>`,
        methods: html`<p><code>show(panel)</code> selects the tab whose <code>panel</code> is the given name, scrolling it into view smoothly, and emits <code>sl-tab-hide</code> and <code>sl-tab-show</code>; it does nothing for an unknown name, a disabled tab or the active tab.</p>`,
        events: html`<p><code>sl-tab-show</code> and <code>sl-tab-hide</code> bubble, are composed and are not cancelable; their <code>detail</code> is <code>{ name }</code>, the <code>panel</code> of the tab shown or hidden. They fire when a click, a key or <code>show()</code> changes the active tab, or when a tab's <code>active</code> attribute is set to true; <code>sl-tab-hide</code> fires first, and neither fires for the initial selection. Inherited from core: a non-bubbling <code>ready</code> event on first update, which Shoelace does not have.</p>`,
        slots: html`<p>Tabs go in the <code>nav</code> slot, tab panels in the default slot; elements in the default slot other than <code>sl-tab-panel</code> are displayed but ignored.</p>`,
        parts: html`<p><code>base</code> wraps the <code>nav</code> container (with the scroll buttons, when shown, and the scrolling <code>tabs</code> list that has <code>role="tablist"</code> and the <code>active-tab-indicator</code>) and the <code>body</code> slot. Each scroll button is an <code>sl-icon-button</code> with the <code>scroll-button</code> part and <code>scroll-button--start</code> or <code>scroll-button--end</code>, labelled with the localized <code>scrollToStart</code> or <code>scrollToEnd</code> term and using the <code>chevron-left</code> or <code>chevron-right</code> icon of the <code>system</code> library; it re-exports its own <code>base</code> part as <code>scroll-button__base</code>.</p>`,
      })}

      <h2 id="keyboard">Keyboard</h2>
      <p>As in Shoelace: with focus on a tab, <kbd>Left</kbd> and <kbd>Right</kbd> (for <code>top</code> and <code>bottom</code> placement; <kbd>Up</kbd> and <kbd>Down</kbd> for <code>start</code> and <code>end</code>) move focus to the previous or next enabled tab, wrapping around, and <kbd>Home</kbd> and <kbd>End</kbd> to the first or last enabled tab. With <code>activation="auto"</code> (the default) the focused tab is selected at once; with <code>manual</code> it is selected with <kbd>Enter</kbd> or <kbd>Space</kbd>. Only the active tab is a tab stop.</p>

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

export default TabGroupPage;
