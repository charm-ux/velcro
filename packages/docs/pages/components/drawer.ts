import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { definePageData } from '@beatzball/litro';
import { docsShell, shellStyles } from '../../src/shell.js';
import { themeHead } from '../../src/theme.js';
import { apiReference } from '../../src/api.js';
import { examples, exampleDocument, reactExamples } from '../../src/example.js';

export const pageData = definePageData(async () => ({
  seoTitle: 'Drawer - Velcro',
  seoHead: themeHead + '<meta name="description" content="Velcro drawer (prototype).">',
}));

// Each preview frame has a fixed height (see the examples paragraph): a frame that follows its content would loop on the
// Scrolling example's 150vh content until the drawer is defined and hides it (a ResizeObserver loop error in WebKit).
// Shoelace's examples, in the order of its page: [id, title, text, example key, React example key]. The first has no heading in
// Shoelace's page; it is the page's opening example. Every one has a React version in Shoelace's page.
const sections = [
  ['overview', 'Overview', null, 'drawer/overview', 'drawer/react/overview'],
  ['slide-in-from-start', 'Slide in From Start', html`By default, drawers slide in from the end. To make the drawer slide in from the start, set the <code>placement</code> attribute to <code>start</code>.`, 'drawer/placement-start', 'drawer/react/placement-start'],
  ['slide-in-from-top', 'Slide in From Top', html`To make the drawer slide in from the top, set the <code>placement</code> attribute to <code>top</code>.`, 'drawer/placement-top', 'drawer/react/placement-top'],
  ['slide-in-from-bottom', 'Slide in From Bottom', html`To make the drawer slide in from the bottom, set the <code>placement</code> attribute to <code>bottom</code>.`, 'drawer/placement-bottom', 'drawer/react/placement-bottom'],
  ['contained-to-an-element', 'Contained to an Element', html`By default, drawers slide out of their containing block, which is usually the viewport. To make a drawer slide out of a parent element, add the <code>contained</code> attribute to the drawer and apply <code>position: relative</code> to its parent. Unlike normal drawers, contained drawers are not modal. This means they do not show an overlay, they do not trap focus, and they are not dismissible with <kbd>Escape</kbd>. This is intentional to allow users to interact with elements outside of the drawer.`, 'drawer/contained', 'drawer/react/contained'],
  ['custom-size', 'Custom Size', html`Use the <code>--size</code> custom property to set the drawer's size. This will be applied to the drawer's width or height depending on its <code>placement</code>.`, 'drawer/custom-size', 'drawer/react/custom-size'],
  ['scrolling', 'Scrolling', html`By design, a drawer's height will never exceed 100% of its container. As such, drawers will not scroll with the page to ensure the header and footer are always accessible to the user.`, 'drawer/scrolling', 'drawer/react/scrolling'],
  ['header-actions', 'Header Actions', html`The header shows a functional close button by default. You can use the <code>header-actions</code> slot to add additional icon buttons (<code>&lt;sl-icon-button&gt;</code>) if needed.`, 'drawer/header-actions', 'drawer/react/header-actions'],
  ['preventing-the-drawer-from-closing', 'Preventing the Drawer from Closing', html`By default, drawers will close when the user clicks the close button, clicks the overlay, or presses the <kbd>Escape</kbd> key. In most cases, the default behavior is the best behavior in terms of UX. However, there are situations where this may be undesirable, such as when data loss will occur. To keep the drawer open in such cases, you can cancel the <code>sl-request-close</code> event. When canceled, the drawer will remain open and pulse briefly to draw the user's attention to it. You can use <code>event.detail.source</code> to determine what triggered the request to close. This example prevents the drawer from closing when the overlay is clicked, but allows the close button or <kbd>Escape</kbd> to dismiss it.`, 'drawer/deny-close', 'drawer/react/deny-close'],
  ['customizing-initial-focus', 'Customizing Initial Focus', html`By default, the drawer's panel will gain focus when opened. This allows a subsequent tab press to focus on the first tabbable element in the drawer. If you want a different element to have focus, add the <code>autofocus</code> attribute to it as shown below.`, 'drawer/focus', 'drawer/react/focus'],
] as const;

