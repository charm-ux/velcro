import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { definePageData } from '@beatzball/litro';
import { docsShell, shellStyles } from '../../src/shell.js';
import { themeHead } from '../../src/theme.js';
import { withBase } from '../../src/base.js';
import { apiReference } from '../../src/api.js';
import { examples, exampleDocument, reactExamples } from '../../src/example.js';

export const pageData = definePageData(async () => ({
  seoTitle: 'Tree - Velcro',
  seoHead: themeHead + '<meta name="description" content="Velcro tree (prototype).">',
}));

// Shoelace's examples, in the order of its page: [id, title, text, example key, React example key]. The first has no heading in
// Shoelace's page; it is the page's opening example. Every example is live and has a React version.
const sections = [
  ['overview', 'Overview', null, 'tree/default', 'tree/react/default'],
  ['selection-modes', 'Selection Modes', html`The <code>selection</code> attribute lets you change the selection behavior of the tree.<ul><li>Use <code>single</code> to allow the selection of a single item (default).</li><li>Use <code>multiple</code> to allow the selection of multiple items.</li><li>Use <code>leaf</code> to only allow leaf nodes to be selected.</li></ul>`, 'tree/selection-modes', 'tree/react/selection-modes'],
  ['indent-guides', 'Showing Indent Guides', html`Indent guides can be drawn by setting <code>--indent-guide-width</code>. You can also change the color, offset, and style, using <code>--indent-guide-color</code>, <code>--indent-guide-style</code>, and <code>--indent-guide-offset</code>, respectively.`, 'tree/indent-guides', 'tree/react/indent-guides'],
  ['lazy-loading', 'Lazy Loading', html`Use the <code>lazy</code> attribute on a tree item to indicate that the content is not yet present and will be loaded later. When the user tries to expand the node, the <code>loading</code> state is set to <code>true</code> and the <code>sl-lazy-load</code> event will be emitted to allow you to load data asynchronously. The item will remain in a loading state until its content is changed.<br><br>If you want to disable this behavior after the first load, simply remove the <code>lazy</code> attribute and, on the next expand, the existing content will be shown instead.`, 'tree/lazy-loading', 'tree/react/lazy-loading'],
  ['custom-icons', 'Customizing the Expand and Collapse Icons', html`Use the <code>expand-icon</code> and <code>collapse-icon</code> slots to change the expand and collapse icons, respectively. To disable the animation, override the <code>rotate</code> property on the <code>expand-button</code> part as shown below.`, 'tree/custom-icons', 'tree/react/custom-icons'],
  ['with-icons', 'With Icons', html`Decorative icons can be used before labels to provide hints for each node.`, 'tree/with-icons', 'tree/react/with-icons'],
] as const;

// Shoelace 2.20.1 behaviors that look like bugs but are matched exactly (candidates for a later opt-in fix). One line each.
const quirks = [
  'The default --indent-size is the large spacing token: the tree\'s stylesheet sets --indent-size: var(--sl-spacing-large), although the documented default (and the API table below, which is generated from it) says var(--sl-spacing-medium).',
  'ArrowRight does not stop at an end node, as the code comment says it should: on a leaf, a disabled or an already expanded item it moves focus to the next focusable item, exactly like ArrowDown. ArrowLeft does not move focus to the parent, as its comment says: on a leaf, a collapsed or a disabled item it moves focus to the previous focusable item, exactly like ArrowUp.',
  'Enter or Space with focus on an element inside the tree that is not a tree item (a button slotted into an item\'s label, for example) throws a TypeError from the key handler, after the key\'s default action was prevented: no item has focus, so there is no active item to select. The arrow keys, Home and End work from that position.',
  'sl-selection-change is emitted only for selections made through the tree (a click, Enter or Space), and only when the set of selected items changed, after the items have updated. Setting selected from script emits nothing and does not deselect other items in single mode, so two items can be selected at once; in multiple mode it does not update the ancestors or descendants either.',
  'In leaf mode a click, Enter or Space on a branch only toggles its expansion: nothing is selected and no event is emitted. In single mode the same click selects the branch and does not toggle it; only the expand button (and the arrow keys) toggle it. In multiple mode, selecting a lazy item also expands it, which starts its lazy load.',
  'Roving tabindex is not restored when focus leaves: the tree becomes tabindex="0" again, but the item that had focus keeps tabindex="0" too, so the tree has two tab stops until another item is focused.',
  'The tree sets role, tabindex and aria-multiselectable itself, replacing any value the page gave: role="tree" and tabindex="0" on connect, aria-multiselectable on every change of selection (so aria-multiselectable="false" in single and leaf mode).',
] as const;

