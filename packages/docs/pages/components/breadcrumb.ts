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
  seoTitle: 'Breadcrumb - Velcro',
  seoHead: themeHead + '<meta name="description" content="Velcro breadcrumb (prototype).">',
}));

// Shoelace's examples, in the order of its page: [id, heading, text, example key, React example key]. The first has no
// heading in Shoelace's page (it is the page's opening example); the last is the second preview of Shoelace's "With
// Dropdowns" section, so it has no heading of its own either.
const sections = [
  ['basic', 'Default', null, 'breadcrumb/basic', 'breadcrumb/react/basic'],
  ['links', 'Breadcrumb Links', html`By default, breadcrumb items are rendered as buttons so you can use them to navigate single-page applications. In this case, you'll need to add event listeners to handle clicks. For websites, you'll probably want to use links instead. You can make any breadcrumb item a link by applying an <code>href</code> attribute to it. Now, when the user activates it, they'll be taken to the corresponding page — no event listeners required.`, 'breadcrumb/links', 'breadcrumb/react/links'],
  ['separators', 'Custom Separators', html`Use the <code>separator</code> slot to change the separator that goes between breadcrumb items. Icons work well, but you can also use text or an image.`, 'breadcrumb/separators', 'breadcrumb/react/separators'],
  ['prefixes', 'Prefixes', html`Use the <code>prefix</code> slot to add content before any breadcrumb item.`, 'breadcrumb/prefixes', 'breadcrumb/react/prefixes'],
  ['suffixes', 'Suffixes', html`Use the <code>suffix</code> slot to add content after any breadcrumb item.`, 'breadcrumb/suffixes', 'breadcrumb/react/suffixes'],
  ['dropdowns', 'With Dropdowns', html`Dropdown menus can be placed in the default slot to provide additional options.`, 'breadcrumb/dropdowns', 'breadcrumb/react/dropdowns'],
  ['dropdowns-suffix', 'With Dropdowns: in a suffix', html`Alternatively, you can place dropdown menus in a prefix or suffix slot.`, 'breadcrumb/dropdowns-suffix', 'breadcrumb/react/dropdowns-suffix'],
] as const;
const untitled = new Set<string>(['basic', 'dropdowns-suffix']);
const withPanel = new Set<string>(['dropdowns', 'dropdowns-suffix']);

// Shoelace 2.20.1 behaviors that look like bugs but are matched exactly (candidates for a later opt-in fix). One line each.
const quirks = [
  'The label defaults to an empty string and is always rendered, so without a label the <nav> has aria-label="" and no accessible name.',
  'Only the first element in the separator slot is used. It is cloned into each item\'s light DOM (with its ids removed, slot="separator" and a data-default marker), and the clones are made again only when the default slot changes or the direction changes: replacing the separator slot\'s content later leaves the items\' old separators in place.',
  'aria-current="page" is set on the last sl-breadcrumb-item element itself, not on the link or button inside it, and only sl-breadcrumb-item children count: any other child gets no separator and is never the current page.',
  'The breadcrumb host has no display rule of its own, so it is an inline box around its flex <nav>.',
] as const;

