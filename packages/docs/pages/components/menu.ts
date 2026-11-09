import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { definePageData } from '@beatzball/litro';
import { docsShell, shellStyles } from '../../src/shell.js';
import { themeHead } from '../../src/theme.js';
import { withBase } from '../../src/base.js';
import { apiReference } from '../../src/api.js';
import { examples, exampleDocument, reactExamples } from '../../src/example.js';
import { withRoomForPanel } from '../../src/example-room.js';

export const pageData = definePageData(async () => ({
  seoTitle: 'Menu - Velcro',
  seoHead: themeHead + '<meta name="description" content="Velcro menu (prototype).">',
}));

// Shoelace's examples, in the order of its page: [id, title, text, example key, React example key]. The first has no heading in
// Shoelace's page; it is the page's opening example.
const sections = [
  ['basic', 'Default', null, 'menu/basic', 'menu/react/basic'],
  ['dropdowns', 'In Dropdowns', html`Menus work really well when used inside <a href=${withBase('/components/dropdown')}>dropdowns</a>.`, 'menu/dropdowns', 'menu/react/dropdowns'],
  ['submenus', 'Submenus', html`To create a submenu, nest an <code>&lt;sl-menu slot="submenu"&gt;</code> in any <a href=${withBase('/components/menu-item')}>menu item</a>.`, 'menu/submenus', 'menu/react/submenus'],
] as const;

// Shoelace 2.20.1 behaviors that look like bugs but are matched exactly (candidates for a later opt-in fix). One line each.
const quirks = [
  'Shoelace\'s page says menus support "type-to-select an option", but its menu has no such code: pressing a letter key does nothing. Only Enter, Space, the arrow keys, Home and End are handled.',
  'The menu sets role="menu" on itself every time it is connected, replacing any role the page gave it. Nothing sets aria-orientation or an accessible name.',
  'Any change of the slotted elements (an item added or removed, a label changed) resets the roving tab stop to the first item, so the item that had it loses it.',
  'Only elements whose tag is sl-menu-item or whose role is menuitem, menuitemcheckbox or menuitemradio are items, and elements with the inert attribute are skipped. A menuitemradio element is navigated to but a click on it is not handled, because the click handler only recognises menuitem and menuitemcheckbox.',
  'sl-select is emitted for a click on a loading item: the loading state does not suppress clicks, only disabled does. A click on an item in a submenu is handled only by the closest menu: the outer menu emits nothing of its own, and the inner menu\'s sl-select bubbles through it, so a listener on the outer menu sees one event whose detail is the nested item.',
  'The keys act on the tab-stop item, not on the focused one. Hovering an item focuses it but does not move the tab stop (only a mouse down does), so after hovering the third item, Enter or Space selects the item that holds the tab stop, and Down or Up moves from that item, not from the hovered one.',
  'Enter or Space with no current item (before any item has the tab stop) does nothing, and with a disabled current item the simulated click is suppressed by the item, so nothing is selected.',
] as const;

const gaps = [
  'All of Shoelace\'s examples (the opening one, In Dropdowns and Submenus) are ported with a live preview and a React version, in Shoelace\'s order. In Dropdowns uses Velcro\'s sl-dropdown and sl-button, which have their own page; the preview gets a page-local style, outside the source shown here, that leaves room for the open panel. The React examples import Velcro\'s generated wrappers (@charm-ux/velcro/react/VelcroMenu.js, VelcroMenuItem.js, VelcroDivider.js and, for In Dropdowns, VelcroButton.js and VelcroDropdown.js) under Shoelace\'s names; nothing else differs. The menu inside a dropdown is checked by the dropdown\'s own tests (arrow keys from the trigger, selection closing the panel).',
  'Velcro builds sl-menu on the @charm-ux/core base element, not on core\'s menu component: core\'s menu is a dropdown (a trigger, a popup, placement attributes and menu-show, menu-hide and menu-request-close events) that manages its items through marker attributes, which is a different model from Shoelace\'s always visible inline list with role="menu" and sl-select. The only core extension that remains is the non-bubbling ready event on first update, which the API tables label as inherited from core. Core\'s base styles are replaced by Shoelace\'s.',
  'As in Shoelace, sl-menu-item, sl-menu-label and sl-divider are separate components: the menu entry (@charm-ux/velcro/menu) registers only sl-menu. Import @charm-ux/velcro/menu-item (or the package root) for the items.',
  'The public defaultSlot field and the getAllItems(), getCurrentItem() and setCurrentItem() methods exist as in Shoelace, where the methods are marked internal; the API tables below list the ones the manifest includes, without a description.',
  'dir and lang are declared as Shoelace\'s base element declares them: reactive, not reflected and undefined until set. Core\'s computed dir is not used. TypeScript types for dir are narrower than Shoelace\'s dir: string: at runtime dir is stored and returned as set and the setter accepts any string, but the read type stays core\'s \'ltr\' | \'rtl\' | \'auto\', because a subclass cannot widen an inherited getter\'s type. Fixing this needs a change in @charm-ux/core and is deferred.',
  'The product test suite is configured for Chromium, Firefox and WebKit; this component\'s spec was run locally in Chromium and WebKit only, and Firefox is covered only by the project\'s CI run. Shoelace\'s own menu test (6 tests, including the submenu checkbox case) runs in Chromium only and passes. The accessibility-tree check is Playwright\'s ARIA snapshot, which Playwright computes from the DOM; no screen reader and no browser accessibility API was tried. There is no touch check, no right-to-left check and no pixel comparison with Shoelace.',
  'Registration is browser-only and uses the native custom element registry for Velcro\'s own class, without changing the shared core prefix. Server-side rendering is not supported.',
  'The menu reads these theme tokens: --sl-panel-background-color, --sl-panel-border-width, --sl-panel-border-color, --sl-border-radius-medium and --sl-spacing-x-small; both Velcro themes define them. Rendering under the dark theme has not been checked, and color contrast was not evaluated.',
];