const gaps = [
  'All six of Shoelace\'s examples are ported with a live preview and a React version, in Shoelace\'s order. The React versions import Velcro\'s generated wrappers (@charm-ux/velcro/react/VelcroTree.js, VelcroTreeItem.js and, where used, VelcroIcon.js, VelcroSelect.js and VelcroOption.js) under Shoelace\'s names. Shoelace\'s React examples have import gaps (the Selection Modes and Lazy Loading ones use useState without importing it, the Customizing the Icons one uses SlIcon without importing it, and the Selection Modes one uses SlSelect and SlMenuItem without importing them); the missing imports are added. Shoelace\'s Selection Modes example puts SlMenuItem elements inside SlSelect, which Shoelace 2\'s select does not take as options (it takes sl-option), so the ported example uses SlOption with the same values and labels. Shoelace\'s With Icons React example is a different tree from its HTML one (Root, Folder 1, Folder 2 and File 1, with the files icon); it is ported unchanged.',
  'Core has no tree, so Velcro builds sl-tree and sl-tree-item on the @charm-ux/core base element and takes their markup, styles and behavior from Shoelace. The only core extension that remains is the non-bubbling ready event on first update, which the API tables label as inherited from core. Shoelace\'s tree has no type-ahead (typing a letter does nothing), so neither does Velcro\'s.',
  'As in Shoelace, sl-tree-item is a separate component: the tree entry (@charm-ux/velcro/tree) registers only sl-tree, and the tree has no dependencies to define. Import @charm-ux/velcro/tree-item (or the package root) for the items; the item\'s entry also registers Velcro\'s sl-checkbox, sl-icon and sl-spinner. The tree finds its items by the sl-tree-item tag name, so a different tag registered for the item class is not seen by the tree.',
  'The public defaultSlot, expandedIconSlot and collapsedIconSlot fields, the handleMouseDown() and handleSelectionChange() methods, the selectedItems getter and getFocusableItems() exist as in Shoelace, where they are undocumented or marked internal; the API tables below list the ones the manifest includes.',
  'The expand and collapse animations of the items come from the animation registry (tree-item.expand and tree-item.collapse); see the tree item page. The keyboard handling reads the direction as Shoelace\'s localization controller does: the tree\'s own dir property (set directly or through the attribute), else the document\'s direction as the localization module last recorded it, not a live read.',
  'dir and lang are declared as Shoelace\'s base element declares them: reactive, not reflected and undefined until set. Core\'s computed dir is not used. TypeScript types for dir are narrower than Shoelace\'s dir: string: at runtime dir is stored and returned as set and the setter accepts any string, but the read type stays core\'s \'ltr\' | \'rtl\' | \'auto\', because a subclass cannot widen an inherited getter\'s type. Fixing this needs a change in @charm-ux/core and is deferred.',
  'Shoelace\'s own tree tests (38, including the item-selection, keyboard, multiple-selection and lazy-loading ones) run against Velcro in Chromium and all pass; they include no accessibility-tree check. The product tests are configured for Chromium, Firefox and WebKit; the spec was run locally in Chromium and WebKit only, and Firefox is covered only by the project\'s CI run. Accessibility is checked with Playwright\'s role and attribute assertions on the tree and its items, which Playwright computes from the DOM; no screen reader and no browser accessibility API was tried. There is no touch check, no right-to-left layout check (the arrow-key direction is tested) and no pixel comparison with Shoelace, and the examples\' appearance under the dark theme has not been checked.',
  'Registration is browser-only and uses the native custom element registry for Velcro\'s own class, without changing the shared core prefix. Server-side rendering is not supported.',
  'The tree reads no theme tokens itself apart from the spacing and color tokens that give its indent guides their defaults (--sl-spacing-large and --sl-color-neutral-200); its items read more (see the tree item page). Both Velcro themes define them.',
] as const;

