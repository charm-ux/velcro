import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { definePageData } from '@beatzball/litro';
import { docsShell, shellStyles } from '../../src/shell.js';
import { themeHead } from '../../src/theme.js';
import { withBase } from '../../src/base.js';
import { apiReference } from '../../src/api.js';
import { examples, exampleDocument, reactExamples } from '../../src/example.js';

export const pageData = definePageData(async () => ({
  seoTitle: 'Carousel - Velcro',
  seoHead: themeHead + '<meta name="description" content="Velcro carousel (prototype).">',
}));

// Shoelace's examples, in the order of its page: [id, title, text, example key, React example key]. The first has no heading in
// Shoelace's page; it is the page's opening example. Every example is live and has a React version.
const sections = [
  ['basic', 'Default', null, 'carousel/basic', 'carousel/react/basic'],
  ['pagination', 'Pagination', html`Use the <code>pagination</code> attribute to show the total number of slides and the current slide as a set of interactive dots.`, 'carousel/pagination', 'carousel/react/pagination'],
  ['navigation', 'Navigation', html`Use the <code>navigation</code> attribute to show previous and next buttons.`, 'carousel/navigation', 'carousel/react/navigation'],
  ['loop', 'Looping', html`By default, the carousel will not advanced beyond the first and last slides. You can change this behavior and force the carousel to "wrap" with the <code>loop</code> attribute.`, 'carousel/loop', 'carousel/react/loop'],
  ['autoplay', 'Autoplay', html`The carousel will automatically advance when the <code>autoplay</code> attribute is used. To change how long a slide is shown before advancing, set <code>autoplay-interval</code> to the desired number of milliseconds. For best results, use the <code>loop</code> attribute when autoplay is enabled. Note that autoplay will pause while the user interacts with the carousel.`, 'carousel/autoplay', 'carousel/react/autoplay'],
  ['mouse-dragging', 'Mouse Dragging', html`The carousel uses <a href="https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Scroll_Snap">scroll snap</a> to position slides at various snap positions. This allows users to scroll through the slides very naturally, especially on touch devices. Unfortunately, desktop users won't be able to click and drag with a mouse, which can feel unnatural. Adding the <code>mouse-dragging</code> attribute can help with this. This example is best demonstrated using a mouse. Try clicking and dragging the slide to move it. Then toggle the switch and try again.`, 'carousel/mouse-dragging', 'carousel/react/mouse-dragging'],
  ['slides-per-page', 'Multiple Slides Per View', html`The <code>slides-per-page</code> attribute makes it possible to display multiple slides at a time. You can also use the <code>slides-per-move</code> attribute to advance more than once slide at a time, if desired.`, 'carousel/slides-per-page', 'carousel/react/slides-per-page'],
  ['dynamic', 'Adding and Removing Slides', html`The content of the carousel can be changed by adding or removing carousel items. The carousel will update itself automatically.`, 'carousel/dynamic', 'carousel/react/dynamic'],
  ['vertical', 'Vertical Scrolling', html`Setting the <code>orientation</code> attribute to <code>vertical</code> will render the carousel in a vertical layout. If the content of your slides vary in height, you will need to set amn explicit <code>height</code> or <code>max-height</code> on the carousel using CSS.`, 'carousel/vertical', 'carousel/react/vertical'],
  ['aspect-ratio', 'Aspect Ratio', html`Use the <code>--aspect-ratio</code> custom property to customize the size of the carousel's viewport from the default value of 16/9.`, 'carousel/aspect-ratio', 'carousel/react/aspect-ratio'],
  ['scroll-hint', 'Scroll Hint', html`Use the <code>--scroll-hint</code> custom property to add inline padding in horizontal carousels and block padding in vertical carousels. This will make the closest slides slightly visible, hinting that there are more items in the carousel.`, 'carousel/scroll-hint', 'carousel/react/scroll-hint'],
  ['gallery', 'Gallery Example', html`The carousel has a robust API that makes it possible to extend and customize. This example syncs the active slide with a set of thumbnails, effectively creating a gallery-style carousel.`, 'carousel/gallery', 'carousel/react/gallery'],
] as const;

