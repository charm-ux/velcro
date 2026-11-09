import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { definePageData } from '@beatzball/litro';
import { docsShell, shellStyles } from '../../src/shell.js';
import { themeHead } from '../../src/theme.js';
import { apiReference } from '../../src/api.js';
import { examples, exampleDocument, reactExamples } from '../../src/example.js';

export const pageData = definePageData(async () => ({
  seoTitle: 'Rating - Velcro',
  seoHead: themeHead + '<meta name="description" content="Velcro rating (prototype).">',
}));

// Shoelace's examples, in the order of its page: [id, heading, text, example key, React example key]. The first has no
// heading in Shoelace's page (it is the page's opening example).
const sections = [
  ['basic', 'Default', null, 'rating/basic', 'rating/react/basic'],
  ['labels', 'Labels', html`Ratings are commonly identified contextually, so labels aren't displayed. However, you should always provide one for assistive devices using the <code>label</code> attribute.`, 'rating/labels', 'rating/react/labels'],
  ['max', 'Maximum Value', html`Ratings are 0-5 by default. To change the maximum possible value, use the <code>max</code> attribute.`, 'rating/max', 'rating/react/max'],
  ['precision', 'Precision', html`Use the <code>precision</code> attribute to let users select fractional ratings.`, 'rating/precision', 'rating/react/precision'],
  ['symbol-sizes', 'Symbol Sizes', html`Set the <code>--symbol-size</code> custom property to adjust the size.`, 'rating/symbol-sizes', 'rating/react/symbol-sizes'],
  ['readonly', 'Readonly', html`Use the <code>readonly</code> attribute to display a rating that users can't change.`, 'rating/readonly', 'rating/react/readonly'],
  ['disabled', 'Disabled', html`Use the <code>disable</code> attribute to disable the rating.`, 'rating/disabled', 'rating/react/disabled'],
  ['detect-hover', 'Detecting Hover', html`Use the <code>sl-hover</code> event to detect when the user hovers over (or touch and drag) the rating. This lets you hook into values as the user interacts with the rating, but before they select a value.`, 'rating/detect-hover', 'rating/react/detect-hover'],
  ['custom-icons', 'Custom Icons', html`You can provide custom icons by passing a function to the <code>getSymbol</code> property.`, 'rating/custom-icons', 'rating/react/custom-icons'],
  ['value-based-icons', 'Value-based Icons', html`You can also use the <code>getSymbol</code> property to render different icons based on value.`, 'rating/value-based-icons', 'rating/react/value-based-icons'],
] as const;
const untitled = new Set<string>(['basic']);
// Sections whose Shoelace text has a second paragraph.
const more: Record<string, ReturnType<typeof html>> = {
  'detect-hover': html`The event has a payload with <code>phase</code> and <code>value</code> properties. The <code>phase</code> property tells when hovering starts, moves to a new value, and ends. The <code>value</code> property tells what the rating's value would be if the user were to commit to the hovered value.`,
};

// Shoelace 2.20.1 behaviors that look like bugs but are matched exactly (candidates for a later opt-in fix). One line each.
const quirks = [
  'Connecting a rating emits sl-hover twice without any pointer (phase "end", then phase "move", both with value 0), because Shoelace\'s watchers also run in the first update. A listener attached before the rating is defined, as in the Detecting Hover example, receives both, so that example shows "No rating" until the pointer first leaves the rating.',
  'A click on a readonly rating leaves the value unchanged but still emits sl-change. A disabled rating emits none on click.',
  'The end of a touch emits sl-change even when the rating is disabled or readonly (the value is unchanged).',
  'Hovering a disabled or readonly rating still emits sl-hover (start, move and end); the symbols keep showing the rating\'s own value.',
  'The label defaults to an empty string and is always rendered, so without a label the slider has aria-label="" and no accessible name.',
  'value, max and precision are not reflected, and removing their attribute sets the property to null rather than its default.',
  'getSymbol is declared as a property with an attribute (getsymbol); setting that attribute replaces the function with a string, and the next render throws.',
  'The arrow keys bound each step on one side only: a decrement stops at 0 and an increment at max. A value set out of range from script moves one step and stays out of range (with max 5, value 10 and ArrowDown give 9; value -2 and ArrowUp give -1), each emitting sl-change and rendered as aria-valuenow.',
  'The keyboard and pointer direction follows the rating\'s own dir property, else the document\'s; with dir="auto", ArrowLeft and ArrowRight do nothing (ArrowUp and ArrowDown still work) and the pointer reads the symbols left to right.',
] as const;

