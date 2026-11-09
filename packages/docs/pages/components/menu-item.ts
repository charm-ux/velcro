import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { definePageData } from '@beatzball/litro';
import { docsShell, shellStyles } from '../../src/shell.js';
import { themeHead } from '../../src/theme.js';
import { withBase } from '../../src/base.js';
import { apiReference } from '../../src/api.js';
import { examples, exampleDocument, reactExamples } from '../../src/example.js';

export const pageData = definePageData(async () => ({
  seoTitle: 'Menu Item - Velcro',
  seoHead: themeHead + '<meta name="description" content="Velcro menu item (prototype).">',
}));

// Shoelace's examples, in the order of its page: [id, title, text, example key, React example key]. The first has no heading in
// Shoelace's page; it is the page's opening example. Every example is live and has a React version.
const sections = [
  ['basic', 'Default', null, 'menu-item/basic', 'menu-item/react/basic'],
  ['prefix-suffix', 'Prefix & Suffix', html`Add content to the start and end of menu items using the <code>prefix</code> and <code>suffix</code> slots.`, 'menu-item/prefix-suffix', 'menu-item/react/prefix-suffix'],
  ['disabled', 'Disabled', html`Add the <code>disabled</code> attribute to disable the menu item so it cannot be selected.`, 'menu-item/disabled', 'menu-item/react/disabled'],
  ['loading', 'Loading', html`Use the <code>loading</code> attribute to indicate that a menu item is busy. Shoelace's page adds that, like a disabled menu item, clicks will be suppressed until the loading state is removed; its code does not do that, and neither does Velcro's (see the quirks).`, 'menu-item/loading', 'menu-item/react/loading'],
  ['checkbox', 'Checkbox Menu Items', html`Set the <code>type</code> attribute to <code>checkbox</code> to create a menu item that will toggle on and off when selected. You can use the <code>checked</code> attribute to set the initial state.<br><br>Checkbox menu items are visually indistinguishable from regular menu items. Their ability to be toggled is primarily inferred from context, much like you'd find in the menu of a native app.`, 'menu-item/checkbox', 'menu-item/react/checkbox'],
  ['value-selection', 'Value & Selection', html`The <code>value</code> attribute can be used to assign a hidden value, such as a unique identifier, to a menu item. When an item is selected, the <code>sl-select</code> event will be emitted and a reference to the item will be available at <code>event.detail.item</code>. You can use this reference to access the selected item's value, its checked state, and more. The preview logs the selected value to its console.`, 'menu-item/value-selection', 'menu-item/react/value-selection'],
] as const;

// Shoelace 2.20.1 behaviors that look like bugs but are matched exactly (candidates for a later opt-in fix). One line each.
const quirks = [
  'A loading item still emits click and, inside an sl-menu, sl-select: only disabled suppresses clicks, although the code comment and Shoelace\'s page say loading does too. The spinner and the dimmed content are the only effect.',
  'checked on an item whose type is not checkbox is set back to false and logged with console.error (the message says the checked attribute can only be used on menu items with type checkbox). Shoelace\'s own React Value & Selection example trips this on every selection (its handler sets item.checked on plain items), and it is ported unchanged. The check runs when checked changes, not when type does: changing a checked item\'s type to normal drops aria-checked and the checkbox role but leaves checked true, and the item is still drawn with its check mark.',
  'aria-haspopup and aria-expanded are boolean attributes: an item with a submenu has aria-haspopup="" and, while the submenu is open, aria-expanded="" (an empty value), and they are absent otherwise. ARIA does not read an empty value as true, so assistive technology is not told that a submenu exists or is open.',
  'aria-disabled is written on every item ("false" when it is not disabled), and a checkbox item always carries aria-checked; both are set by the element on its first update and whenever the property changes, replacing what the page wrote.',
  'The text label counts only text nodes of the default slot: an item whose label sits in an element (<span>Menu item</span>) has an empty getTextLabel(), and the slotchange event for a label change is emitted only when that text changes. The event bubbles but is not composed.',
  'Hovering an item focuses it (the item calls focus() on mouseover and stops the event), but that does not move the menu\'s tab stop, which only moves on a mouse down or with the arrow keys; the menu\'s keys keep acting from the tab-stop item (see the menu page).',
  'In a submenu, the click handler compares the click target\'s tagName with the lower-case "sl-menu-item", which never matches (tag names are upper case in HTML); only the role check can close the submenu after a click on a nested item.',
  'The submenu-icon part is described as "not yet implemented", although the chevron it names is rendered and shown for items with a submenu. The description is kept as Shoelace words it.',
] as const;