// Shoelace 2.20.1 behaviors that look like bugs but are matched exactly (candidates for a later opt-in fix). One line each.
const quirks = [
  'The hidden attribute does not hide the carousel: the host\'s own display: flex outranks the browser\'s [hidden] rule, so it stays displayed. Core\'s own base styles would hide it, so they are replaced by Shoelace\'s.',
  'On every connect the host gets role="region" and aria-label set to the localized "Carousel", replacing a role or label the page gave it.',
  'The carousel writes accessibility attributes onto its slides and overwrites the page\'s: every slide gets role="group" and a localized aria-label ("Slide 1"); with pagination each slide instead gets id="slide-<n>", role="tabpanel" and aria-labelledby="tab-<n>" and loses its aria-label, so an id the page gave a slide is replaced. As slides scroll in and out of view, aria-hidden and the inert attribute are rewritten from what is visible (a visible slide gets aria-hidden="false").',
  'The pagination buttons\' aria-controls="slide-<n>" and the slides\' aria-labelledby="tab-<n>" cannot be resolved: the buttons are in the carousel\'s shadow tree and the slides in the page, so an ID reference crosses a shadow boundary. Shoelace\'s own accessibility test ignores the aria-valid-attr-value rule for this reason. The slide ids are also shared by every carousel on the page that uses pagination, and the clones that loop adds repeat them.',
  'The pagination buttons are role="tab" in a role="tablist", but only the active one is a tab stop, and the arrow keys change slides rather than moving focus between tabs; focus is moved to the new active button after the render.',
  'Looping adds clones of the first and last slides to the carousel as real children, marked data-clone, so children, querySelectorAll("sl-carousel-item") and anything else that walks the carousel sees them. They are removed and added again whenever the carousel is initialized.',
  'The previous and next buttons are not disabled when they cannot scroll: they get aria-disabled="true", a class that dims them (opacity and a not-allowed cursor) and no click handler, and they stay focusable.',
  'No slide has the --is-active class after the first render: initializing the slides clears it and the active slide has not changed, so the class appears only once the active slide changes (it is then on the active slide only).',
  'No reflected attribute is restored when it is removed: Shoelace\'s base element restores a reflected property from its willUpdate, but the carousel overrides willUpdate without calling it, so setting loop, navigation, pagination, autoplay or mouse-dragging to null leaves the property null (it is falsy, and the attribute is removed).',
  'slides-per-move is lowered to slides-per-page whenever either of them changes and is never raised again: with both 3, setting slides-per-page to 2 lowers slides-per-move to 2, and setting slides-per-page back to 3 leaves it at 2.',
  'Autoplay is only (re)started when the autoplay property changes: changing autoplay-interval while it runs keeps the old timer, and a carousel that is removed and added again (moved in the document) stays stopped for good although autoplay is still set, because disconnecting stops the timer.',
] as const;

