import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { definePageData } from '@beatzball/litro';
import { docsShell, shellStyles } from '../../src/shell.js';
import { themeHead } from '../../src/theme.js';
import { apiReference } from '../../src/api.js';
import { examples, exampleDocument } from '../../src/example.js';

export const pageData = definePageData(async () => ({
  seoTitle: 'Split Panel - Velcro',
  seoHead: themeHead + '<meta name="description" content="Velcro split panel (prototype).">',
}));

const sections: Array<[string, string, string, string]> = [
  ['overview', 'Overview', 'split-panel/basic', 'Split panels display two adjacent panels, allowing the user to reposition them. Drag the divider, or focus it and use the arrow keys.'],
  ['initial-position', 'Initial Position', 'split-panel/initial-position', 'To set the initial position, use the position attribute. If no position is provided, it will default to 50% of the available space.'],
  ['initial-position-in-pixels', 'Initial Position in Pixels', 'split-panel/initial-position-in-pixels', 'To set the initial position in pixels instead of a percentage, use the position-in-pixels attribute.'],
  ['vertical', 'Vertical', 'split-panel/vertical', 'Add the vertical attribute to render the split panel in a vertical orientation where the start and end panels are stacked. You also need to set a height when using the vertical orientation.'],
  ['snapping', 'Snapping', 'split-panel/snapping', 'To snap panels at specific positions while dragging, use the snap attribute. You can provide one or more space-separated pixel or percentage values, either as single values or within a repeat() expression, which will be repeated along the length of the panel. You can also customize how close the divider must be before snapping with the snap-threshold attribute. For example, to snap the panel at 100px and 50%, use snap="100px 50%".'],
  ['snapping-repeat', 'Snapping to repeated intervals', 'split-panel/snapping-repeat', 'To snap the panel to every 100px interval, as well as at 50% of the panel\'s size, use snap="repeat(100px) 50%". See the quirks below before combining repeat() with other values.'],
  ['snap-function', 'Using a Custom Snap Function', 'split-panel/snap-function', 'You can also implement a custom snap function which controls the snapping manually. Acquire a reference to the element in JavaScript and set the snap property to a function that receives { pos, size, snapThreshold, isRtl, vertical } and returns the position to snap to in pixels, or null for no snapping. The snap-threshold property is not applied automatically to a function; the function must apply it if desired.'],
  ['disabled', 'Disabled', 'split-panel/disabled', 'Add the disabled attribute to prevent the divider from being repositioned.'],
  ['primary', 'Setting the Primary Panel', 'split-panel/primary', 'By default, both panels will grow or shrink proportionally when the host element is resized. If a primary panel is designated, it will maintain its size and the secondary panel will grow or shrink to fit the remaining space. You can set the primary panel to start or end using the primary attribute. Try resizing the browser window with each option and notice how the panels respond. Velcro has no sl-select yet, so this example uses a native select.'],
  ['min-max', 'Min & Max', 'split-panel/min-max', 'To set a minimum or maximum size of the primary panel, use the --min and --max custom properties. Since the secondary panel is flexible, size constraints can only be applied to the primary panel. If no primary panel is designated, these constraints will be applied to the start panel. This example keeps the start panel between 150px and the host width minus 150px using --min, --max, and the calc() function. The 4px divider is taken out of the space left for the other panel, so the end panel can be 4px narrower than 150px (see the quirks below).'],
  ['nested', 'Nested Split Panels', 'split-panel/nested', 'Create complex layouts that can be repositioned independently by nesting split panels.'],
  ['divider', 'Customizing the Divider', 'split-panel/divider', 'You can target the divider part to apply CSS properties to the divider. To add a custom handle, slot an element into the divider slot. When customizing the divider, make sure to think about focus styles for keyboard users. This example was ported before Velcro had sl-icon, so the handle is an inline svg (not yet updated to use it).'],
  ['divider-styled', 'A styled divider', 'split-panel/divider-styled', 'A more elaborate example that changes the divider\'s color and width and adds a styled handle.'],
];

