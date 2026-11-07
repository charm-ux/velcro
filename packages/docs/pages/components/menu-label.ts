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
  ['basic', 'Menu labels in a menu', 'menu-label/basic', 'Shoelace\'s example puts the labels in an sl-menu next to sl-menu-item elements and an sl-divider. Velcro has no menu or menu item yet, so the menu and its items here are plain styled elements; the labels and the divider are the real components.', 'menu-label/react/basic'],
] as const;

// Shoelace 2.20.1 behaviors that look like bugs but are matched exactly (candidates for a later opt-in fix). One line each.
const quirks = [
  'The hidden attribute does not hide the label: the host\'s own display: block outranks the browser\'s [hidden] rule, so it stays displayed. Core\'s own base styles would hide it, so they are replaced by Shoelace\'s.',
  'The label carries no role and no ARIA of its own, and nothing relates it to the items after it: a screen reader reads it as plain text. Adding a role or aria-label is up to the page.',
] as const;

const gaps = [
  'The Shoelace example uses sl-menu and sl-menu-item, which Velcro does not implement yet. The ported example uses plain styled elements for them, so there is no menu role, no keyboard navigation and no selection, and the Shoelace menu\'s own padding, border and item styling are only approximated. The React example is ported the same way: SlMenu and SlMenuItem are two small stand-in components defined at its top, and the imports of SlDivider and SlMenuLabel point at Velcro\'s generated wrappers (@charm-ux/velcro/react/VelcroDivider.js and VelcroMenuLabel.js, imported under Shoelace\'s names).',
  'Velcro builds on the @charm-ux/core base element (there is no core menu label). The only core extension that remains is the non-bubbling ready event on first update, which the API tables label as inherited from core. Core\'s base styles are replaced by Shoelace\'s (see the first quirk).',
  'dir and lang are declared as Shoelace\'s base element declares them: reactive, not reflected and undefined until set. Core\'s computed dir is not used.',
  'TypeScript types for dir are narrower than Shoelace\'s dir: string. At runtime dir is stored and returned as set, and the setter accepts any string, so element.dir = someString compiles (type-tests/menu-label-dir.tsx checks it). The read type stays core\'s \'ltr\' | \'rtl\' | \'auto\', because a subclass cannot widen an inherited getter\'s type, and everything generated from it follows: the manifest and the API table below, the React wrapper\'s dir prop, and the JSX dir and prop:dir types. Fixing this needs a change in @charm-ux/core and is deferred.',
  'The element is checked by product tests in Chromium, Firefox and WebKit, and in Chromium by Shoelace\'s accessibility test, which passes. There is no RTL or screen reader check, no check inside a real menu, and no pixel comparison with Shoelace.',
  'Registration is browser-only and uses the native custom element registry for Velcro\'s own class, without changing the shared core prefix. Server-side rendering is not supported.',
  'The label reads eight theme tokens (--sl-font-sans, --sl-font-size-small, --sl-font-weight-semibold, --sl-line-height-normal, --sl-letter-spacing-normal, --sl-color-neutral-500, --sl-spacing-2x-small and --sl-spacing-x-large); both Velcro themes define them. Without a theme the label has no font, color or padding of its own. The example\'s appearance under the dark theme has not been checked beyond the label\'s color token.',
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
      <p>Each preview runs in its own document. The React version of the example is Shoelace's, ported to Velcro's generated React wrappers; only its import lines and the two stand-in components differ. It is shown as source.</p>
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