const gaps = [
  'All of Shoelace\'s examples are ported with a live preview and a React version, in Shoelace\'s order. The React examples import Velcro\'s generated wrapper (@charm-ux/velcro/react/VelcroRating.js) under Shoelace\'s name; nothing else differs. Shoelace\'s React version of Detecting Hover is ported as it is: its handler refers to rating and setFeedback, which are not defined where it runs, so every sl-hover event (including the two emitted on connect) throws a ReferenceError and the feedback never shows.',
  'Velcro builds sl-rating on the @charm-ux/core base element, because @charm-ux/core has no rating. The only core extension that remains is the non-bubbling ready event on first update, which the API tables label as inherited from core. Core\'s base styles are replaced by Shoelace\'s.',
  'The label is not localized: Shoelace 2.20.1 has no translation term for the rating, and the label is passed to aria-label as given. The localization controller is kept only so that a change of the document\'s direction re-renders the rating.',
  'The public rating field (the base element) and the handleHoverValueChange and handleIsHoveringChange methods exist as in Shoelace, which lists them in its manifest without a description; the API tables below list them too.',
  'dir and lang are declared as Shoelace\'s base element declares them: reactive, not reflected and undefined until set. Core\'s computed dir is not used. TypeScript types for dir are narrower than Shoelace\'s dir: string: at runtime dir is stored and returned as set and the setter accepts any string, but the read type stays core\'s \'ltr\' | \'rtl\' | \'auto\', because a subclass cannot widen an inherited getter\'s type. Fixing this needs a change in @charm-ux/core and is deferred.',
  'The product test suite is configured for Chromium, Firefox and WebKit; this component\'s spec was run locally in Chromium and WebKit only, and Firefox is covered only by the project\'s CI run. Shoelace\'s own rating test (11 tests, including its axe accessibility check) runs in Chromium only and passes. The accessibility-tree check is Playwright\'s ARIA snapshot, which Playwright computes from the DOM; no screen reader and no browser accessibility API was tried. Touch handling is ported from Shoelace but checked only with synthetic touch events, not on a touch device; there is no pixel comparison with Shoelace.',
  'Registration is browser-only and uses the native custom element registry for Velcro\'s own class, without changing the shared core prefix. Server-side rendering is not supported.',
  'Rendering under the dark theme has not been checked, and color contrast was not evaluated.',
];

@customElement('page-components-rating')
export class RatingPage extends LitElement {
  static override styles = [shellStyles];

  override render() {
    return docsShell('rating', html`
      <h1>Rating</h1>
      <p><code>&lt;sl-rating&gt;</code> is registered by <code>@charm-ux/velcro</code> on top of the <code>@charm-ux/core</code> base element. Prototype status: unreleased.</p>
      <p>Ratings give users a way to quickly view and provide feedback.</p>

      <h2 id="examples">Examples</h2>
      <p>Each preview runs in its own document. The React version of each example is Shoelace's, ported to Velcro's generated React wrapper; only its import line differs. It is shown as source.</p>
      ${sections.map(
        ([id, title, text, key, react]) => html`
          ${untitled.has(id) ? '' : html`<h3 id=${id}>${title}</h3>`}
          ${text === null ? '' : html`<p>${text}</p>`}
          ${id in more ? html`<p>${more[id]}</p>` : ''}
          <iframe class="example" title=${`Rating example: ${title}`} srcdoc=${exampleDocument(examples[key])}></iframe>
          <pre><code>${examples[key]}</code></pre>
          <details class="react-example">
            <summary>React</summary>
            <pre><code>${reactExamples[react]}</code></pre>
          </details>
        `
      )}

      ${apiReference('sl-rating', {
        attributes: html`<p><code>readonly</code> and <code>disabled</code> are reflected; the others are not. <code>label</code> defaults to an empty string, which is still rendered as the slider's <code>aria-label</code>. <code>value</code> is not clamped or rounded when set. The pointer selects a value between 0 and <code>max</code>; the arrow keys bound each step on one side only (see the quirks below). Setting <code>readonly</code> or <code>disabled</code> to null or undefined restores its initial value, as in Shoelace's base element (which records the initial values on the element's first attribute change, so a rating that never had an attribute keeps the null). <code>getSymbol</code> returns trusted HTML that is rendered unescaped; the default is a system <code>star-fill</code> <code>sl-icon</code>. <code>dir</code> and <code>lang</code> are reactive properties with no default that are not reflected, as in Shoelace's base element; a right-to-left direction flips the partial symbols, the pointer and the arrow keys.</p>`,
        methods: html`<p><code>focus()</code> and <code>blur()</code> focus and blur the <code>base</code> element, which has <code>tabindex="0"</code> (<code>-1</code> when disabled or readonly).</p>`,
        events: html`<p><code>sl-change</code> and <code>sl-hover</code> bubble and are composed. ArrowRight and ArrowUp raise the value by <code>precision</code> (by 1 with Shift), ArrowLeft and ArrowDown lower it (the left and right arrows swap in right-to-left), Home sets 0 and End sets <code>max</code>; each key that changes the value emits <code>sl-change</code>. A click sets the hovered value (or 0 when it equals the current value) and emits <code>sl-change</code>; setting <code>value</code> from script emits nothing. Inherited from core: a non-bubbling <code>ready</code> event on first update, which Shoelace does not have.</p>`,
        parts: html`<p>The <code>base</code> part is the <code>role="slider"</code> element with <code>aria-valuenow</code>, <code>aria-valuemin="0"</code> and <code>aria-valuemax</code>.</p>`,
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

export default RatingPage;