const quirks = [
  'repeat() reads its interval from the whole snap string, not from its own value. A lone repeat(100px) or repeat(25%) works, and so does a first value like repeat(100px) followed by 50%, but only because the text after the number is ignored. The unit is taken from the end of the whole string: repeat(10%) 100px repeats every 10px, not every 10%, and a repeat() that is not the first value (10% repeat(10px)) never snaps, while the other values in that string still do.',
  'Pressing the divider with the mouse or a finger does not focus it: the press prevents the browser\'s default action (to stop text selection), which includes focusing. Keyboard resizing needs the divider to be reached with Tab.',
  'Pressing the divider does not move it to the pointer. Only dragging moves it: the press is a mousedown or touchstart event, not a pointer event, so the first position is not applied until the pointer moves.',
  'sl-reposition is also emitted by the first update, with the default or attribute position, before any user interaction. It fires for every position change, however it was caused: dragging, the keyboard, the position and positionInPixels properties, the position attribute, and resizing the host when a primary panel is set. It does not fire when a property is set to the value it already has. A listener only sees the first one if it was attached before the element first rendered.',
  'Setting snap to a function reflects the function\'s source text into the snap attribute. Removing the attribute (or setting snap to null, undefined or an empty string) clears the snap points, and reading snap then gives an empty string.',
  'When a split panel that is hidden or has no size when it connects is first shown, a pixel position (which was divided by a size of 0 and became Infinity) is recomputed from the position-in-pixels attribute, not from the positionInPixels property. A pixel position set only through the property is therefore lost and the position becomes 0.',
  'aria-valuenow is the raw position, unrounded (for example 33.333333333333336), and a disabled divider only loses its tab stop and its handlers; it gets no aria-disabled.',
  'Enter sets the position to 0, and pressing it again restores the earlier position. The collapsed state is forgotten as soon as the position changes by any other means, so the next Enter collapses again. The arrow keys are not mirrored in right-to-left layouts.',
  'The component takes the text direction from the host\'s own dir and then the document element\'s, never from another ancestor. Inside an ancestor with dir="rtl" the grid still mirrors through CSS, but the component builds its template for left-to-right.',
  'The hidden attribute does not hide the host: its :host { display: grid } rule outranks the user agent\'s [hidden] rule, so a hidden split panel stays visible (hide it with display: none, or by hiding its container).',
  '--min and --max constrain only the primary track (the start panel when no primary is set), and the divider\'s width comes out of the space left for the other panel. With the Min & Max example, the end panel can be 146px wide at the limit, not the 150px the example\'s text promises.',
  'Every accepted arrow key is prevented, including the arrows that do not move the divider (up and down in a horizontal panel, left and right in a vertical one), so the page cannot be scrolled with them while the divider has focus.',
  'In right-to-left layout the position is measured from the left edge: the 25% track is the left-hand panel, which is the end panel, not the start panel.',
];