// Shoelace 2.20.1 behaviors that look like bugs but are matched exactly (candidates for a later opt-in fix). One line each.
const quirks = [
  'A drawer rendered with open already set is shown at once: it emits no sl-show, sl-initial-focus or sl-after-show, plays no animation, does not move focus into the panel and records no trigger to return focus to on close. Unless it is contained, it does trap focus, lock body scrolling and handle Escape. The open watcher only runs from the second update on.',
  'Where the browser has CloseWatcher (Chromium), Escape is handled by a watcher that is spent by the first Escape: when that sl-request-close is canceled, the drawer stays open and later Escape presses request nothing until the drawer is hidden and shown again. Browsers without CloseWatcher use a document keydown listener, which requests a close on every Escape.',
  'Changing contained while the drawer is open moves the focus trap and the body scroll lock, but not the Escape handling where the browser has CloseWatcher (Chromium): a drawer opened contained still ignores Escape after contained is removed, and a drawer opened uncontained still closes on Escape after contained is set. Browsers without CloseWatcher read contained on every Escape.',
  'A contained drawer\'s panel keeps aria-modal="true", although a contained drawer is not modal: it has no overlay and does not trap focus, and the page outside it stays usable.',
  'The hidden attribute does not hide the drawer: the host is display: contents, which outranks the browser\'s [hidden] rule, so an open drawer stays displayed. Only open shows and hides it.',
  'Removing an open drawer from the document releases its body scroll lock and its Escape handling, but not its focus trap (unlike the dialog, the drawer does not deactivate its modal when it is removed), and leaves open true. The removed drawer stays the active modal: a drawer or dialog that was open beneath it does not get its focus trap or its keydown Escape handling back, and Tab presses anywhere in the document are taken by the removed drawer\'s trap, which has nothing to focus. Adding the drawer back does not restore the scroll lock or the Escape handling (only the first update does); closing it releases the trap.',
  'The focus trap counts an <a> without href as tabbable (Shoelace\'s tabbable helper lists it with the natively tabbable tags), although the browser does not focus it.',
  'With an empty label and no label slot content, the header title is a single zero-width no-break space (U+FEFF), so the panel, which is labelled by that title, has no usable accessible name. Always set a label, as Shoelace advises.',
] as const;