const gaps = [
  'All twelve of Shoelace\'s examples (the opening one, Pagination, Navigation, Looping, Autoplay, Mouse Dragging, Multiple Slides Per View, Adding and Removing Slides, Vertical Scrolling, Aspect Ratio, Scroll Hint and Gallery Example) are ported with a live preview and a React version, in Shoelace\'s order. The examples use inline placeholder images (SVG data: URLs drawn for Velcro) where Shoelace\'s use photos from Unsplash, so the docs site ships no photographs and makes no third-party request; their labels describe the placeholders.',
  'The React examples import Velcro\'s generated wrappers (@charm-ux/velcro/react/VelcroCarousel.js and the others) under Shoelace\'s names. Several of Shoelace\'s React examples do not run as written, and the ported ones fix only that: the Adding and Removing Slides example had a syntax error in its style prop, no SlButton import and an undefined getRandomColor (it now takes the next color from the list, and numbers slides from 1 as the HTML example does); the Aspect Ratio example rendered a style element from an undefined css value (removed) and its options did not match the initial value (they are now 1/1, 3/2 and 16/9 as in the HTML example); the Gallery example had syntax errors in its map calls and a double dot, a missing useState and useEffect import, an event handler reading e instead of event, class instead of className, and refs that were never attached (all fixed; keys added); and unused imports (SlDivider, SlRange) were removed. Nothing else differs.',
  'Velcro builds sl-carousel and sl-carousel-item on the @charm-ux/core base element: core has no carousel component, so there is no core model to keep or switch off. The only core extension is the non-bubbling ready event on first update.',
  'The navigation buttons draw an sl-icon, as in Shoelace. The registering entry (@charm-ux/velcro/carousel or the package root) registers Velcro\'s sl-icon up front when that tag is free, and constructing the class-only export defines it too. sl-carousel-item is a separate entry that you import too, as in Shoelace.',
  'Like Shoelace, importing the carousel applies Shoelace\'s scrollend polyfill: where the browser has no native scrollend event, adding a scrollend listener to any event target is patched to dispatch one after scrolling stops. It is the tab group\'s copy of the module, which is listed in the package\'s sideEffects so bundlers keep it.',
  'The public scrollContainer, paginationContainer, activeSlide, scrolling and dragging fields and the initializeSlides(), handleSlideChange(), updateSlidesSnap() and handleAutoplayChange() methods exist as in Shoelace, where they are public but undocumented; the API tables below list them without a description.',
  'Shoelace\'s SlSlideChangeEvent type and its GlobalEventHandlersEventMap entry for sl-slide-change are provided: the type is exported from @charm-ux/velcro, @charm-ux/velcro/carousel and its class entry (its slide is a VelcroCarouselItem, the SlCarouselItem alias), and the event map entry types addEventListener(\'sl-slide-change\', ...) on any element.',
  'dir and lang are declared as Shoelace\'s base element declares them: reactive, not reflected and undefined until set. Core\'s computed dir is not used. TypeScript types for dir are narrower than Shoelace\'s dir: string: at runtime dir is stored and returned as set, and the setter accepts any string. A carousel resolves its direction from its own dir, else the document\'s, as Shoelace does.',
  'Shoelace\'s own carousel test (35 tests, 2 of which upstream skips: autoplay advancing, which upstream notes hangs the test runner, and mouse dragging) and its carousel item test are vendored unchanged and pass in Chromium. The product tests cover what those skipped tests would: autoplay advancing and pausing, and dragging with the mouse.',
  'The product test suite is configured for Chromium, Firefox and WebKit; this component\'s spec was run locally in Chromium and WebKit only, and Firefox is covered only by the project\'s CI run. Touch scrolling, the Safari scroll-position workaround in the drag code, assistive technology, right-to-left languages other than a dir="rtl" check and the dark theme have not been tried by hand, and no pixel comparison with Shoelace was made.',
  'In the WebKit build Playwright ships, pointer events report no movement, so Shoelace\'s mouse dragging, which scrolls by the pointer\'s movementX, does not move the carousel there (it still enters and leaves the dragging state, restores the snapping and prevents the click that ends the drag); and requestAnimationFrame does not run in an out-of-view frame, so a carousel whose frame loaded below the fold, scrolling from a frame callback, starts at the wrong slide until it is initialized again. Both are Shoelace\'s code running unchanged; the product spec follows what the engine reports and loads each example frame again once it is in view.',
  'Registration is browser-only and uses the native custom element registry for Velcro\'s own class, without changing the shared core prefix. Server-side rendering is not supported.',
  'The carousel reads these theme tokens: --sl-spacing-small, --sl-spacing-medium, --sl-spacing-x-small, --sl-border-radius-small, --sl-border-radius-circle, --sl-font-size-x-large, --sl-color-neutral-300, --sl-color-neutral-600, --sl-color-neutral-700, --sl-transition-medium, --sl-focus-ring and --sl-focus-ring-offset; both Velcro themes define them (the examples also use --sl-color-<hue>-200 and --sl-font-size-2x-large). Color contrast has not been audited.',
];

@customElement('page-components-carousel')
export class CarouselPage extends LitElement {
  static override styles = [shellStyles];

