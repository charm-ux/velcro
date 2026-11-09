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
  seoTitle: 'Dropdown - Velcro',
  seoHead: themeHead + '<meta name="description" content="Velcro dropdown (prototype).">',
}));

// Shoelace's examples, in the order of its page: [id, heading, label, text, example key, React example key]. The first has no
// heading in Shoelace's page; it is the page's opening example. The second of "Getting the Selected Item" has no heading either:
// Shoelace continues the section with "Alternatively, ..." and a second example. The label names the example's preview.
const sections = [
  ['basic', null, 'Default', null, 'dropdown/basic', 'dropdown/react/basic'],
  ['selection', 'Getting the Selected Item', 'Getting the Selected Item', html`When dropdowns are used with <a href=${withBase('/components/menu')}>menus</a>, you can listen for the <a href=${withBase('/components/menu#events')}><code>sl-select</code></a> event to determine which menu item was selected. The menu item element will be exposed in <code>event.detail.item</code>. You can set <code>value</code> props to make it easier to identify commands.`, 'dropdown/selection', 'dropdown/react/selection'],
  ['selection-click', null, 'Getting the Selected Item (click listeners)', html`Alternatively, you can listen for the <code>click</code> event on individual menu items. Note that, using this approach, disabled menu items will still emit a <code>click</code> event.`, 'dropdown/selection-click', 'dropdown/react/selection-click'],
  ['placement', 'Placement', 'Placement', html`The preferred placement of the dropdown can be set with the <code>placement</code> attribute. Note that the actual position may vary to ensure the panel remains in the viewport.`, 'dropdown/placement', 'dropdown/react/placement'],
  ['distance', 'Distance', 'Distance', html`The distance from the panel to the trigger can be customized using the <code>distance</code> attribute. This value is specified in pixels.`, 'dropdown/distance', 'dropdown/react/distance'],
  ['skidding', 'Skidding', 'Skidding', html`The offset of the panel along the trigger can be customized using the <code>skidding</code> attribute. This value is specified in pixels.`, 'dropdown/skidding', 'dropdown/react/skidding'],
  ['submenus', 'Submenus', 'Submenus', html`To create a submenu, nest an <code>&lt;sl-menu slot="submenu"&gt;</code> element in a <a href=${withBase('/components/menu-item')}>menu item</a>.`, 'dropdown/submenus', 'dropdown/react/submenus'],
  ['hoisting', 'Hoisting', 'Hoisting', html`Dropdown panels will be clipped if they're inside a container that has <code>overflow: auto|hidden</code>. The <code>hoist</code> attribute forces the panel to use a fixed positioning strategy, allowing it to break out of the container. In this case, the panel will be positioned relative to its <a href="https://developer.mozilla.org/en-US/docs/Web/CSS/Containing_block#Identifying_the_containing_block">containing block</a>, which is usually the viewport unless an ancestor uses a <code>transform</code>, <code>perspective</code>, or <code>filter</code>. <a href="https://developer.mozilla.org/en-US/docs/Web/CSS/position#fixed">Refer to this page</a> for more details.`, 'dropdown/hoisting', 'dropdown/react/hoisting'],
] as const;

// Shoelace 2.20.1 behaviors that look like bugs but are matched exactly (candidates for a later opt-in fix). One line each.
const quirks = [
  'A dropdown that is disabled cannot be opened: setting open (or calling show()) sets it back to false on the next update and emits nothing. Disabling a dropdown that is already open does not close it.',
  'aria-haspopup="true" and aria-expanded are written on the "accessible trigger", the first slotted element that has a tabbable element in or below it: for an sl-button or sl-icon-button, the inner <button> in its shadow root; for anything else, the element itself. The slotted element is left alone, a trigger with nothing tabbable gets nothing, and the attributes are refreshed when the trigger slot changes and when open changes.',
  'The panel wrapper is aria-hidden while the dropdown is closed and has aria-labelledby="dropdown", which names the inner sl-popup (it has no accessible name), not the trigger. Nothing links the trigger to the panel with aria-controls.',
  'Only a menu that is a direct child of the dropdown (an element assigned to its default slot) is found by getMenu(): the arrow, Home and End keys on the trigger do nothing for a menu wrapped in another element. The dropdown closes on sl-select only when the event\'s target is an sl-menu.',
  'Clicking an open dropdown\'s trigger hides it without moving the focus; showing it focuses the first slotted trigger element. Enter and Space on the trigger are intercepted on keydown (default prevented), so the trigger\'s own click is not fired by the keyboard; Space\'s keyup is cancelled too, for Firefox.',
  'Arrow Down, Arrow Up, Home and End on the trigger open the panel only when a menu is found, and then focus the first item (Down, Home) or the last one (Up, End) after the next update, not after the animation. A menu with no items is opened but nothing is focused.',
  'Tab pressed while an sl-menu-item has the focus closes the dropdown, cancels the Tab and focuses the trigger. Tab pressed anywhere else closes it from a zero-delay timeout when the focus is no longer inside the containing element.',
  'Showing the dropdown again while it is still closing leaves open true with the panel hidden: the closing handler finishes after the opening one has started, and hides the panel and deactivates the popup, so sl-after-hide arrives before sl-after-show and nothing is visible until open changes again.',
  'Removing an open dropdown from the document closes it: open is set to false and sl-hide and sl-after-hide are emitted on the detached element. Putting it back leaves it closed.',
  'Changing containingElement to nothing while open stops an outside mousedown from closing the dropdown, because the check is skipped when there is no containing element.',
] as const;

