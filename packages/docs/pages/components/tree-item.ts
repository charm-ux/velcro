import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { definePageData } from '@beatzball/litro';
import { docsShell, shellStyles } from '../../src/shell.js';
import { themeHead } from '../../src/theme.js';
import { withBase } from '../../src/base.js';
import { apiReference } from '../../src/api.js';
import { examples, exampleDocument, reactExamples } from '../../src/example.js';

export const pageData = definePageData(async () => ({
  seoTitle: 'Tree Item - Velcro',
  seoHead: themeHead + '<meta name="description" content="Velcro tree item (prototype).">',
}));

// Shoelace's examples, in the order of its page: [id, title, text, example key, React example key]. The first has no heading in
// Shoelace's page; it is the page's opening example. Every example is live and has a React version.
const sections = [
  ['overview', 'Overview', null, 'tree-item/default', 'tree-item/react/default'],
  ['nested', 'Nested tree items', html`A tree item can contain other tree items. This allows the node to be expanded or collapsed by the user.`, 'tree-item/nested', 'tree-item/react/nested'],
  ['selected', 'Selected', html`Use the <code>selected</code> attribute to select a tree item initially.`, 'tree-item/selected', 'tree-item/react/selected'],
  ['expanded', 'Expanded', html`Use the <code>expanded</code> attribute to expand a tree item initially.`, 'tree-item/expanded', 'tree-item/react/expanded'],
] as const;

// Shoelace 2.20.1 behaviors that look like bugs but are matched exactly (candidates for a later opt-in fix). One line each.
const quirks = [
  'A leaf can be expanded: setting expanded on an item without children still runs the expand animation and emits sl-expand and sl-after-expand (and the collapse events when it is cleared); only aria-expanded is left off, because a leaf has no state to announce.',
  'An item rendered with expanded already set shows its children with no animation and emits no sl-expand: the watchers of expanded and lazy only run from the second update on. Setting expanded on a lazy item that is already rendered starts the lazy load (loading and sl-lazy-load) instead of expanding it, and sl-expand follows when the load ends.',
  'A lazy load ends when the children slot changes, whatever expanded is by then, and then the expand animation always runs: if the user collapsed the item while it was loading, the children are shown (and sl-expand is emitted) although expanded is false. An item whose children never change stays in the loading state, with aria-busy="true" and no expand button.',
  'isLeaf is worked out when the item first renders and when its children slot changes, not when lazy changes: removing lazy from an item that has no children leaves it with an expand button and aria-expanded until its children change.',
  'The item\'s own willUpdate replaces the base element\'s without calling it, so the restore of a reflected property\'s initial value that other components get never runs for a tree item: a reflected property (expanded, selected, disabled or lazy) set to null stays null. A removed attribute still gives false.',
  'aria-selected="false" and aria-disabled="false" are written on every item (a tree in single or leaf mode included), and a nested item is given slot="children" when it is connected under another item, replacing any slot it had.',
] as const;

