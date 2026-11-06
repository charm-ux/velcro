import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { definePageData } from '@beatzball/litro';
import { docsShell, shellStyles } from '../../src/shell.js';
import { themeHead } from '../../src/theme.js';
import { apiReference } from '../../src/api.js';
import { examples, exampleDocument } from '../../src/example.js';

export const pageData = definePageData(async () => ({
  seoTitle: 'Popup - Velcro',
  seoHead: themeHead + '<meta name="description" content="Velcro popup (prototype).">',
}));

const sections = [
  ['overview', 'Overview', 'popup/basic', 'The popup is anchored to the dashed box in its anchor slot. Use the controls to change the placement, distance and skidding, to deactivate the popup and to show an arrow.'],
  ['activating', 'Activating', 'popup/activating', 'Popups are inactive and hidden until the active attribute is applied. Removing the attribute will tear down all positioning logic and listeners, meaning you can have many idle popups on the page without affecting performance.'],
  ['external-anchors', 'External Anchors', 'popup/external-anchor', 'By default, anchors are slotted into the popup using the anchor slot. If your anchor needs to live outside of the popup, you can pass the anchor\'s id to the anchor attribute. Alternatively, you can pass an element reference to the anchor property to achieve the same effect without using an id.'],
  ['placement', 'Placement', 'popup/placement', 'Use the placement attribute to tell the popup the preferred placement of the popup. Note that the actual position will vary to ensure the panel remains in the viewport if you\'re using positioning features such as flip and shift. Since placement is preferred when using flip, you can observe the popup\'s current placement when it\'s active by looking at the data-current-placement attribute. This attribute will update as the popup flips to find available space and it will be removed when the popup is deactivated.'],
  ['distance', 'Distance', 'popup/distance', 'Use the distance attribute to change the distance between the popup and its anchor. A positive value will move the popup further away and a negative value will move it closer.'],
  ['skidding', 'Skidding', 'popup/skidding', 'The skidding attribute is similar to distance, but instead allows you to offset the popup along the anchor\'s axis. Both positive and negative values are allowed.'],
  ['arrows', 'Arrows', 'popup/arrows', 'Add an arrow to your popup with the arrow attribute. It\'s usually a good idea to set a distance to make room for the arrow. To adjust the arrow\'s color and size, use the --arrow-color and --arrow-size custom properties, respectively. You can also target the arrow part to add additional styles such as shadows and borders. By default, the arrow will be aligned as close to the center of the anchor as possible, considering available space and arrow-padding. You can use the arrow-placement attribute to force the arrow to align to the start, end, or center of the popup instead.'],
  ['syncing', 'Syncing with the Anchor\'s Dimensions', 'popup/sync', 'Use the sync attribute to make the popup the same width or height as the anchor element. This is useful for controls that need the popup to stay the same width or height as the trigger.'],
  ['positioning-strategy', 'Positioning Strategy', 'popup/strategy', 'By default, the popup is positioned using an absolute positioning strategy. However, if your anchor is fixed or exists within a container that has overflow: auto|hidden, the popup risks being clipped. To work around this, you can use a fixed positioning strategy by setting the strategy attribute to fixed. The fixed positioning strategy reduces jumpiness when the anchor is fixed and allows the popup to break out containers that clip. When using this strategy, it\'s important to note that the content will be positioned relative to its containing block, which is usually the viewport unless an ancestor uses a transform, perspective, or filter. In this example, you can see how the popup breaks out of the overflow container when it\'s fixed. The fixed positioning strategy tends to be less performant than absolute, so avoid using it unnecessarily. Toggle the switch and scroll the container to see the difference.'],
  ['flip', 'Flip', 'popup/flip', 'When the popup doesn\'t have enough room in its preferred placement, it can automatically flip to keep it in view. To enable this, use the flip attribute. By default, the popup will flip to the opposite placement, but you can configure preferred fallback placements using flip-fallback-placements and flip-fallback-strategy. Scroll the container to see how the popup flips to prevent clipping.'],
  ['flip-fallbacks', 'Flip Fallbacks', 'popup/flip-fallbacks', 'While using the flip attribute, you can customize the placement of the popup when the preferred placement doesn\'t have room. For this, use flip-fallback-placements and flip-fallback-strategy. If the preferred placement doesn\'t have room, the first suitable placement found in flip-fallback-placement will be used. The value of this attribute must be a string including any number of placements separated by a space, e.g. "right bottom". If no fallback placement works, the final placement will be determined by flip-fallback-strategy. This value can be either initial (default), where the placement reverts to the position in placement, or best-fit, where the placement is chosen based on available space. Scroll the container to see how the popup changes it\'s fallback placement to prevent clipping.'],
  ['shift', 'Shift', 'popup/shift', 'When a popup is longer than its anchor, it risks being clipped by an overflowing container. In this case, use the shift attribute to shift the popup along its axis and back into view. You can customize the shift behavior using shiftBoundary and shift-padding. Toggle the checkbox to see the difference.'],
  ['auto-size', 'Auto-size', 'popup/auto-size', 'Use the auto-size attribute to tell the popup to resize when necessary to prevent it from getting clipped. Possible values are horizontal, vertical, and both. One or both of --auto-size-available-width and --auto-size-available-height are then set on the host; since they cascade, the content can use them as its maximum size. Scroll the container to see the popup resize as its available space changes.'],
  ['hover-bridge', 'Hover Bridge', 'popup/hover-bridge', 'When a gap exists between the anchor and the popup element, the hover-bridge option adds an invisible element that fills the gap, so the pointer never technically leaves the element. It is only drawn while the popup is active. For demonstration purposes, the bridge in this example is shown in orange.'],
  ['virtual-elements', 'Virtual Elements', 'popup/virtual-element', 'A popup can be anchored to a non-element by passing a VirtualElement, an object with a getBoundingClientRect() function, to the anchor property. This example anchors a popup to the mouse cursor, so a mouse is required to view it.'],
] as const;

