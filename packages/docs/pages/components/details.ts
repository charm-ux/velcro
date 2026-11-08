import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { definePageData } from '@beatzball/litro';
import { docsShell, shellStyles } from '../../src/shell.js';
import { themeHead } from '../../src/theme.js';
import { apiReference } from '../../src/api.js';
import { examples, exampleDocument, reactExamples } from '../../src/example.js';

export const pageData = definePageData(async () => ({
  seoTitle: 'Details - Velcro',
  seoHead: themeHead + '<meta name="description" content="Velcro details (prototype).">',
}));

// Shoelace's examples, in the order of its page: [id, title, text, example key, React example key]. The first has no heading in
// Shoelace's page; it is the page's opening example. Shoelace's page has React versions of the first three only.
const sections = [
  ['overview', 'Overview', null, 'details/basic', 'details/react/basic'],
  ['disabled', 'Disabled', html`Use the <code>disabled</code> attribute to prevent the details from expanding.`, 'details/disabled', 'details/react/disabled'],
  ['custom-icons', 'Customizing the Summary Icon', html`Use the <code>expand-icon</code> and <code>collapse-icon</code> slots to change the expand and collapse icons, respectively. To disable the animation, override the <code>rotate</code> property on the <code>summary-icon</code> part as shown below.`, 'details/custom-icons', 'details/react/custom-icons'],
  ['grouping', 'Grouping Details', html`Details are designed to function independently, but you can simulate a group or "accordion" where only one is shown at a time by listening for the <code>sl-show</code> event.`, 'details/grouping', null],
] as const;

// Shoelace 2.20.1 behaviors that look like bugs but are matched exactly (candidates for a later opt-in fix). One line each.
const quirks = [
  'The hidden attribute does not hide the details: the host\'s own display: block outranks the browser\'s [hidden] rule, so it stays displayed. Core\'s own base styles would hide it, so they are replaced by Shoelace\'s.',
  'show() and hide() promises settle only on the after events: when sl-show (or sl-hide) is canceled, the details stays as it was, no after event follows, and the promise show() (or hide()) returned never settles. A details that is already in that state, or is disabled, returns a promise that resolves to undefined at once.',
  'disabled blocks the summary and the methods, not the property: setting open on a disabled details still opens or closes it, with its events and animation. The summary is aria-disabled and has tabindex="-1".',
  'A details rendered with open already set shows its content with no animation and emits no sl-show: the open watcher only runs from the second update on.',
  'The arrow keys do not follow the writing direction: ArrowLeft and ArrowUp close the details, ArrowRight and ArrowDown open it, in right-to-left text too (only the default chevron icon flips). Enter and Space toggle it.',
  'The document\'s direction is a snapshot, not a live read: it is the localization module\'s copy of <html dir>, refreshed by an observer on that attribute, so a change made in the same task as a render, or between sl-show and the animation that follows it, is not seen by that render or animation; the next one sees it. The details\' own dir property, when set, wins and is read live.',
  'A show that interrupts a hide animation ends closed: stopping the hide animation lets the hide finish, which closes the inner <details> element, and the observer on it then hides the element again (the details\' open property is true until then). A hide that interrupts a show closes as asked.',
  'The expandIconSlot member is a query for .details__expand-icon-slot, a class nothing in the template has (the slots are expand-icon and collapse-icon), so it is always null.',
  'The observer on the inner <details> element\'s open attribute is created once, on the first update, and disconnected when the element is removed; a details that is moved or removed and added back no longer follows that attribute (a find-in-page that opens the native element, for example).',
  'Activating the summary with a click (a script\'s header.click() as well as a pointer press) focuses the header; a disabled details does not move focus.',
] as const;

