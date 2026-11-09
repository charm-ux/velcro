import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { definePageData } from '@beatzball/litro';
import { docsShell, shellStyles } from '../../src/shell.js';
import { themeHead } from '../../src/theme.js';
import { apiReference } from '../../src/api.js';
import { examples, exampleDocument, reactExamples } from '../../src/example.js';

export const pageData = definePageData(async () => ({
  seoTitle: 'Menu Label - Velcro',
  seoHead: themeHead + '<meta name="description" content="Velcro menu label (prototype).">',
}));

const sections = [
  ['basic', 'Menu labels in a menu', 'menu-label/basic', 'Shoelace\'s example puts the labels in an sl-menu next to sl-menu-item elements and an sl-divider; here the menu and its items are Velcro\'s own.', 'menu-label/react/basic'],
] as const;

// Shoelace 2.20.1 behaviors that look like bugs but are matched exactly (candidates for a later opt-in fix). One line each.
const quirks = [
  'The hidden attribute does not hide the label: the host\'s own display: block outranks the browser\'s [hidden] rule, so it stays displayed. Core\'s own base styles would hide it, so they are replaced by Shoelace\'s.',
  'The label carries no role and no ARIA of its own, and nothing relates it to the items after it, so it is plain text in the accessibility tree. Adding a role or aria-label is up to the page.',
] as const;

const gaps = [
  'The example is Shoelace\'s, with live sl-menu and sl-menu-item elements. The React example imports Velcro\'s generated wrappers (@charm-ux/velcro/react/VelcroDivider.js, VelcroMenu.js, VelcroMenuLabel.js and VelcroMenuItem.js, imported under Shoelace\'s names); nothing else differs.',
  'Velcro builds on the @charm-ux/core base element (there is no core menu label). The only core extension that remains is the non-bubbling ready event on first update, which the API tables label as inherited from core. Core\'s base styles are replaced by Shoelace\'s (see the first quirk).',
  'dir and lang are declared as Shoelace\'s base element declares them: reactive, not reflected and undefined until set. Core\'s computed dir is not used.',
  'TypeScript types for dir are narrower than Shoelace\'s dir: string. At runtime dir is stored and returned as set, and the setter accepts any string, so element.dir = someString compiles (type-tests/menu-label-dir.tsx checks it). The read type stays core\'s \'ltr\' | \'rtl\' | \'auto\', because a subclass cannot widen an inherited getter\'s type, and everything generated from it follows: the manifest and the API table below, the React wrapper\'s dir prop, and the JSX dir and prop:dir types. Fixing this needs a change in @charm-ux/core and is deferred.',
  'The product test suite is configured for Chromium, Firefox and WebKit; this component\'s spec was run locally in Chromium and WebKit only, and Firefox is covered only by the project\'s CI run. Shoelace\'s own menu label test, including its axe accessibility check, runs in Chromium only and passes. The accessibility-tree check is Playwright\'s ARIA snapshot, which Playwright computes from the DOM; no screen reader and no browser accessibility API was tried, there is no RTL check, and there is no pixel comparison with Shoelace. In the live menu the label is checked for its position among the items, its start alignment and its plain-text accessibility-tree entry between the menu items.',
  'Registration is browser-only and uses the native custom element registry for Velcro\'s own class, without changing the shared core prefix. Server-side rendering is not supported.',
  'The label reads eight theme tokens (--sl-font-sans, --sl-font-size-small, --sl-font-weight-semibold, --sl-line-height-normal, --sl-letter-spacing-normal, --sl-color-neutral-500, --sl-spacing-2x-small and --sl-spacing-x-large); both Velcro themes define them. Without a theme the label has no font, color or padding of its own. Rendering under the dark theme has not been checked.',
];

@customElement('page-components-menu-label')
export class MenuLabelPage extends LitElement {
  static override styles = [shellStyles];

  override render() {
    return docsShell('menu-label', html`
      <h1>Menu Label</h1>
      <p><code>&lt;sl-menu-label&gt;</code> is registered by <code>@charm-ux/velcro</code> on top of the <code>@charm-ux/core</code> base element. Prototype status: unreleased.</p>
      <p>Menu labels are used to describe a group of menu items.</p>

      <h2 id="examples">Examples</h2>
      <p>Each preview runs in its own document. The React version of the example is Shoelace's, ported to Velcro's generated React wrappers; only its import lines differ. It is shown as source.</p>
      ${sections.map(
        ([id, title, key, text, react]) => html`
          <h3 id=${id}>${title}</h3>
          <p>${text}</p>
          <iframe class="example" title=${`Menu Label example: ${title}`} srcdoc=${exampleDocument(examples[key])}></iframe>
          <pre><code>${examples[key]}</code></pre>
          <details class="react-example">
            <summary>React</summary>
            <pre><code>${reactExamples[react]}</code></pre>
          </details>
        `
      )}

      ${apiReference('sl-menu-label', {
        attributes: html`<p>Shoelace's menu label has no attributes or properties of its own. <code>dir</code> and <code>lang</code> are reactive properties with no default that are not reflected, as in Shoelace's base element.</p>`,
        events: html`<p>Shoelace's menu label has no events. Inherited from core: a non-bubbling <code>ready</code> event on first update, which Shoelace does not have.</p>`,
        slots: html`<p>The default slot holds the label's text and carries the <code>base</code> part.</p>`,
        parts: html`<p>The <code>base</code> part is the slot element itself, as in Shoelace. It is <code>display: inline-block</code>, and carries the label's font, color, padding and <code>user-select: none</code>.</p>`,
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

export default MenuLabelPage;