  override render() {
    return docsShell('carousel', html`
      <h1>Carousel</h1>
      <p><code>&lt;sl-carousel&gt;</code> is registered by <code>@charm-ux/velcro</code> on top of the <code>@charm-ux/core</code> base element. Prototype status: unreleased.</p>
      <p>Carousels display an arbitrary number of content slides along a horizontal or vertical axis.</p>
      <p>Carousels make use of <a href=${withBase('/components/carousel-item')}>carousel items</a>, one per slide, as direct children.</p>

      <h2 id="examples">Examples</h2>
      <p>Each preview runs in its own document, so its script uses plain <code>document.querySelector</code>. The React version of each live example is Shoelace's, ported to Velcro's generated React wrappers; only its import lines differ, apart from the corrections listed at the end of this page. It is shown as source, under the HTML source.</p>
      ${sections.map(
        ([id, title, text, key, react]) => html`
          <h3 id=${id}>${title}</h3>
          ${text === null ? '' : html`<p>${text}</p>`}
          <iframe class="example" title=${`Carousel example: ${title}`} srcdoc=${exampleDocument(examples[key])}></iframe>
          <pre><code>${examples[key]}</code></pre>
          <details class="react-example">
            <summary>React</summary>
            <pre><code>${reactExamples[react]}</code></pre>
          </details>
        `
      )}

      ${apiReference('sl-carousel', {
        attributes: html`<p>The Boolean attributes <code>loop</code>, <code>navigation</code>, <code>pagination</code>, <code>autoplay</code> and <code>mouse-dragging</code> are reflected; nothing is restored when one is removed (see the quirks below). <code>slides-per-move</code> cannot be higher than <code>slides-per-page</code>: it is lowered to it whenever either changes. <code>dir</code> and <code>lang</code> are reactive properties with no default that are not reflected, as in Shoelace's base element.</p>`,
        methods: html`<p><code>previous()</code> and <code>next()</code> move by <code>slides-per-move</code> slides, and <code>goToSlide(index)</code> scrolls to a slide; each takes an optional scroll behavior, <code>'smooth'</code> by default, and uses <code>'auto'</code> when the user prefers reduced motion. Without <code>loop</code> the index is clamped so that the last page is full; with it, it wraps around. They do nothing when the carousel has no slides.</p>`,
        events: html`<p><code>sl-slide-change</code> bubbles, is composed and is not cancelable; its <code>detail</code> is <code>{ index, slide }</code>, the new active index (clones are not counted) and its <code>sl-carousel-item</code>. It is not emitted for the first render. Inherited from core: a non-bubbling <code>ready</code> event on first update, which Shoelace does not have.</p>`,
        slots: html`<p>Slides go in the default slot, as <code>sl-carousel-item</code> elements; other children are displayed in the scroll container but are not slides. <code>previous-icon</code> and <code>next-icon</code> replace the default chevrons (an <code>sl-icon</code> in the system library, which follows the direction).</p>`,
        parts: html`<p><code>base</code> is the grid that holds the <code>scroll-container</code> (the focusable, scrollable region around the slides), the <code>navigation</code> wrapper with its <code>navigation-button</code> parts (and <code>navigation-button--previous</code> and <code>navigation-button--next</code>) and the <code>pagination</code> wrapper with one <code>pagination-item</code> per page, the active one also <code>pagination-item--active</code>.</p>`,
      })}

      <h2 id="keyboard">Keyboard</h2>
      <p>As in Shoelace: with focus in the scroll container or on a pagination button, <kbd>Right</kbd> and <kbd>Down</kbd> go to the next page and <kbd>Left</kbd> and <kbd>Up</kbd> to the previous one (<kbd>Left</kbd> is next and <kbd>Right</kbd> previous when the direction is right-to-left), by <code>slides-per-move</code> slides; <kbd>Home</kbd> and <kbd>End</kbd> go to the first and last slide. These keys are always prevented, even where nothing moves. When focus is on a pagination button, it follows to the new active button. The scroll container and the pagination buttons are in the tab order (only the active pagination button); the navigation buttons are buttons and respond to <kbd>Enter</kbd> and <kbd>Space</kbd>.</p>

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

export default CarouselPage;