const gaps = [
  'Shoelace\'s page has four examples (the opening one, Disabled, Customizing the Summary Icon and Grouping Details); all four are ported with a live preview, in Shoelace\'s order. The first three have React versions, which import Velcro\'s generated wrapper (@charm-ux/velcro/react/VelcroDetails.js, and VelcroIcon.js for the icons) under Shoelace\'s name; nothing else differs. Shoelace\'s page has no React version of Grouping Details, so none is shown here.',
  'Core has an accordion item but no details, and its model differs from Shoelace\'s (a heading attribute and slot instead of summary, accordion-item-* parts and an accordion-item-open-change event driven by the native toggle event, CSS transitions set through --accordion-item-* properties instead of the animation registry, and no cancelable show and hide events), so Velcro builds sl-details on the @charm-ux/core base element and takes its markup, styles and behavior from Shoelace. The only core extension that remains is the non-bubbling ready event on first update, which the API tables label as inherited from core. Core\'s accordion item and accordion are not used or registered.',
  'The show and hide animations come from the animation registry, as in Shoelace: details.show and details.hide (height and opacity, 250 ms linear), changed per element with setAnimation() or for every details with setDefaultAnimation(), both exported from @charm-ux/velcro/utilities/animation-registry. The animations do not run when the user prefers reduced motion. As in Shoelace, the rtlKeyframes variant, the chevron icons and the rtl class follow the direction: the details\' own dir property (set directly or through the attribute) when it is set, else the document\'s direction as the localization module last recorded it (see the snapshot quirk above).',
  'The default expand and collapse icons are Velcro\'s sl-icon (the chevron-right and chevron-left icons of the system library). Importing the class-only entry (@charm-ux/velcro/details/class) registers nothing; as with Shoelace\'s declared dependencies, constructing a details defines Velcro\'s sl-icon when that tag is not defined yet, so no extra step is needed on that path. If another constructor already owns sl-icon, a constructed details renders that element and logs nothing, where Shoelace logs a warning when the registered version differs from its own; if the platform refuses the icon class itself, an anonymous subclass is defined, as in Shoelace. The registering entry (@charm-ux/velcro/details or the package root) is different: it registers sl-icon up front with the same strict registration the other registering entries use, so it throws on import when another constructor already owns sl-icon (or when Velcro\'s icon class is registered under another tag), where Shoelace\'s dependency handling leaves the existing element in place. That difference is not covered by this page\'s tests and is to be resolved together for all components that register a dependency. The details has no translatable text.',
  'dir and lang are declared as Shoelace\'s base element declares them: reactive, not reflected and undefined until set. Core\'s computed dir is not used. TypeScript types for dir are narrower than Shoelace\'s dir: string: at runtime dir is stored and returned as set and the setter accepts any string, but the read type stays core\'s \'ltr\' | \'rtl\' | \'auto\', because a subclass cannot widen an inherited getter\'s type. Fixing this needs a change in @charm-ux/core and is deferred.',
  'Shoelace\'s own details tests (11, including two axe accessibility checks, one closed and one open) run against Velcro in Chromium and all pass. The product tests (structure, ARIA attributes, computed styles against Shoelace\'s rules, click and keyboard, events, the animation registry, the examples and the React versions) are configured for Chromium, Firefox and WebKit. The accessibility checks are the two axe checks of Shoelace\'s own test and Playwright\'s role and accessible-name assertions on the header, which Playwright computes from the DOM; there is no ARIA-snapshot (accessibility tree) check of this component, and no screen reader or browser accessibility API was tried. There is no pixel comparison with Shoelace, no right-to-left layout check, and the examples\' appearance under the dark theme has not been checked.',
  'Registration is browser-only and uses the native custom element registry for Velcro\'s own class, without changing the shared core prefix. Server-side rendering is not supported.',
  'The details reads these theme tokens: --sl-color-neutral-0 and -200, --sl-border-radius-medium, --sl-spacing-medium, --sl-transition-medium, --sl-focus-ring and --sl-focus-ring-offset; both Velcro themes define them. Without a theme the details has no border color, padding or focus ring, and the icon does not animate.',
] as const;

@customElement('page-components-details')
export class DetailsPage extends LitElement {
  static override styles = [shellStyles];

  override render() {
    return docsShell('details', html`
      <h1>Details</h1>
      <p><code>&lt;sl-details&gt;</code> is registered by <code>@charm-ux/velcro</code> on top of the <code>@charm-ux/core</code> base element. Prototype status: unreleased.</p>
      <p>Details show a brief summary and expand to show additional content.</p>

      <h2 id="examples">Examples</h2>
      <p>Each preview runs in its own document, so its script uses plain <code>document.querySelector</code>. The React version of each example that has one in Shoelace's page is ported to Velcro's generated React wrappers; only its import lines differ from Shoelace's. It is shown as source and run by the product tests.</p>
      ${sections.map(
        ([id, title, text, key, react]) => html`
          <h3 id=${id}>${title}</h3>
          ${text === null ? '' : html`<p>${text}</p>`}
          <iframe class="example" title=${`Details example: ${title}`} srcdoc=${exampleDocument(examples[key])}></iframe>
          <pre><code>${examples[key]}</code></pre>
          ${react === null ? '' : html`
            <details class="react-example">
              <summary>React</summary>
              <pre><code>${reactExamples[react]}</code></pre>
            </details>
          `}
        `
      )}

      ${apiReference('sl-details', {
        attributes: html`<p><code>open</code> and <code>disabled</code> are reflected; <code>summary</code> is not. Assigning <code>null</code> to a reflected property restores the value it held when the first attribute change was handled, as in Shoelace's base element (a removed Boolean attribute gives <code>false</code>). <code>dir</code> and <code>lang</code> are reactive properties with no default that are not reflected, as in Shoelace's base element. <code>details</code>, <code>header</code>, <code>body</code>, <code>expandIconSlot</code>, <code>detailsObserver</code> and <code>handleOpenChange()</code> are Shoelace's public but undocumented members.</p>`,
        methods: html`<p><code>show()</code> and <code>hide()</code> return a promise that settles on <code>sl-after-show</code> or <code>sl-after-hide</code>; when the details is already in that state, or is disabled, they return a promise that resolves to <code>undefined</code> at once.</p>`,
        events: html`<p>All four events bubble and are composed. <code>sl-show</code> and <code>sl-hide</code> are cancelable and are emitted when <code>open</code> changes, whether by the summary, by <code>show()</code> or <code>hide()</code>, or by script; canceling restores the previous state. The after events follow once the animation ends. Velcro extension, not in Shoelace: the core <code>ready</code> event, dispatched once on the element after its first update (it does not bubble and is not composed).</p>`,
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

export default DetailsPage;
