import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { definePageData } from '@beatzball/litro';
import { docsShell, shellStyles } from '../../src/shell.js';
import { themeHead } from '../../src/theme.js';
import { apiReference } from '../../src/api.js';
import { examples, exampleDocument, reactExamples } from '../../src/example.js';

export const pageData = definePageData(async () => ({
  seoTitle: 'Tooltip - Velcro',
  seoHead: themeHead + '<meta name="description" content="Velcro tooltip (prototype).">',
}));

// [id, title, HTML example, text, React example]
const sections: Array<[string, string, string, string, string]> = [
  ['overview', 'Overview', 'tooltip/basic', 'Hover or focus the button to show the tooltip.', 'tooltip/react/basic'],
  ['placement', 'Placement', 'tooltip/placement', 'Use the placement attribute to set the preferred placement of the tooltip.', 'tooltip/react/placement'],
  ['click-trigger', 'Click Trigger', 'tooltip/click-trigger', 'Set the trigger attribute to click to toggle the tooltip on click instead of hover.', 'tooltip/react/click-trigger'],
  ['manual-trigger', 'Manual Trigger', 'tooltip/manual-trigger', 'Tooltips can be controlled programmatically by setting the trigger attribute to manual. Use the open attribute to control when the tooltip is shown.', 'tooltip/react/manual-trigger'],
  ['removing-arrows', 'Removing Arrows', 'tooltip/removing-arrows', 'You can control the size of tooltip arrows by overriding the --sl-tooltip-arrow-size design token. To remove them, set the value to 0 as shown below. To override it globally, set it in a :root block in your stylesheet after the Velcro theme is loaded.', 'tooltip/react/removing-arrows'],
  ['html', 'HTML in Tooltips', 'tooltip/html', 'Use the content slot to create tooltips with HTML content. Tooltips are designed only for text and presentational elements. Avoid placing interactive content, such as buttons, links, and form controls, in a tooltip.', 'tooltip/react/html'],
  ['max-width', 'Setting a Maximum Width', 'tooltip/max-width', 'Use the --max-width custom property to change the width the tooltip can grow to before wrapping occurs.', 'tooltip/react/max-width'],
  ['hoisting', 'Hoisting', 'tooltip/hoisting', 'Tooltips will be clipped if they\'re inside a container that has overflow: auto|hidden|scroll. The hoist attribute forces the tooltip to use a fixed positioning strategy, allowing it to break out of the container. In this case, the tooltip will be positioned relative to its containing block, which is usually the viewport unless an ancestor uses a transform, perspective, or filter.', 'tooltip/react/hoisting'],
];

const quirks = [
  'The tooltip uses aria-live on its body (polite while open, off while closed) instead of aria-labelledby, and puts aria-describedby on the anchor slot, not on the target element, so the target does not reference the tooltip.',
  'The hidden attribute does not hide the tooltip: its :host { display: contents } rule outranks the browser\'s [hidden] rule.',
  'Setting open while disabled emits nothing and shows nothing, but open stays true; removing disabled does not show the tooltip until open changes again.',
  'show() and hide() return a promise that settles on sl-after-show or sl-after-hide; when the tooltip is already in that state they return a promise that resolves to undefined at once.',
  'Escape hides an open tooltip from anywhere in the document (through CloseWatcher where the browser has it, otherwise a document keydown listener that stops the Escape event), but only once it has been opened after its first render: a tooltip rendered with open already set ignores Escape until it is closed and opened again.',
];