@customElement('page-components-tree')
export class TreePage extends LitElement {
  static override styles = [shellStyles];

  override render() {
    return docsShell('tree', html`
      <h1>Tree</h1>
      <p><code>&lt;sl-tree&gt;</code> is registered by <code>@charm-ux/velcro</code> on top of the <code>@charm-ux/core</code> base element. Prototype status: unreleased.</p>
      <p>Trees allow you to display a hierarchical list of selectable <a href=${withBase('/components/tree-item')}>tree items</a>. Items with children can be expanded and collapsed as desired by the user.</p>

      <h2 id="examples">Examples</h2>
      <p>Each preview runs in its own document, so its script uses plain <code>document.querySelector</code>. The React version of each example is Shoelace's, ported to Velcro's generated React wrappers (see the limits below for the import lines it needed). It is shown as source and run by the product tests.</p>
      ${sections.map(
        ([id, title, text, key, react]) => html`
          <h3 id=${id}>${title}</h3>
          ${text === null ? '' : html`<p>${text}</p>`}
          <iframe class="example" title=${`Tree example: ${title}`} srcdoc=${exampleDocument(examples[key])}></iframe>
          <pre><code>${examples[key]}</code></pre>
          <details class="react-example">
            <summary>React</summary>
            <pre><code>${reactExamples[react]}</code></pre>
          </details>
        `
      )}

      ${apiReference('sl-tree', {
        attributes: html`<p><code>selection</code> is not reflected. <code>dir</code> and <code>lang</code> are reactive properties with no default that are not reflected, as in Shoelace's base element. <code>defaultSlot</code>, <code>expandedIconSlot</code>, <code>collapsedIconSlot</code>, <code>selectedItems</code>, <code>handleMouseDown()</code>, <code>handleSelectionChange()</code> and <code>getFocusableItems()</code> are Shoelace's public but undocumented members.</p>`,
        events: html`<p><code>sl-selection-change</code> bubbles, is composed and is not cancelable; its <code>detail</code> is <code>{ selection }</code>, the array of selected tree items in document order (see the quirks for when it is emitted). Inherited from core: a non-bubbling <code>ready</code> event on first update, which Shoelace does not have.</p>`,
        slots: html`<p>The default slot holds the tree items. The <code>expand-icon</code> and <code>collapse-icon</code> slots are hidden: the tree clones the first element assigned to each into the <code>expand-icon</code> or <code>collapse-icon</code> slot of every tree item that has none of its own (its clone carries a <code>data-default</code> attribute).</p>`,
      })}

      <h2 id="keyboard">Keyboard</h2>
      <p>As in Shoelace, the tree is one tab stop: focusing it moves focus to the last focused item (or the first). <kbd>Down</kbd> and <kbd>Up</kbd> move to the next or previous focusable item (disabled items, and the items inside a collapsed parent, are skipped; the movement stops at the ends); <kbd>Home</kbd> and <kbd>End</kbd> go to the first or last one; <kbd>Right</kbd> expands a collapsed item that can expand, and otherwise moves like <kbd>Down</kbd>; <kbd>Left</kbd> collapses an expanded item, and otherwise moves like <kbd>Up</kbd> (the two arrows swap in right-to-left text); <kbd>Enter</kbd> and <kbd>Space</kbd> select the focused item (or, in leaf mode, toggle a branch). Keys pressed while focus is in an <code>input</code> or <code>textarea</code> inside an item are left alone.</p>

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

export default TreePage;
