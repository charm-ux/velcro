import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { definePageData } from '@beatzball/litro';
import { docsShell, shellStyles } from '../../src/shell.js';
import { themeHead } from '../../src/theme.js';
import { apiReference } from '../../src/api.js';
import { withBase } from '../../src/base.js';
import { examples, exampleDocument, reactExamples } from '../../src/example.js';

export const pageData = definePageData(async () => ({
  seoTitle: 'Icon Button - Velcro',
  seoHead: themeHead + '<meta name="description" content="Velcro icon button (prototype).">',
}));

// Shoelace's examples, in the order of its page: [id, title, text, example key, React example key]. The first has no heading in
// Shoelace's page; it is the page's opening example. The tooltip example is source only (it was ported before Velcro had sl-tooltip;
// see the not-implemented list) and has no React version here; every other example is live and has a React version.
const sections = [
  ['basic', 'Default', null, 'icon-button/basic', 'icon-button/react/basic'],
  ['sizes', 'Sizes', html`Icon buttons inherit their parent element's <code>font-size</code>.`, 'icon-button/sizes', 'icon-button/react/sizes'],
  ['colors', 'Colors', html`Icon buttons are designed to have a uniform appearance, so their color is not inherited. However, you can still customize them by styling the <code>base</code> part.`, 'icon-button/colors', 'icon-button/react/colors'],
  ['link-buttons', 'Link Buttons', html`Use the <code>href</code> attribute to convert the button to a link.`, 'icon-button/link-buttons', 'icon-button/react/link-buttons'],
  ['tooltip', 'Icon Button with Tooltip', html`Wrap a tooltip around an icon button to provide contextual information to the user. This port predates Velcro's <code>sl-tooltip</code>, so this is Shoelace's example as source only, without a live preview.`, 'icon-button/tooltip', null],
  ['disabled', 'Disabled', html`Use the <code>disabled</code> attribute to disable the icon button.`, 'icon-button/disabled', 'icon-button/react/disabled'],
] as const;

// Shoelace 2.20.1 behaviors that look like bugs but are matched exactly (candidates for a later opt-in fix). One line each.
const quirks = [
  'The hidden attribute does not hide the icon button: the host\'s own display: inline-block outranks the browser\'s [hidden] rule, so it stays displayed. Core\'s own base styles would hide it, so they are replaced by Shoelace\'s.',
  'Calling click(), focus() or blur() before the first render throws a TypeError, because they act on the inner button, which does not exist yet. Wait for updateComplete first.',
  'The label is always written to aria-label, even when it is empty, so an icon button without a label is a button with an empty accessible name. Shoelace asks for a label but does not require one.',
  'disabled on a link (href set) does not disable the anchor, and the link is not drawn as disabled: it gets aria-disabled="true" and tabindex="-1", and its own click is cancelled (default prevented and propagation stopped, so the host never sees it), but it keeps full opacity, the pointer cursor and the hover colors, and script can still focus it. Only a button gets the native disabled attribute and the disabled styling (half opacity, not-allowed cursor).',
  'A link whose target is set gets rel="noreferrer noopener"; without a target it gets no rel. download is written to the anchor as set, with no check that href is same-origin.',
  'The button property is typed HTMLButtonElement | HTMLLinkElement, although a link renders an <a> (HTMLAnchorElement); HTMLLinkElement is the type of <link>.',
] as const;