const gaps = [
  'All four of Shoelace\'s examples are ported with a live preview and a React version, in Shoelace\'s order. The React versions import Velcro\'s generated wrappers (@charm-ux/velcro/react/VelcroTree.js and VelcroTreeItem.js) under Shoelace\'s names; nothing else differs.',
  'Core has no tree item, so Velcro builds sl-tree-item on the @charm-ux/core base element and takes its markup, styles and behavior from Shoelace. The only core extension that remains is the non-bubbling ready event on first update, which the API tables label as inherited from core.',
  'The expand and collapse animations come from the animation registry, as in Shoelace: tree-item.expand (250 ms) and tree-item.collapse (200 ms), height and opacity with a cubic-bezier easing, changed per element with setAnimation() or for every item with setDefaultAnimation(), both exported from @charm-ux/velcro/utilities/animation-registry. They do not run when the user prefers reduced motion. As in Shoelace, the rtlKeyframes variant, the chevron icons and the rtl class follow the direction: the item\'s own dir property (set directly or through the attribute) when it is set, else the document\'s direction as the localization module last recorded it (a snapshot, not a live read).',
  'The item renders Velcro\'s sl-checkbox (multiple selection), sl-icon (the chevron-right and chevron-left icons of the system library) and sl-spinner (a lazy item that is loading). Importing the class-only entry (@charm-ux/velcro/tree-item/class) registers nothing; as with Shoelace\'s declared dependencies, constructing an item defines Velcro\'s sl-checkbox, sl-icon and sl-spinner when those tags are not defined yet. If another constructor already owns one of them, the item renders that element and, as in Shoelace, logs a console warning when the two versions differ (Velcro\'s classes declare no version, so the warning appears only when the other constructor declares one, such as a Shoelace element); if the platform refuses a class itself, an anonymous subclass is defined, as in Shoelace. The registering entry (@charm-ux/velcro/tree-item or the package root) registers the three up front, with the same handling, and importing never throws on a tag clash. The item has no translatable text.',
  'The public defaultSlot, childrenSlot, itemElement, childrenContainer and expandButtonSlot fields, the indeterminate, isLeaf, loading and selectable state properties (set by the tree) and the handleLoadingChange(), handleDisabledChange(), handleSelectedChange(), handleExpandedChange(), handleExpandAnimation() and handleLazyChange() handlers exist as in Shoelace, where they are undocumented; the API tables below list the ones the manifest includes.',
  'dir and lang are declared as Shoelace\'s base element declares them: reactive, not reflected and undefined until set. Core\'s computed dir is not used. TypeScript types for dir are narrower than Shoelace\'s dir: string: at runtime dir is stored and returned as set and the setter accepts any string, but the read type stays core\'s \'ltr\' | \'rtl\' | \'auto\', because a subclass cannot widen an inherited getter\'s type. Fixing this needs a change in @charm-ux/core and is deferred.',
  'Shoelace\'s own tree item tests (13, including its expand, collapse, disabled and lazy ones) run against Velcro in Chromium and all pass; they include no accessibility-tree check. The product tests (structure, parts, ARIA attributes, computed styles against Shoelace\'s rules, events, the animation registry, the examples and the React versions) are configured for Chromium, Firefox and WebKit; the spec was run locally in Chromium and WebKit only, and Firefox is covered only by the project\'s CI run. Accessibility is checked with Playwright\'s role and attribute assertions, which Playwright computes from the DOM; no screen reader and no browser accessibility API was tried. There is no touch check, no right-to-left layout check and no pixel comparison with Shoelace, and the examples\' appearance under the dark theme has not been checked.',
  'Registration is browser-only and uses the native custom element registry for Velcro\'s own class, without changing the shared core prefix. Server-side rendering is not supported.',
  'The item reads these theme tokens: --sl-color-neutral-100, -500, -600 and -700, --sl-color-primary-600, --sl-spacing-x-small, --sl-spacing-medium, --sl-spacing-large, --sl-font-sans, the font size, weight, line height and letter spacing tokens, --sl-transition-fast and -medium, --sl-focus-ring and --sl-focus-ring-offset; both Velcro themes define them. Without a theme the item has no selection color, focus ring or spacing.',
] as const;

@customElement('page-components-tree-item')
export class TreeItemPage extends LitElement {
  static override styles = [shellStyles];

  override render() {
    return docsShell('tree-item', html`
      <h1>Tree Item</h1>
      <p><code>&lt;sl-tree-item&gt;</code> is registered by <code>@charm-ux/velcro</code> on top of the <code>@charm-ux/core</code> base element. Prototype status: unreleased.</p>
      <p>A tree item serves as a hierarchical node that lives inside a <a href=${withBase('/components/tree')}>tree</a>.</p>

      <h2 id="examples">Examples</h2>
      <p>Each preview runs in its own document. The React version of each example is Shoelace's, ported to Velcro's generated React wrappers; only its import lines differ. It is shown as source and run by the product tests.</p>
      ${sections.map(
        ([id, title, text, key, react]) => html`
          <h3 id=${id}>${title}</h3>
          ${text === null ? '' : html`<p>${text}</p>`}
          <iframe class="example" title=${`Tree Item example: ${title}`} srcdoc=${exampleDocument(examples[key])}></iframe>
          <pre><code>${examples[key]}</code></pre>
          <details class="react-example">
            <summary>React</summary>
            <pre><code>${reactExamples[react]}</code></pre>
          </details>
        `
      )}

      ${apiReference('sl-tree-item', {
        attributes: html`<p><code>expanded</code>, <code>selected</code>, <code>disabled</code> and <code>lazy</code> are reflected. <code>dir</code> and <code>lang</code> are reactive properties with no default that are not reflected, as in Shoelace's base element. <code>indeterminate</code>, <code>isLeaf</code>, <code>loading</code> and <code>selectable</code> are internal state that the tree and the item set (see the quirks for when <code>loading</code> ends).</p>`,
        methods: html`<p><code>getChildrenItems()</code> returns the tree items assigned to the <code>children</code> slot, in order; pass <code>{ includeDisabled: false }</code> to leave out the disabled ones.</p>`,
        events: html`<p>All six events bubble and are composed, and none is cancelable. <code>sl-expand</code> and <code>sl-collapse</code> are emitted when the animation starts and the after events when it ends; <code>sl-lazy-change</code> follows a change of <code>lazy</code> after the first update; <code>sl-lazy-load</code> is emitted when a lazy item is expanded. Inherited from core: a non-bubbling <code>ready</code> event on first update, which Shoelace does not have.</p>`,
        slots: html`<p>The default slot is the label; nested tree items are given the <code>children</code> slot when they are connected. The icon slots hold the <a href=${withBase('/components/tree')}>tree</a>'s cloned icons or their <code>sl-icon</code> fallback.</p>`,
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

export default TreeItemPage;