const gaps = [
  'Velcro builds on the core base element; there is no core split panel. It keeps the core extras, which are not part of the Shoelace contract: core\'s "ready" event (dispatched once, after the first update; it does not bubble and is not composed), and core\'s "dir" property (which resolves to the computed direction). Core\'s base styles are replaced by Shoelace\'s own shared rules, so the hidden attribute, the focus outline offset and the box-sizing of the parts behave as in Shoelace.',
  'The text direction comes from the dir attribute, not the property: Shoelace reads the host\'s dir property, which follows the attribute, but the shared localization controller reads only the attribute (core\'s dir getter resolves the computed style), so a dir set only through the property (el.dir = "rtl" without the attribute) is ignored here.',
  'The divider examples were ported before Velcro had sl-icon and use an inline svg handle instead of an <sl-icon> grip (not yet updated to use it). Velcro has no select or option components yet, so the primary-panel example uses a native <select> and a change listener instead of <sl-select> and sl-change. The Shoelace React examples are not ported.',
  'Only English is rendered: the divider\'s accessible name is "Resize". Shoelace renders the same text until a consumer registers translations, and then follows them (its French file gives "Redimensionner", its Spanish file "Cambiar el tamaño"). Velcro has no translation registry, so Shoelace\'s registerTranslation and its translation files have no counterpart and a registered translation does not change the name; this is the same gap as in sl-spinner, sl-progress-bar and sl-progress-ring. The lang property is declared as in Shoelace but changes nothing here.',
  'The public handlePositionChange, handlePositionInPixelsChange and handleVerticalChange methods and the divider property exist as in Shoelace\'s class, where they are the property watchers and a query for the divider element. They are not documented upstream and are not meant to be called.',
  'Shoelace\'s own split panel tests (17, including its axe accessibility test) run against Velcro and pass in Chromium and WebKit; they were not run in Firefox here. The product checks for this page ran in Chromium and WebKit; Firefox was not run locally.',
  'Dragging was checked with a mouse in Chromium and WebKit, and with a touch drag (injected through the DevTools protocol) in Chromium only. Pen input, touch in other engines, and pinch or inertia were not checked. No screen reader testing was done: the divider has role separator with aria-valuenow, aria-valuemin, aria-valuemax and the name Resize, and was checked by the automated axe run and keyboard tests only.',
  'Right-to-left was checked for the mirrored column order, the position measured from the left, the isRtl flag passed to a snap function and unmirrored arrow keys. The snapping arithmetic in right-to-left (the flipped snap points and repeat intervals) was not compared with Shoelace.',
  'Registration is browser-only and uses the native custom element registry for Velcro\'s own class, without changing the shared core prefix. Scope-dependent core features (declared dependencies, scope-aware templates) are not supported. Server-side rendering is not supported, and the class-only entry still loads the core base module.',
  'Rendering was checked by computed-style and geometry assertions; there is no pixel comparison against Shoelace. Both the light and dark themes exist (the dark divider colour is only checked to differ from the light one), and the theme should be loaded: the component reads --sl-color-neutral-0, --sl-color-neutral-200, --sl-color-neutral-900 and --sl-color-primary-600, without fallbacks, and the examples also use --sl-color-neutral-50, --sl-color-neutral-400, --sl-color-pink-600 and --sl-border-radius-small.',
];

@customElement('page-components-split-panel')
export class SplitPanelPage extends LitElement {
  static override styles = [shellStyles];

  override render() {
    return docsShell('split-panel', html`
      <h1>Split Panel</h1>
      <p><code>&lt;sl-split-panel&gt;</code> is registered by <code>@charm-ux/velcro</code> on top of the <code>@charm-ux/core</code> base element. Prototype status: unreleased.</p>
      <p>Split panels display two adjacent panels, allowing the user to reposition them.</p>

      <h2 id="examples">Examples</h2>
      <p>Each preview runs in its own document, so its script uses plain <code>document.querySelector</code>.</p>
      ${sections.map(
        ([id, title, key, text]) => html`
          <h3 id=${id}>${title}</h3>
          <p>${text}</p>
          <iframe class="example" title=${`Split Panel example: ${title}`} srcdoc=${exampleDocument(examples[key as keyof typeof examples])}></iframe>
          <pre><code>${examples[key as keyof typeof examples]}</code></pre>
        `
      )}

      ${apiReference('sl-split-panel', {
        attributes: html`<p>Removing a reflected attribute restores the property's initial value, as in Shoelace. <code>snap</code> takes a string or a function; the attribute can only be a string.</p>`,
        methods: html`<p>The three <code>handle…</code> methods are public as in Shoelace's class (there they are its property watchers); they are not meant to be called.</p>`,
        events: html`<p><code>sl-reposition</code> bubbles and is composed; it is not cancelable and its detail is an empty object. Core's <code>ready</code> event is not part of Shoelace: it is dispatched once on the element after its first update, does not bubble and is not composed.</p>`,
        slots: html`<p>The <code>divider</code> slot sits inside the focusable divider; give a slotted handle <code>aria-hidden</code> or a non-interactive role.</p>`,
      })}

      <h2 id="quirks">Upstream quirks matched</h2>
      <p>Velcro matches Shoelace 2.20.1 on purpose where Shoelace does something surprising, so code written for one behaves the same on the other. These are checked on this page's examples and in the product tests.</p>
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

export default SplitPanelPage;