const gaps = [
  'The Icon Button with Tooltip example is shown as source only, with no live preview and no React version, because it was ported before Velcro had sl-tooltip; making it live is a follow-up. Shoelace\'s page has five other examples (the opening one, Sizes, Colors, Link Buttons and Disabled); each is ported with a live preview and a React version, in Shoelace\'s order. The React examples import Velcro\'s generated wrapper (@charm-ux/velcro/react/VelcroIconButton.js) under Shoelace\'s name; nothing else differs.',
  'The button property (the rendered native button or link) exists in Shoelace\'s class, with the same type, but has no description there, so Shoelace\'s documentation leaves it out. Velcro describes it, so its generated API table lists button and the parity report counts it as Velcro-only.',
  'Shoelace\'s link example opens https://example.com in a new window when it is clicked, as Shoelace\'s does; nothing is requested until then.',
  'Core has no icon button, so Velcro builds sl-icon-button on the @charm-ux/core base element and takes its markup, styles and behavior from Shoelace. The only core extension that remains is the non-bubbling ready event on first update, which the API tables label as inherited from core.',
  'The icon is an sl-icon, as in Shoelace. The registering entry (@charm-ux/velcro/icon-button or the package root) registers Velcro\'s sl-icon up front. Importing the class-only entry (@charm-ux/velcro/icon-button/class) registers nothing; as with Shoelace\'s declared dependencies, constructing an icon button defines Velcro\'s sl-icon when that tag is not defined yet, so no extra step is needed. If another constructor already owns sl-icon, the icon button renders that element and logs nothing, where Shoelace logs a warning when the registered version differs from its own.',
  'dir and lang are declared as Shoelace\'s base element declares them: reactive, not reflected and undefined until set. Core\'s computed dir is not used. TypeScript types for dir are narrower than Shoelace\'s dir: string: at runtime dir is stored and returned as set and the setter accepts any string, but the read type stays core\'s \'ltr\' | \'rtl\' | \'auto\', because a subclass cannot widen an inherited getter\'s type. Fixing this needs a change in @charm-ux/core and is deferred.',
  'The product test suite is configured for Chromium, Firefox and WebKit; this component\'s spec was run locally in Chromium and WebKit only, and Firefox is covered only by the project\'s CI run. Shoelace\'s own icon button test (22 tests, which has no axe accessibility checks) runs in Chromium only and passes. The accessibility-tree check is Playwright\'s ARIA snapshot, which Playwright computes from the DOM; no screen reader and no browser accessibility API was tried, and there is no RTL check and no pixel comparison with Shoelace.',
  'Registration is browser-only and uses the native custom element registry for Velcro\'s own class, without changing the shared core prefix. Server-side rendering is not supported.',
  'The icon button reads eight theme tokens (--sl-color-neutral-600, --sl-color-primary-600, --sl-color-primary-700, --sl-border-radius-medium, --sl-spacing-x-small, --sl-transition-x-fast, --sl-focus-ring and --sl-focus-ring-offset); both Velcro themes define them. Without a theme the icon button has no color, padding, rounded corners or focus ring. Rendering under the dark theme has not been checked, and color contrast was not evaluated.',
];

@customElement('page-components-icon-button')
export class IconButtonPage extends LitElement {
  static override styles = [shellStyles];

  override render() {
    return docsShell('icon-button', html`
      <h1>Icon Button</h1>
      <p><code>&lt;sl-icon-button&gt;</code> is registered by <code>@charm-ux/velcro</code> on top of the <code>@charm-ux/core</code> base element. Prototype status: unreleased.</p>
      <p>Icons buttons are simple, icon-only buttons that can be used for actions and in toolbars.</p>
      <p>For a full list of icons that come bundled with Velcro, refer to the <a href=${withBase('/components/icon')}>icon component</a>.</p>

      <h2 id="examples">Examples</h2>
      <p>Each preview runs in its own document. The React version of each live example is Shoelace's, ported to Velcro's generated React wrapper; only its import line differs. It is shown as source.</p>
      ${sections.map(
        ([id, title, text, key, react]) => html`
          <h3 id=${id}>${title}</h3>
          ${text === null ? '' : html`<p>${text}</p>`}
          ${react === null
            ? ''
            : html`<iframe class="example" title=${`Icon Button example: ${title}`} srcdoc=${exampleDocument(examples[key])}></iframe>`}
          <pre><code>${examples[key]}</code></pre>
          ${react === null
            ? ''
            : html`<details class="react-example">
                <summary>React</summary>
                <pre><code>${reactExamples[react]}</code></pre>
              </details>`}
        `
      )}

      ${apiReference('sl-icon-button', {
        attributes: html`<p>Only <code>disabled</code> is reflected; removing its attribute restores <code>false</code>. <code>name</code>, <code>library</code> and <code>src</code> are passed to the inner <code>sl-icon</code>; <code>href</code>, <code>target</code> and <code>download</code> apply only to the link form, which is chosen whenever <code>href</code> is set. <code>dir</code> and <code>lang</code> are reactive properties with no default that are not reflected, as in Shoelace's base element.</p>`,
        methods: html`<p>All three act on the inner native button or link, so they throw before the first render and a disabled button cannot be clicked.</p>`,
        events: html`<p><code>sl-focus</code> and <code>sl-blur</code> bubble and are composed, with an empty <code>detail</code>; they follow the inner button's focus and blur. Inherited from core: a non-bubbling <code>ready</code> event on first update, which Shoelace does not have. The click is the browser's own <code>click</code> event from the inner button or link; no <code>sl-</code> event is emitted for it.</p>`,
        parts: html`<p><code>base</code> is the inner <code>button</code> (or <code>a</code> when <code>href</code> is set), which holds an <code>sl-icon</code> with <code>aria-hidden="true"</code>.</p>`,
      })}

      <h2 id="upstream-quirks">Upstream quirks matched</h2>
      <p>Velcro matches Shoelace 2.20.1 exactly, including behavior that looks like a bug. Each of these is covered by a product test, except the last, which is a type and is pinned by the compiled type test in <code>packages/velcro/type-tests/icon-button.tsx</code>. Each is a candidate for a later opt-in fix.</p>
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

export default IconButtonPage;