const gaps = [
  'Velcro builds sl-dropdown on the @charm-ux/core base element: core has no dropdown, and core\'s menu component (a trigger slot, a popup, menu-show and menu-hide events) is a different model, so it is not used. The only core extension that remains is the non-bubbling ready event on first update, which the API tables label as inherited from core. Core\'s base styles are replaced by Shoelace\'s.',
  'As in Shoelace, the trigger and the menu are separate components: the dropdown entry (@charm-ux/velcro/dropdown) registers sl-dropdown and its dependency sl-popup. Import @charm-ux/velcro/button, @charm-ux/velcro/menu and @charm-ux/velcro/menu-item (or the package root) for the usual content. The React examples import Velcro\'s generated wrappers (@charm-ux/velcro/react/VelcroDropdown.js, VelcroButton.js, VelcroMenu.js, VelcroMenuItem.js, VelcroDivider.js and VelcroIcon.js) under Shoelace\'s names; nothing else differs, except that the hoisting example adds position: relative to its class, as Shoelace\'s HTML example has and its React snippet lacks.',
  'Each preview runs in an iframe that is as tall as its content, so the page gives every preview a body with room for the open panel, with the trigger at its top (at its bottom in the Placement example, whose panel opens above it); the style is added by this page, outside the source shown here; Shoelace\'s own page opens the panel in the page. The previews were not checked for how they look in the dark theme.',
  'The public popup, trigger and panel fields and the handleOpenChange(), handleTriggerClick(), handleTriggerKeyDown(), handleTriggerKeyUp(), handleTriggerSlotChange(), updateAccessibleTrigger(), addOpenListeners(), removeOpenListeners(), focusOnTrigger() and getMenu() methods exist as in Shoelace; the API tables below list the ones the manifest includes, without a description.',
  'dir and lang are declared as Shoelace\'s base element declares them: reactive, not reflected and undefined until set. Core\'s computed dir is not used. TypeScript types for dir are narrower than Shoelace\'s dir: string: at runtime dir is stored and returned as set and the setter accepts any string, but the read type stays core\'s \'ltr\' | \'rtl\' | \'auto\', because a subclass cannot widen an inherited getter\'s type. Fixing this needs a change in @charm-ux/core and is deferred. The animations\' direction follows the host\'s dir, else the document\'s, as Shoelace\'s localization controller resolves it; no right-to-left check was made.',
  'The product test suite is configured for Chromium, Firefox and WebKit; this component\'s spec was run locally in Chromium and WebKit only, and Firefox is covered only by the project\'s CI run. Shoelace\'s own dropdown test (19 tests) runs in Chromium only and passes. The accessibility-tree check is Playwright\'s ARIA snapshot, which Playwright computes from the DOM; no screen reader and no browser accessibility API was tried. There is no touch check and no pixel comparison with Shoelace, and color contrast was not evaluated.',
  'Registration is browser-only and uses the native custom element registry for Velcro\'s own class, without changing the shared core prefix. Server-side rendering is not supported.',
  'The dropdown reads these theme tokens: --sl-z-index-dropdown, --sl-font-sans, --sl-font-size-medium, --sl-font-weight-normal, --sl-shadow-large and --sl-border-radius-medium; both Velcro themes define them.',
];

@customElement('page-components-dropdown')
export class DropdownPage extends LitElement {
  static override styles = [shellStyles];