@customElement('page-components-menu')
export class MenuPage extends LitElement {
  static override styles = [shellStyles];

  override render() {
    return docsShell('menu', html`
      <h1>Menu</h1>
      <p><code>&lt;sl-menu&gt;</code> is registered by <code>@charm-ux/velcro</code> on top of the <code>@charm-ux/core</code> base element. Prototype status: unreleased.</p>
      <p>Menus provide a list of options for the user to choose from.</p>
      <p>You can use <a href=${withBase('/components/menu-item')}>menu items</a>, <a href=${withBase('/components/menu-label')}>menu labels</a> and <a href=${withBase('/components/divider')}>dividers</a> to compose a menu. Menus support keyboard interactions (see below). Shoelace's page also promises type-to-select; its menu does not implement it, so neither does Velcro's (see the quirks).</p>
      <p><strong>Tip:</strong> menus are intended for system menus (dropdown menus, select menus, context menus, etc.). They should not be mistaken for navigation menus, which serve a different purpose and have a different semantic meaning. If you're building navigation, use <code>&lt;nav&gt;</code> and <code>&lt;a&gt;</code> elements instead.</p>

      <h2 id="examples">Examples</h2>
      <p>Each preview runs in its own document. The React version of each example is Shoelace's, ported to Velcro's generated React wrappers; only its import lines differ. It is shown as source.</p>
      ${sections.map(
        ([id, title, text, key, react]) => html`
          <h3 id=${id}>${title}</h3>
          ${text === null ? '' : html`<p>${text}</p>`}
          <iframe class="example" title=${`Menu example: ${title}`} srcdoc=${id === 'dropdowns' ? withRoomForPanel(exampleDocument(examples[key])) : exampleDocument(examples[key])}></iframe>
          <pre><code>${examples[key]}</code></pre>
          <details class="react-example">
            <summary>React</summary>
            <pre><code>${reactExamples[react]}</code></pre>
          </details>
          ${id === 'submenus' ? html`<p><strong>Warning:</strong> as a UX best practice, avoid using more than one level of submenus when possible.</p>` : ''}
        `
      )}

      ${apiReference('sl-menu', {
        attributes: html`<p>Shoelace's menu has no attributes or properties of its own besides the <code>defaultSlot</code> query. <code>dir</code> and <code>lang</code> are reactive properties with no default that are not reflected, as in Shoelace's base element.</p>`,
        methods: html`<p><code>getAllItems()</code> returns the slotted items (elements with the <code>sl-menu-item</code> tag or a menu item role, without <code>inert</code> ones), <code>getCurrentItem()</code> the one with <code>tabindex="0"</code>, and <code>setCurrentItem(item)</code> gives that item <code>tabindex="0"</code> and every other item <code>tabindex="-1"</code>; call it before focusing an item.</p>`,
        events: html`<p><code>sl-select</code> bubbles, is composed and is not cancelable; its <code>detail</code> is <code>{ item }</code>, the menu item that was clicked (or selected with <kbd>Enter</kbd> or <kbd>Space</kbd>). A checkbox item is toggled before the event is emitted. A click inside a submenu is handled only by the closest <code>sl-menu</code>. Inherited from core: a non-bubbling <code>ready</code> event on first update, which Shoelace does not have.</p>`,
        slots: html`<p>The default slot holds the menu's items, labels and dividers, and carries the click, key and mouse handlers.</p>`,
      })}

      <h2 id="keyboard">Keyboard</h2>
      <p>As in Shoelace, the keys act from the menu's current item, the one that holds the tab stop (<code>tabindex="0"</code>), which is not always the item that has focus. <kbd>Down</kbd> and <kbd>Up</kbd> move from the current item to the next or previous one, wrapping around, and focus it; <kbd>Home</kbd> and <kbd>End</kbd> go to the first or last item; <kbd>Enter</kbd> and <kbd>Space</kbd> click the current item, which selects it. Only one item is a tab stop at a time (roving tabindex). The tab stop moves when a key moves to another item and when an item is pressed with the pointer, but not when an item only gets focus (for example by hovering it or by a script). Opening and leaving a submenu is described on the <a href=${withBase('/components/menu-item')}>menu item</a> page.</p>

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

export default MenuPage;