const gaps = [
  'Velcro builds on the @charm-ux/core tooltip and keeps its extras, which are not part of the Shoelace contract: fixed-placement (reflected; uses the fixed positioning strategy, as hoist does) and toggle() (shows a hidden tooltip and hides an open one). The core arrow and anchor properties are accepted but have no effect (arrow is reflected; the API table marks both inert): the arrow always shows and the tooltip always anchors to the element in its default slot, as in Shoelace. Core\'s tooltip events (tooltip-show and the others), styles, parts, custom properties and live region are not used. The element emits the core ready event (see Events). Apart from that event, the extensions change nothing unless they are set. As in Shoelace, dir and lang are plain reactive properties (undefined unless set, not reflected).',
  'The show and hide animations come from the animation registry, as in Shoelace: tooltip.show and tooltip.hide, changed per element with setAnimation() or for every tooltip with setDefaultAnimation(), both exported from @charm-ux/velcro/utilities/animation-registry (Shoelace\'s utilities/animation-registry). The animations do not run when the user prefers reduced motion. As in Shoelace, the rtlKeyframes variant is chosen from the tooltip\'s dir property (set directly or through the attribute), else the document\'s direction.',
  'TypeScript types: dir is typed as in the other components: the setter accepts any string, but the read type stays core\'s \'ltr\' | \'rtl\' | \'auto\' until a change in @charm-ux/core.',
  'The tooltip is positioned by Velcro\'s <sl-popup>. The registering entry (@charm-ux/velcro/tooltip or the package root) registers sl-popup up front. Importing the class-only entry (@charm-ux/velcro/tooltip/class) registers nothing; as with Shoelace\'s declared dependencies, constructing a tooltip defines Velcro\'s sl-popup when that tag is not defined yet, so no extra step is needed. If another constructor already owns sl-popup, the tooltip renders that element and logs nothing, where Shoelace logs a warning when the registered version differs from its own. The tooltip has no translatable text. Registration is browser-only and uses the native custom element registry for Velcro\'s own class, without changing the shared core prefix. Server-side rendering is not supported.',
  'Shoelace\'s own tooltip tests run against Velcro in Chromium and all 9 pass; they include no accessibility check. The product tests (structure, ARIA, computed styles against Shoelace\'s rules, the triggers, delays, events, Escape, the animation registry and the examples with their React versions) are configured for Chromium, Firefox and WebKit. There is no pixel comparison with Shoelace, no automated accessibility (axe) check, no right-to-left layout or screen reader check, and the examples\' appearance under the dark theme has not been checked.',
];

@customElement('page-components-tooltip')
export class TooltipPage extends LitElement {
  static override styles = [shellStyles];

  override render() {
    return docsShell('tooltip', html`
      <h1>Tooltip</h1>
      <p><code>&lt;sl-tooltip&gt;</code> is registered by <code>@charm-ux/velcro</code> on top of the <code>@charm-ux/core</code> tooltip. Prototype status: unreleased.</p>
      <p>Tooltips display additional information based on a specific action. A tooltip's target is its <em>first child element</em>, so you should only wrap one element inside of the tooltip. If you need the tooltip to show up for multiple elements, nest them inside a container first. Tooltips use <code>display: contents</code> so they won't interfere with how elements are positioned in a flex or grid layout.</p>

      <h2 id="examples">Examples</h2>
      <p>Each preview runs in its own document, so its script uses plain <code>document.querySelector</code>. Every example also has Shoelace's React version, ported to Velcro's generated React wrappers (<code>@charm-ux/velcro/react/VelcroTooltip.js</code>, imported under Shoelace's name); only the import lines differ from Shoelace's. They are shown as source and run by the product tests.</p>
      ${sections.map(
        ([id, title, key, text, react]) => html`
          <h3 id=${id}>${title}</h3>
          <p>${text}</p>
          <iframe class="example" title=${`Tooltip example: ${title}`} srcdoc=${exampleDocument(examples[key as keyof typeof examples])}></iframe>
          <pre><code>${examples[key as keyof typeof examples]}</code></pre>
          <details class="react-example">
            <summary>React</summary>
            <pre><code>${reactExamples[react as keyof typeof reactExamples]}</code></pre>
          </details>
        `
      )}

      ${apiReference('sl-tooltip', {
        attributes: html`<p>Removing a reflected attribute (<code>disabled</code>, <code>open</code>) restores the property's initial value, as in Shoelace. <code>body</code>, <code>popup</code>, <code>defaultSlot</code>, <code>handleOpenChange()</code>, <code>handleOptionsChange()</code> and <code>handleDisabledChange()</code> are Shoelace's public but undocumented members. Velcro extensions, not in Shoelace: <code>fixedPlacement</code> and <code>toggle()</code> (inherited from core and kept working), and <code>arrow</code> and <code>anchor</code>, which are accepted but have no effect.</p>`,
        events: html`<p><code>sl-show</code>, <code>sl-after-show</code>, <code>sl-hide</code> and <code>sl-after-hide</code> bubble and are composed, and are not cancelable. <code>sl-show</code> and <code>sl-hide</code> are emitted when <code>open</code> changes, whether by a trigger, by <code>show()</code> or <code>hide()</code>, or by script; the after events follow once the animation ends. Velcro extension, not in Shoelace: the core <code>ready</code> event, dispatched once on the element after its first update (it does not bubble and is not composed).</p>`,
        slots: html`<p>The <code>content</code> slot takes precedence over the attribute of the same name when both are present.</p>`,
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

export default TooltipPage;