  override render() {
    return docsShell('dropdown', html`
      <h1>Dropdown</h1>
      <p><code>&lt;sl-dropdown&gt;</code> is registered by <code>@charm-ux/velcro</code> on top of the <code>@charm-ux/core</code> base element. Prototype status: unreleased.</p>
      <p>Dropdowns expose additional content that "drops down" in a panel.</p>
      <p>Dropdowns consist of a trigger and a panel. By default, activating the trigger will expose the panel and interacting outside of the panel will close it.</p>
      <p>Dropdowns are designed to work well with <a href=${withBase('/components/menu')}>menus</a> to provide a list of options the user can select from. However, dropdowns can also be used in lower-level applications (e.g. a color picker). The API gives you complete control over showing, hiding, and positioning the panel.</p>

      <h2 id="examples">Examples</h2>
      <p>Each preview runs in its own document, so its script uses plain <code>document.querySelector</code>. The React version of each example is Shoelace's, ported to Velcro's generated React wrappers; only its import lines differ (see below). It is shown as source.</p>
      ${sections.map(
        ([id, heading, label, text, key, react]) => html`
          ${heading === null ? '' : html`<h3 id=${id}>${heading}</h3>`}
          ${text === null ? '' : html`<p>${text}</p>`}
          <iframe class="example" title=${`Dropdown example: ${label}`} srcdoc=${withRoomForPanel(exampleDocument(examples[key]), id === 'placement' ? 'bottom' : 'top')}></iframe>
          <pre><code>${examples[key]}</code></pre>
          <details class="react-example">
            <summary>React</summary>
            <pre><code>${reactExamples[react]}</code></pre>
          </details>
          ${id === 'submenus' ? html`<p><strong>Warning:</strong> as a UX best practice, avoid using more than one level of submenu when possible.</p>` : ''}
        `
      )}

      ${apiReference('sl-dropdown', {
        attributes: html`<p><code>open</code>, <code>placement</code>, <code>disabled</code>, <code>stay-open-on-select</code> and <code>sync</code> are reflected; <code>distance</code>, <code>skidding</code> and <code>hoist</code> are attributes that are not reflected, and <code>containingElement</code> is a property only (it defaults to the dropdown itself when the dropdown is connected without one). Removing a reflected attribute restores the property's initial value, as in Shoelace. <code>dir</code> and <code>lang</code> are reactive properties with no default that are not reflected, as in Shoelace's base element.</p>`,
        methods: html`<p><code>show()</code> and <code>hide()</code> return a promise that resolves when <code>sl-after-show</code> or <code>sl-after-hide</code> is emitted, or a promise that resolves to <code>undefined</code> at once when the dropdown is already in that state. <code>reposition()</code> recomputes the panel's position.</p>`,
        events: html`<p>The four events bubble, are composed, are not cancelable and carry an empty <code>detail</code>. <code>sl-show</code> and <code>sl-hide</code> are emitted as the dropdown starts opening or closing, and <code>sl-after-show</code> and <code>sl-after-hide</code> after the animation. A dropdown that is already open when it first renders emits none of them. Inherited from core: a non-bubbling <code>ready</code> event on first update, which Shoelace does not have.</p>`,
        slots: html`<p>The default slot holds the panel's content (usually an <a href=${withBase('/components/menu')}><code>sl-menu</code></a>); the <code>trigger</code> slot holds the element that opens it, usually an <a href=${withBase('/components/button')}><code>sl-button</code></a>.</p>`,
        parts: html`<p><code>base</code> is the <code>sl-popup</code> element, and <code>base__popup</code> is that popup's own <code>popup</code> part.</p>`,
      })}

      <h2 id="animations">Animations</h2>
      <p>The panel opens and closes with the <code>dropdown.show</code> and <code>dropdown.hide</code> animations (100 ms, scaling from 0.9 and fading), which come from the animation registry: change them for every dropdown with <code>setDefaultAnimation()</code> or for one element with <code>setAnimation()</code>, both from <code>@charm-ux/velcro/utilities/animation-registry</code>.</p>

      <h2 id="keyboard">Keyboard</h2>
      <p>On the trigger, <kbd>Enter</kbd> and <kbd>Space</kbd> toggle the panel without moving the focus into it, so pressing the same key again closes it. When the panel holds an <code>sl-menu</code>, <kbd>Down</kbd> and <kbd>Home</kbd> open the panel and focus its first item, and <kbd>Up</kbd> and <kbd>End</kbd> focus the last one; the menu then handles its own keys (see the <a href=${withBase('/components/menu')}>menu</a>). <kbd>Escape</kbd> closes an open panel and returns the focus to the trigger, from the trigger or from inside the menu (where the browser has the CloseWatcher API, as Chromium does, that watcher closes it; elsewhere the panel's and the document's keydown handlers do). <kbd>Tab</kbd> from a menu item closes the panel and returns the focus to the trigger; <kbd>Tab</kbd> from elsewhere closes it when the focus leaves the dropdown. Selecting a menu item closes the panel and focuses the trigger, unless <code>stay-open-on-select</code> is set. Clicking or pressing outside the dropdown closes it.</p>

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

export default DropdownPage;