const gaps = [
  'All of Shoelace\'s examples are ported with a live preview and a React version, in Shoelace\'s order. The dropdown examples use Velcro\'s sl-dropdown, sl-button, sl-menu and sl-menu-item, which have their own pages; their previews get a page-local style, outside the source shown here, that leaves room for the open panel. The React examples import Velcro\'s generated wrappers (@charm-ux/velcro/react/VelcroBreadcrumb.js, VelcroBreadcrumbItem.js and, where used, VelcroIcon.js, VelcroButton.js, VelcroDropdown.js, VelcroMenu.js and VelcroMenuItem.js) under Shoelace\'s names, and the Custom Separators one imports @charm-ux/velcro/icon where Shoelace imports its icon module; nothing else differs. As in Shoelace, the React version of With Dropdowns places the dropdown in the item\'s suffix slot, while its HTML version places it in the default slot.',
  'Velcro builds sl-breadcrumb on the @charm-ux/core base element, not on core\'s breadcrumb: core\'s breadcrumb defaults its label to "breadcrumb", wraps the items in a role="list" element and marks the last item through its own item properties, a different model from Shoelace\'s cloned separators and aria-current. The only core extension that remains is the non-bubbling ready event on first update, which the API tables label as inherited from core. Core\'s base styles are replaced by Shoelace\'s.',
  'As in Shoelace, sl-breadcrumb-item is a separate component: the breadcrumb entry (@charm-ux/velcro/breadcrumb) registers sl-breadcrumb and its separator icon sl-icon only. Import @charm-ux/velcro/breadcrumb-item (or the package root) for the items.',
  'The label is not localized: Shoelace 2.20.1 has no translation term for breadcrumbs, and the label is passed to aria-label as given. The localization controller is kept only so that a change of the document\'s direction regenerates the separators.',
  'The public defaultSlot and separatorSlot fields exist as in Shoelace; the API tables below list them without a description, as Shoelace\'s manifest does.',
  'dir and lang are declared as Shoelace\'s base element declares them: reactive, not reflected and undefined until set. Core\'s computed dir is not used. TypeScript types for dir are narrower than Shoelace\'s dir: string: at runtime dir is stored and returned as set and the setter accepts any string, but the read type stays core\'s \'ltr\' | \'rtl\' | \'auto\', because a subclass cannot widen an inherited getter\'s type. Fixing this needs a change in @charm-ux/core and is deferred.',
  'The product test suite is configured for Chromium, Firefox and WebKit; this component\'s spec was run locally in Chromium and WebKit only, and Firefox is covered only by the project\'s CI run. Shoelace\'s own breadcrumb test (8 tests, including its axe accessibility checks) runs in Chromium only and passes. The accessibility-tree check is Playwright\'s ARIA snapshot, which Playwright computes from the DOM; no screen reader and no browser accessibility API was tried. The right-to-left separator is checked; there is no touch check and no pixel comparison with Shoelace.',
  'Registration is browser-only and uses the native custom element registry for Velcro\'s own class, without changing the shared core prefix. Server-side rendering is not supported.',
  'The breadcrumb reads no theme tokens itself; its items and the default icon do (see the breadcrumb item page). Rendering under the dark theme has not been checked, and color contrast was not evaluated.',
];

@customElement('page-components-breadcrumb')
export class BreadcrumbPage extends LitElement {
  static override styles = [shellStyles];

  override render() {
    return docsShell('breadcrumb', html`
      <h1>Breadcrumb</h1>
      <p><code>&lt;sl-breadcrumb&gt;</code> is registered by <code>@charm-ux/velcro</code> on top of the <code>@charm-ux/core</code> base element. Prototype status: unreleased.</p>
      <p>Breadcrumbs provide a group of links so users can easily navigate a website's hierarchy.</p>
      <p>Breadcrumbs are usually placed before a page's main content with the current page shown last to indicate the user's position in the navigation. They are composed of <a href=${withBase('/components/breadcrumb-item')}>breadcrumb items</a>.</p>

      <h2 id="examples">Examples</h2>
      <p>Each preview runs in its own document. The React version of each example is Shoelace's, ported to Velcro's generated React wrappers; only its import lines differ. It is shown as source.</p>
      ${sections.map(
        ([id, title, text, key, react]) => html`
          ${untitled.has(id) ? '' : html`<h3 id=${id}>${title}</h3>`}
          ${text === null ? '' : html`<p>${text}</p>`}
          <iframe class="example" title=${`Breadcrumb example: ${title}`} srcdoc=${withPanel.has(id) ? withRoomForPanel(exampleDocument(examples[key])) : exampleDocument(examples[key])}></iframe>
          <pre><code>${examples[key]}</code></pre>
          <details class="react-example">
            <summary>React</summary>
            <pre><code>${reactExamples[react]}</code></pre>
          </details>
        `
      )}

      ${apiReference('sl-breadcrumb', {
        attributes: html`<p><code>label</code> is not reflected and defaults to an empty string, which is still rendered as the <code>&lt;nav&gt;</code>'s <code>aria-label</code>. <code>defaultSlot</code> and <code>separatorSlot</code> are queries for the two slots. <code>dir</code> and <code>lang</code> are reactive properties with no default that are not reflected, as in Shoelace's base element; a change of direction (on the breadcrumb or the document) regenerates the default separators with a chevron that points the other way.</p>`,
        events: html`<p>Shoelace's breadcrumb has no events. Inherited from core: a non-bubbling <code>ready</code> event on first update, which Shoelace does not have.</p>`,
        slots: html`<p>The default slot holds the breadcrumb items; each change of it clones the separator into every <code>sl-breadcrumb-item</code> (an item's own <code>slot="separator"</code> element, without <code>data-default</code>, is left alone) and sets <code>aria-current="page"</code> on the last one. The <code>separator</code> slot sits in a hidden, <code>aria-hidden</code> wrapper and is never displayed itself; without content it falls back to a system <code>chevron-right</code> icon (<code>chevron-left</code> in right-to-left).</p>`,
        parts: html`<p>The <code>base</code> part is the <code>&lt;nav&gt;</code>, a wrapping flex row with the items centered.</p>`,
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

export default BreadcrumbPage;
