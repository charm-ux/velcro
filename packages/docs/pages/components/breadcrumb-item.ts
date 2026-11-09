import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { definePageData } from '@beatzball/litro';
import { docsShell, shellStyles } from '../../src/shell.js';
import { themeHead } from '../../src/theme.js';
import { withBase } from '../../src/base.js';
import { apiReference } from '../../src/api.js';
import { examples, exampleDocument, reactExamples } from '../../src/example.js';

export const pageData = definePageData(async () => ({
  seoTitle: 'Breadcrumb Item - Velcro',
  seoHead: themeHead + '<meta name="description" content="Velcro breadcrumb item (prototype).">',
}));

// Shoelace's page has one example, without a heading: [id, heading, example key, React example key].
const sections = [
  ['basic', 'Default', 'breadcrumb-item/basic', 'breadcrumb-item/react/basic'],
] as const;

// Shoelace 2.20.1 behaviors that look like bugs but are matched exactly (candidates for a later opt-in fix). One line each.
const quirks = [
  'The label element is chosen when the default slot reports a change or when href changes after the first render, so an item that has href from the start renders a button until its label\'s slotchange arrives, and an item with href but no label content stays a button.',
  'The link gets target and rel only when target is set: without a target, the link has no rel attribute, and rel (default "noreferrer noopener") is ignored.',
  'The prefix and suffix containers\' rule declares display: none and then display: flex, so the later one wins and the empty containers are always laid out (with no width); only their margins depend on whether the slot has content.',
] as const;

const gaps = [
  'Shoelace\'s example is ported with a live preview and a React version, which imports Velcro\'s generated wrappers (@charm-ux/velcro/react/VelcroBreadcrumb.js, VelcroBreadcrumbItem.js and VelcroIcon.js) under Shoelace\'s names; nothing else differs. Further examples are on the breadcrumb page.',
  'Velcro builds sl-breadcrumb-item on the @charm-ux/core base element, not on core\'s breadcrumb item: core\'s item is a focusable element that always renders a link, reflects href, current and a boolean separator attribute its breadcrumb toggles, and has core\'s own slots and parts, a different model from Shoelace\'s button, link or dropdown wrapper with a cloned separator element. The only core extension that remains is the non-bubbling ready event on first update, which the API tables label as inherited from core. Core\'s base styles are replaced by Shoelace\'s.',
  'As in Shoelace, the item entry (@charm-ux/velcro/breadcrumb-item) registers sl-breadcrumb-item only, and the item has no dependencies. Import @charm-ux/velcro/breadcrumb (or the package root) for the breadcrumb that holds it.',
  'The public defaultSlot field and the hrefChanged() and handleSlotChange() methods exist as in Shoelace; the API tables below list them without a description, as Shoelace\'s manifest does.',
  'dir and lang are declared as Shoelace\'s base element declares them: reactive, not reflected and undefined until set. Core\'s computed dir is not used. TypeScript types for dir are narrower than Shoelace\'s dir: string: at runtime dir is stored and returned as set and the setter accepts any string, but the read type stays core\'s \'ltr\' | \'rtl\' | \'auto\', because a subclass cannot widen an inherited getter\'s type. Fixing this needs a change in @charm-ux/core and is deferred.',
  'The product test suite is configured for Chromium, Firefox and WebKit; this component\'s spec was run locally in Chromium and WebKit only, and Firefox is covered only by the project\'s CI run. Shoelace\'s own breadcrumb item test (18 tests, including its axe accessibility checks) runs in Chromium only and passes. The accessibility-tree check is Playwright\'s ARIA snapshot, which Playwright computes from the DOM; no screen reader and no browser accessibility API was tried. There is no touch check and no pixel comparison with Shoelace.',
  'Registration is browser-only and uses the native custom element registry for Velcro\'s own class, without changing the shared core prefix. Server-side rendering is not supported.',
  'The item reads these theme tokens: --sl-font-sans, --sl-font-size-small, --sl-font-weight-semibold, --sl-color-neutral-600, --sl-line-height-normal, --sl-border-radius-medium, --sl-transition-fast, --sl-color-primary-500, --sl-color-primary-600, --sl-focus-ring, --sl-focus-ring-offset and --sl-spacing-x-small; both Velcro themes define them. Rendering under the dark theme has not been checked, and color contrast was not evaluated.',
];

@customElement('page-components-breadcrumb-item')
export class BreadcrumbItemPage extends LitElement {
  static override styles = [shellStyles];

  override render() {
    return docsShell('breadcrumb-item', html`
      <h1>Breadcrumb Item</h1>
      <p><code>&lt;sl-breadcrumb-item&gt;</code> is registered by <code>@charm-ux/velcro</code> on top of the <code>@charm-ux/core</code> base element. Prototype status: unreleased.</p>
      <p>Breadcrumb Items are used inside <a href=${withBase('/components/breadcrumb')}>breadcrumbs</a> to represent different links.</p>

      <h2 id="examples">Examples</h2>
      <p>The preview runs in its own document. The React version of the example is Shoelace's, ported to Velcro's generated React wrappers; only its import lines differ. It is shown as source.</p>
      ${sections.map(
        ([, title, key, react]) => html`
          <iframe class="example" title=${`Breadcrumb Item example: ${title}`} srcdoc=${exampleDocument(examples[key])}></iframe>
          <pre><code>${examples[key]}</code></pre>
          <details class="react-example">
            <summary>React</summary>
            <pre><code>${reactExamples[react]}</code></pre>
          </details>
        `
      )}
      <p><strong>Tip:</strong> additional demonstrations can be found in the <a href=${withBase('/components/breadcrumb')}>breadcrumb examples</a>.</p>

      ${apiReference('sl-breadcrumb-item', {
        attributes: html`<p>No property is reflected. With <code>href</code> the label is a link to it (with <code>target</code> and <code>rel</code> only when <code>target</code> is set); without it, the label is a <code>&lt;button type="button"&gt;</code> that does nothing of its own, or, when an <code>sl-dropdown</code> is one of the elements in the default slot, a plain <code>&lt;div&gt;</code> wrapper. <code>dir</code> and <code>lang</code> are reactive properties with no default that are not reflected, as in Shoelace's base element.</p>`,
        methods: html`<p><code>hrefChanged()</code> and <code>handleSlotChange()</code> recompute which label element is rendered; the item calls them itself when <code>href</code> or the default slot changes.</p>`,
        events: html`<p>Shoelace's breadcrumb item has no events. Inherited from core: a non-bubbling <code>ready</code> event on first update, which Shoelace does not have.</p>`,
        slots: html`<p>The <code>separator</code> slot is filled by the breadcrumb with a clone of its separator, unless the item already has an element in it without <code>data-default</code>. The separator container is <code>aria-hidden</code> and is not displayed on the last item of its type among its siblings.</p>`,
        parts: html`<p>The <code>label</code> part is the link, button or dropdown wrapper. Except on the last item, the label is drawn in the primary color.</p>`,
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

export default BreadcrumbItemPage;