const gaps = [
  'All six of Shoelace\'s examples (the opening one, Prefix & Suffix, Disabled, Loading, Checkbox Menu Items and Value & Selection) are ported with a live preview and a React version, in Shoelace\'s order. The React examples import Velcro\'s generated wrappers (VelcroMenu.js, VelcroMenuItem.js, VelcroDivider.js, VelcroIcon.js and VelcroBadge.js under @charm-ux/velcro/react/) under Shoelace\'s names. Only the import lines differ. Shoelace\'s React Value & Selection handler sets item.checked = !item.checked on plain items; it is ported unchanged, so every selection in that example logs the error described in the quirks and leaves the item unchecked.',
  'Velcro builds sl-menu-item on the @charm-ux/core base element, not on core\'s menu item component: core\'s item renders its own link or span with a role property, href, current, expanded and sub-menu-placement attributes and marker-attribute submenus, which conflicts with Shoelace\'s type, checked, value and loading model. The only core extension that remains is the non-bubbling ready event on first update, which the API tables label as inherited from core. Core\'s base styles are replaced by Shoelace\'s.',
  'The item renders sl-icon (the check mark and the submenu chevron), sl-popup (a submenu) and sl-spinner (loading), as in Shoelace. Constructing a menu item defines Velcro\'s sl-icon, sl-popup and sl-spinner when they are not defined yet. If another constructor already owns one of those tags, the item renders that element and, as in Shoelace, logs a console warning when the two versions differ (Velcro\'s classes declare no version, so the warning appears only when the other constructor declares one, such as a Shoelace element); if the platform refuses a Velcro class because it is already registered under another tag, an anonymous subclass is defined, as in Shoelace. The class-only entry (@charm-ux/velcro/menu-item/class) registers nothing itself, so this constructor path is all it has. The registering entry (@charm-ux/velcro/menu-item or the package root) registers sl-icon, sl-popup and sl-spinner up front, when it is imported rather than when an item is first constructed, with the same handling: an existing owner of a tag is left in place, and importing never throws on a tag clash. As in Shoelace, sl-menu is a separate component: the menu item entry does not register it, and the keyboard and sl-select handling lives in the menu.',  'Submenus are checked in Chromium: they open to the right of the item after a short delay on hover, and at once with Right, Enter or Space, which also focuses the first nested item; Left, Escape and Tab close them. The safe triangle that keeps a submenu open while the pointer moves toward it, the repositioning near the viewport edge and right-to-left submenus are not checked, and there is no touch check.',
  'The public defaultSlot and menuItem fields and the handleCheckedChange(), handleDisabledChange(), handleTypeChange() and isSubmenu() methods exist as in Shoelace, where they are public but undocumented; the API tables below list them without a description.',
  'dir and lang are declared as Shoelace\'s base element declares them: reactive, not reflected and undefined until set. Core\'s computed dir is not used. TypeScript types for dir are narrower than Shoelace\'s dir: string: at runtime dir is stored and returned as set and the setter accepts any string, but the read type stays core\'s \'ltr\' | \'rtl\' | \'auto\', because a subclass cannot widen an inherited getter\'s type. Fixing this needs a change in @charm-ux/core and is deferred. The chevron follows the item\'s own dir (attribute or property), else the document\'s dir, as in Shoelace.',
  'The product test suite is configured for Chromium, Firefox and WebKit; this component\'s spec was run locally in Chromium and WebKit only, and Firefox is covered only by the project\'s CI run. Shoelace\'s own menu item test (12 tests, including two axe accessibility checks) runs in Chromium only and passes. The accessibility-tree check is Playwright\'s ARIA snapshot, which Playwright computes from the DOM; no screen reader and no browser accessibility API was tried, and there is no pixel comparison with Shoelace.',
  'Registration is browser-only and uses the native custom element registry for Velcro\'s own class, without changing the shared core prefix. Server-side rendering is not supported.',
  'The item reads many theme tokens (the --sl-font-*, --sl-color-neutral-*, --sl-color-primary-600, --sl-spacing-*, --sl-shadow-large, --sl-z-index-dropdown and --sl-transition-fast families); both Velcro themes define them. Rendering under the dark theme has not been checked, and color contrast was not evaluated.',
];