// Shoelace 2.20.1 behaviors that look like bugs but are matched exactly (candidates for a later opt-in fix). One line each.
const quirks = [
  'sl-reposition is dispatched when a reposition starts, before the new position is computed and applied, so a listener still sees the previous position and data-current-placement.',
  'The documented default of --arrow-color is var(--sl-color-neutral-0), but the stylesheet sets var(--sl-color-neutral-1000), so the arrow is black in the light theme unless the property is set.',
  'Setting flipFallbackPlacements as a property passes the string to Floating UI unchanged; only the flip-fallback-placements attribute is split into an array of placements.',
  'Setting active to false and back to true before the element updates starts a second auto-update without stopping the first: both keep calling reposition(), so sl-reposition fires twice per trigger, and deactivating stops only the second (the other then returns early while inactive and resumes when the popup is activated again).',
  'Removing the placement or strategy attribute sets the property back to the value it had at the first change to any observed attribute, which is normally the reflected default; a placement assigned before the element first updates is recorded instead, so removing its attribute brings that placement back (and reflects it again) rather than top.',
] as const;

const gaps = [
  'The component extends the core base element, not the core popup. The core popup is a dismissible surface (open, Escape and scroll dismissal, focus trapping, popup-* events) whose anchor, placement and reposition() types cannot be replaced with Shoelace\'s in a subclass without invalid type declarations. Its Floating UI calls are reused: middleware, positioning and auto-update are created through the core popup\'s own methods, so Velcro adds no Floating UI dependency of its own.',
  'Floating UI is the copy the core popup ships (1.8.0, with @floating-ui/utils 0.2.12); Shoelace 2.20.1 allows ^1.6.12 and locks 1.6.12 (utils 0.2.8). Core starts the Floating UI computation one microtask after reposition() is called, where Shoelace starts it synchronously. The only value Floating UI reads synchronously, the popup\'s direction, is sampled where Shoelace reads it, so an sl-reposition listener that changes the direction affects the next position, as in Shoelace; element sizes and positions are read after any listener has run in both. sl-reposition is dispatched synchronously, as in Shoelace.',
  'For the absolute strategy, Shoelace finds the offset parent with the composed-offset-position polyfill, so a popup slotted into a shadow tree is positioned against the positioned element around the slot rather than one around the host. Velcro uses the same lookup (adapted from composed-offset-position 0.0.6, with isContainingBlock from @floating-ui/utils 0.2.12): while a computation runs, the popup and arrow elements answer offsetParent with it, which is how Floating UI reads it. Reading popup.offsetParent during that window (for example in an sl-reposition listener) also gets the composed result.',
  'As in Shoelace, dir and lang are plain reactive properties (undefined unless set, not reflected). The arrow\'s start and end placements follow the dir property, else the document\'s dir, else ltr.',
  'The component dispatches core\'s non-bubbling "ready" event on first update, a Velcro extension that Shoelace\'s manifest for this component does not list; the API table labels it as inherited from core. Core\'s base styles are not used.',
  'The Shoelace documentation examples use sl-select, sl-input and sl-range, which Velcro does not have yet; the ported examples use native select, number and range inputs instead, and sl-switch as in Shoelace. Each example\'s React variant is not shown; React usage is shown once below.',
  'Positioning was checked in Chromium only: each placement, distance and skidding, the arrow in each arrow-placement and direction, sync, the fixed strategy, the absolute strategy against a positioned element around a shadow slot, flip, flip fallbacks, shift, auto-size, the hover bridge, id, element, slot and virtual anchors, activation, every example, the React wrapper, and the quirks above. Firefox and WebKit, transformed or zoomed containers and nested scroll containers were not tested.',
  'The popup has no role and exposes nothing to assistive technology. As in Shoelace, it does not facilitate an accessible experience by itself; no screen reader testing was done.',
  'Registration is browser-only and uses the native custom element registry for Velcro\'s own class, without changing the shared core prefix. Scope-dependent core features are not supported. Server-side rendering is not supported.',
  'Shoelace\'s own popup tests run against Velcro and pass (they check that the element renders and that toggling active around a window scroll does not throw).',
];