const gaps = [
  'Shoelace\'s page has ten examples (the opening one, Slide in From Start, Slide in From Top, Slide in From Bottom, Contained to an Element, Custom Size, Scrolling, Header Actions, Preventing the Drawer from Closing and Customizing Initial Focus); all ten are ported with a live preview, in Shoelace\'s order, and each has its React version, which imports Velcro\'s generated wrappers (@charm-ux/velcro/react/VelcroDrawer.js and VelcroButton.js, plus VelcroIconButton.js or VelcroInput.js where used) under Shoelace\'s names; nothing else differs. Shoelace\'s closing tip (cancel sl-initial-focus to set focus yourself) applies as written. The React version of Contained to an Element passes a no-modal prop, as Shoelace\'s does; the drawer has no such property, so React sets it as a no-modal attribute that the drawer ignores. Observed, not compared: in the React version of Customizing Initial Focus, the autofocus prop is set as the input\'s autofocus property, which does not reflect to the autofocus attribute the drawer looks for (Shoelace\'s input does not reflect it either), so the panel takes focus instead of the input. Whether Shoelace\'s React versions behave the same was not checked.',
  'Core has no drawer (its push pane is a different, non-modal component with its own model), so Velcro builds sl-drawer on the @charm-ux/core base element and takes its markup, styles and behavior from Shoelace. The only core extension is the non-bubbling ready event on first update, which the API tables label as inherited from core.',
  'The focus trap, the body scroll lock and the Escape handling are the same Velcro ports of Shoelace\'s internal modules (modal, tabbable, active-elements and scroll) that the dialog uses, behavior unchanged. They are internal, not package exports; the drawer\'s modal property exposes the focus trap as Shoelace\'s does (activateExternal() and deactivateExternal() for third-party modals). A contained drawer uses none of them. The body scroll lock adds the sl-scroll-lock class to <html> and sets --sl-scroll-lock-size; the rules that act on them come from Shoelace\'s _utility.css, which both Velcro themes include, so without a theme the page behind the drawer still scrolls. Escape goes through the platform CloseWatcher where the browser has one (Chromium), else through a document keydown listener, as in Shoelace.',
  'The show, hide, deny-close and overlay animations come from the animation registry, as in Shoelace: drawer.showTop, drawer.showEnd, drawer.showBottom and drawer.showStart slide the panel in from its placement with an opacity fade, and the matching drawer.hideTop, drawer.hideEnd, drawer.hideBottom and drawer.hideStart slide it out (250 ms ease; the start and end ones have right-to-left keyframes that mirror them), drawer.denyClose is a 1.01 pulse (250 ms), and drawer.overlay.show and drawer.overlay.hide fade the overlay (250 ms). Change them per element with setAnimation() or for every drawer with setDefaultAnimation(), both exported from @charm-ux/velcro/utilities/animation-registry. The animations do not run when the user prefers reduced motion. The direction that picks an animation\'s rtlKeyframes, and the drawer--rtl class on the base, is the drawer\'s own dir property when it is set, else the localization module\'s snapshot of <html dir>, as Shoelace\'s controller resolves it; the panel\'s start and end positions follow the CSS direction instead.',
  'The close button is an sl-icon-button, as in Shoelace, labelled with the localization module\'s close term in the drawer\'s own language. The registering entry (@charm-ux/velcro/drawer or the package root) registers Velcro\'s sl-icon-button and sl-icon up front, each when its tag is not defined yet. Importing the class-only entry (@charm-ux/velcro/drawer/class) registers nothing; as with Shoelace\'s declared dependencies, constructing a drawer defines Velcro\'s sl-icon-button when that tag is not defined yet (and constructing that defines sl-icon). If another constructor already owns sl-icon-button, the drawer renders that element and, as in Shoelace, logs a console warning when the two versions differ.',
  'dir and lang are declared as Shoelace\'s base element declares them: reactive, not reflected and undefined until set. Core\'s computed dir is not used. TypeScript types for dir are narrower than Shoelace\'s dir: string: at runtime dir is stored and returned as set and the setter accepts any string, but the read type stays core\'s \'ltr\' | \'rtl\' | \'auto\', because a subclass cannot widen an inherited getter\'s type. Fixing this needs a change in @charm-ux/core and is deferred.',
  'Shoelace\'s own drawer tests (9; Shoelace has no axe check for the drawer) run against Velcro in Chromium and all pass. The product tests (structure, ARIA attributes, computed styles against Shoelace\'s rules for each placement and for contained, the three close sources and their cancelation, focus trapping and its return, the scroll lock, events, the animation registry, the examples and the React versions) are configured for Chromium, Firefox and WebKit. The accessibility checks are Playwright\'s role and accessible-name assertions on the panel and the close button, which Playwright computes from the DOM; there is no axe check, and no screen reader or browser accessibility API was tried. There is no pixel comparison with Shoelace, the right-to-left check covers only the start and end panel positions and the animation direction, and the examples\' appearance under the dark theme has not been checked.',
  'Registration is browser-only and uses the native custom element registry for Velcro\'s own class, without changing the shared core prefix. Server-side rendering is not supported.',
  'The drawer reads these theme tokens: --sl-z-index-drawer, --sl-overlay-background-color, --sl-panel-background-color, --sl-shadow-x-large, --sl-spacing-large, --sl-spacing-x-small, --sl-spacing-2x-small, --sl-font-size-large, --sl-font-size-medium, --sl-line-height-dense and --sl-color-neutral-0 (the panel border in forced-colors mode); both Velcro themes define them. Without a theme the drawer has no overlay color, stacking order or spacing.',
] as const;

@customElement('page-components-drawer')
export class DrawerPage extends LitElement {
  static override styles = [shellStyles];