@customElement('page-components-menu-item')
export class MenuItemPage extends LitElement {
  static override styles = [shellStyles];

  override render() {
    return docsShell('menu-item', html`
      <h1>Menu Item</h1>
      <p><code>&lt;sl-menu-item&gt;</code> is registered by <code>@charm-ux/velcro</code> on top of the <code>@charm-ux/core</code> base element. Prototype status: unreleased.</p>
      <p>Menu items provide options for the user to pick from in a <a href=${withBase('/components/menu')}>menu</a>.</p>

      <h2 id="examples">Examples</h2>
      <p>Each preview runs in its own document. The React version of each example is Shoelace's, ported to Velcro's generated React wrappers; only its import lines differ. It is shown as source.</p>
      ${sections.map(
        ([id, title, text, key, react]) => html`
          <h3 id=${id}>${title}</h3>
          ${text === null ? '' : html`<p>${text}</p>`}
          <iframe class="example" title=${`Menu Item example: ${title}`} srcdoc=${exampleDocument(examples[key])}></iframe>
          <pre><code>${examples[key]}</code></pre>
          <details class="react-example">
            <summary>React</summary>
            <pre><code>${reactExamples[react]}</code></pre>
          </details>
        `
      )}

      ${apiReference('sl-menu-item', {
        attributes: html`<p><code>checked</code>, <code>loading</code> and <code>disabled</code> reflect; removing one of those attributes sets the property to <code>false</code>. (Shoelace's base element also keeps each reflected property's first recorded value and puts it back when an attribute is removed; Velcro has the same mechanism, but for these three properties the recorded value is the one just reflected and a removed boolean attribute already reads as false, so the result is <code>false</code>.) <code>type</code> and <code>value</code> do not reflect. <code>dir</code> and <code>lang</code> are reactive properties with no default that are not reflected.</p>`,
        methods: html`<p><code>getTextLabel()</code> returns the text nodes of the default slot, concatenated. <code>isSubmenu()</code> is true when something is slotted into <code>submenu</code>.</p>`,
        events: html`<p>Shoelace's menu item has no events of its own; the <code>sl-select</code> event belongs to <a href=${withBase('/components/menu')}>the menu</a>. A change of the item's label text emits a bubbling, non-composed <code>slotchange</code> event from the item, so parent controls see it. Inherited from core: a non-bubbling <code>ready</code> event on first update, which Shoelace does not have.</p>`,
        slots: html`<p>The default slot is the label, <code>submenu</code> holds a nested <code>sl-menu</code>. When a submenu is present the item renders it in an <code>sl-popup</code> that opens to the right (to the left in right-to-left text), anchored to the item.</p>`,
      })}

      <h2 id="keyboard">Keyboard and submenus</h2>
      <p>As in Shoelace: on an item with a submenu, <kbd>Right</kbd>, <kbd>Enter</kbd> and <kbd>Space</kbd> open the submenu at once and move focus to its first item. <kbd>Left</kbd> on a nested item returns focus to the parent item and closes the submenu; <kbd>Escape</kbd> and <kbd>Tab</kbd> close it, and so does focus leaving the item and its submenu. Hovering the parent opens the submenu after 100 ms. Clicking the parent item itself does nothing.</p>

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

export default MenuItemPage;