const reactUsage = `import { useState } from 'react';
import { VelcroPopup as SlPopup } from '@charm-ux/velcro/react';

const App = () => {
  const [active, setActive] = useState(true);
  return (
    <SlPopup placement="top" distance={8} arrow arrowPlacement="anchor" active={active}>
      <span slot="anchor" onClick={() => setActive(!active)}>Anchor</span>
      <div className="box"></div>
    </SlPopup>
  );
};`;

@customElement('page-components-popup')
export class PopupPage extends LitElement {
  static override styles = [shellStyles];

  override render() {
    return docsShell('popup', html`
      <h1>Popup</h1>
      <p><code>&lt;sl-popup&gt;</code> is registered by <code>@charm-ux/velcro</code> on top of the <code>@charm-ux/core</code> base element, positioned with the Floating UI calls of the <code>@charm-ux/core</code> popup. Prototype status: unreleased.</p>
      <p>Popup is a utility that lets you declaratively anchor "popup" containers to another element. It uses <a href="https://floating-ui.com/">Floating UI</a> under the hood to provide a well-tested, lightweight, and fully declarative positioning utility for tooltips, dropdowns, and more.</p>
      <p>Popup doesn't provide any styles — just positioning! The popup's preferred placement, distance, and skidding (offset) can be configured using attributes. An arrow that points to the anchor can be shown and customized to your liking.</p>
      <p><strong>Popup is a low-level utility built specifically for positioning elements. Do not mistake it for a tooltip or similar because it does not facilitate an accessible experience!</strong> Almost every correct usage of <code>&lt;sl-popup&gt;</code> will involve building other components. It should rarely, if ever, occur directly in your HTML.</p>

      <h2 id="examples">Examples</h2>
      <p>Each preview runs in its own document, so its script uses plain <code>document.querySelector</code>. Activate a popup with the <code>active</code> attribute; removing it tears the positioning logic down and hides the popup. Once the positioning engine has placed the popup, its current placement is set on the host as <code>data-current-placement</code>.</p>
      ${sections.map(
        ([id, title, key, text]) => html`
          <h3 id=${id}>${title}</h3>
          <p>${text}</p>
          <iframe class="example" title=${`Popup example: ${title}`} srcdoc=${exampleDocument(examples[key])}></iframe>
          <pre><code>${examples[key]}</code></pre>
        `
      )}

      ${apiReference('sl-popup', {
        attributes: html`<p>Removing a boolean attribute sets its property back to <code>false</code>. As in Shoelace, only <code>active</code>, <code>placement</code> and <code>strategy</code> reflect. <code>anchor</code> accepts an element id as an attribute, or an element or <code>VirtualElement</code> as a property. <code>flipBoundary</code>, <code>shiftBoundary</code> and <code>autoSizeBoundary</code> take elements and are meant to be set as properties. Any change while the popup is active repositions it.</p>`,
        events: html`<p><code>sl-reposition</code> bubbles, is composed and can fire a lot; see the upstream quirks below for when it fires. Inherited from core: a non-bubbling <code>ready</code> event on first update, which Shoelace does not have.</p>`,
        slots: html`<p>The host is <code>display: contents</code>. The popup container is hidden unless <code>active</code> is set.</p>`,
      })}

      <h2 id="upstream-quirks">Upstream quirks matched</h2>
      <p>Velcro matches Shoelace 2.20.1 exactly, including behavior that looks like a bug. Each of these is covered by a product test and is a candidate for a later opt-in fix.</p>
      <ul>
        ${quirks.map(q => html`<li>${q}</li>`)}
      </ul>

      <h2 id="react">React</h2>
      <p>The React wrapper sets every prop as the element property, as Shoelace's wrappers do, and maps <code>onSlReposition</code> to the <code>sl-reposition</code> event.</p>
      <pre><code>${reactUsage}</code></pre>

      <h2 id="not-implemented">Not implemented or unverified</h2>
      <p>Velcro extensions and limits of what has been checked.</p>
      <ul>
        ${gaps.map(g => html`<li>${g}</li>`)}
      </ul>
    `);
  }
}

export default PopupPage;