  override render() {
    return docsShell('drawer', html`
      <h1>Drawer</h1>
      <p><code>&lt;sl-drawer&gt;</code> is registered by <code>@charm-ux/velcro</code> on top of the <code>@charm-ux/core</code> base element. Prototype status: unreleased.</p>
      <p>Drawers slide in from a container to expose additional options and information.</p>

      <h2 id="examples">Examples</h2>
      <p>Each preview runs in its own document, so its script uses plain <code>document.querySelector</code>, and the open drawer covers that preview only. Each preview is 24rem tall, so the drawer has room; its height does not follow its content, because before the drawer is defined the Scrolling example's 150vh content would size the frame it is measured in. The React version of each example is Shoelace's, ported to Velcro's generated React wrappers; only its import lines differ. It is shown as source and run by the product tests.</p>
      ${sections.map(
        ([id, title, text, key, react]) => html`
          <h3 id=${id}>${title}</h3>
          ${text === null ? '' : html`<p>${text}</p>`}
          <iframe class="example" style="min-height: 24rem; max-height: 24rem" title=${`Drawer example: ${title}`} srcdoc=${exampleDocument(examples[key])}></iframe>
          <pre><code>${examples[key]}</code></pre>
          <details class="react-example">
            <summary>React</summary>
            <pre><code>${reactExamples[react]}</code></pre>
          </details>
        `
      )}
      <p>You can further customize initial focus behavior by canceling the <code>sl-initial-focus</code> event and setting focus yourself inside the event handler.</p>

      ${apiReference('sl-drawer', {
        attributes: html`<p><code>open</code>, <code>label</code>, <code>placement</code>, <code>contained</code> and <code>no-header</code> are reflected. Removing a reflected attribute restores the value the property held when the drawer's first attribute change was handled, as in Shoelace's base element (a removed Boolean attribute gives <code>false</code>, a removed <code>placement</code> gives <code>end</code>). <code>dir</code> and <code>lang</code> are reactive properties with no default that are not reflected, as in Shoelace's base element. <code>drawer</code>, <code>panel</code>, <code>overlay</code>, <code>handleOpenChange()</code> and <code>handleNoModalChange()</code> are Shoelace's public but undocumented members.</p>`,
        methods: html`<p><code>show()</code> and <code>hide()</code> resolve after <code>sl-after-show</code> or <code>sl-after-hide</code>, and resolve to <code>undefined</code> at once when the drawer is already in that state. <code>hide()</code> and setting <code>open</code> are not cancelable; only a close by the user emits <code>sl-request-close</code>.</p>`,
        events: html`<p>All events bubble and are composed. <code>sl-show</code>, <code>sl-after-show</code>, <code>sl-hide</code> and <code>sl-after-hide</code> are not cancelable and have an empty <code>detail</code>. <code>sl-initial-focus</code> is cancelable and is emitted in the animation frame after the drawer is shown. <code>sl-request-close</code> is cancelable and its <code>detail.source</code> is <code>close-button</code>, <code>keyboard</code> (<kbd>Escape</kbd>) or <code>overlay</code>; canceling it keeps the drawer open and plays the <code>drawer.denyClose</code> animation. A contained drawer has no overlay and ignores <kbd>Escape</kbd>, so only its close button requests a close. Velcro extension, not in Shoelace: the core <code>ready</code> event, dispatched once on the element after its first update (it does not bubble and is not composed).</p>`,
        parts: html`<p><code>base</code> is the wrapper, fixed to the viewport (or absolute in its containing block when <code>contained</code>) and hidden while the drawer is closed; it holds the <code>overlay</code> (clicking it requests a close; not displayed when <code>contained</code>) and the <code>panel</code> (<code>role="dialog"</code>, <code>aria-modal="true"</code>, labelled by the title, or by <code>label</code> through <code>aria-label</code> with <code>no-header</code>), placed along the edge that <code>placement</code> names. The panel holds the <code>header</code> (unless <code>no-header</code>) with the <code>title</code> and the <code>header-actions</code> part (the <code>header-actions</code> slot and the <code>close-button</code>, an <code>sl-icon-button</code> using the <code>x-lg</code> icon of the <code>system</code> library that re-exports its <code>base</code> part as <code>close-button__base</code>), the <code>body</code> and the <code>footer</code>.</p>`,
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

export default DrawerPage;
