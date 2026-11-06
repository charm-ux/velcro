import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { definePageData } from '@beatzball/litro';
import { docsShell, shellStyles } from '../../src/shell.js';
import { themeHead } from '../../src/theme.js';
import { apiReference } from '../../src/api.js';
import { examples, exampleDocument, reactExamples } from '../../src/example.js';

export const pageData = definePageData(async () => ({
  seoTitle: 'Animation - Velcro',
  seoHead: themeHead + '<meta name="description" content="Velcro animation (prototype).">',
}));

const sections = [
  ['overview', 'Overview', 'animation/overview', 'To animate an element, wrap it in <sl-animation> and set an animation name. The animation will not start until you add the play attribute. Refer to the attributes and properties table below for a list of all animation options. The animation will only be applied to the first child element found in <sl-animation>.', 'animation/react/overview'],
  ['animations-and-easings', 'Animations & Easings', 'animation/sandbox', 'This example demonstrates all of the baked-in animations and easings. Animations are based on those found in the popular Animate.css library. Shoelace\'s example uses sl-select, sl-option and sl-input, which Velcro does not implement yet, so this one uses native select and input elements and their change and input events. As in Shoelace\'s example, the animation starts with the ease-in-out easing while the easing list shows linear.', undefined],
  ['intersection-observer', 'Using Intersection Observer', 'animation/intersection-observer', 'Use an Intersection Observer to control the animation when an element enters or exits the viewport. For example, scroll the box below in and out of your screen. The animation stops when the box exits the viewport and restarts each time it enters the viewport.', 'animation/react/intersection-observer'],
  ['custom-keyframes', 'Custom Keyframe Formats', 'animation/keyframes', 'Supply your own keyframe formats to build custom animations.', 'animation/react/keyframes'],
  ['on-demand', 'Playing Animations on Demand', 'animation/on-demand', 'Animations won\'t play until you apply the play attribute. You can omit it initially, then apply it on demand such as after a user interaction. In this example, the button will animate once every time the button is clicked.', 'animation/react/on-demand'],
] as const;

// Shoelace 2.20.1 behaviors that look like bugs but are matched exactly (candidates for a later opt-in fix). One line each.
const quirks = [
  'The animation is created when the element connects and again when its slot first reports the slotted element, so a playing animation emits sl-start twice when it is first connected (a reconnect, which has no slot change, emits it once).',
  'Each animation property that changes in one update recreates the animation once more: setting name and duration together on a playing animation emits sl-start twice.',
  'Changing iteration-start (iterationStart) after the first update does not recreate the animation, because Shoelace watches a misspelled iterationsStart. The new value applies the next time another property, the slotted element or a reconnect recreates it.',
  'finish() throws an InvalidStateError while iterations is Infinity, the default: the Web Animations API cannot finish an endless animation.',
  'Disconnecting cancels the animation without emitting sl-cancel and without clearing play, and the canceled animation is kept: currentTime reads 0 while disconnected, and a playing animation starts again from the beginning when it is reconnected.',
  'An easing or keyframes that Element.animate() rejects (an invalid easing string, or an easing named after an Object.prototype member such as toString, which the easing lookup resolves to that function) cancels the previous animation, creates none, and surfaces only as an unhandled promise rejection.',
  'name="easings" names the easings table, not an animation; it is used as keyframes that animate nothing, and getAnimationNames() leaves it out.',
  'cancel() does not clear the animation\'s effect: the cancel listener turns play off, and the next update pauses the now idle animation, which seeks it to time 0 and holds it there. The first keyframe stays applied (fadeIn leaves the element at opacity 0) and currentTime reads 0.',
  'A name with no preset (an unknown name, or none, the default), or clearing keyframes while the name has no preset, does not stop or replace the current animation: it keeps running with its previous keyframes and timing, without sl-start, and play and currentTime still control it.',
  'Assigning null to play restores the value recorded when the first observed attribute (including dir and lang) changed, which is false unless play was already true then. Removing the play attribute sets it to false.',
] as const;

const gaps = [
  'The presets are Velcro\'s own copy of @shoelace-style/animations 1.2.0, the version Shoelace 2.20.1 uses: the same 98 animations and 29 easings, unchanged (see THIRD_PARTY_NOTICES.md). No Shoelace package is a dependency.',
  'Shoelace\'s module paths map to Velcro package exports: dist/utilities/animation.js (getAnimationNames and getEasingNames) is @charm-ux/velcro/utilities/animation, and dist/components/animation/animations.js (the animations namespace and the two utilities) is @charm-ux/velcro/animation/animations. Neither registers a component or loads the core base element. As in Shoelace, the two utilities are also exported from the package root, and the animations namespace is not; @charm-ux/velcro/animation and @charm-ux/velcro/animation/class also export the utilities.',
  'The Animations & Easings example uses native select and input elements instead of sl-select, sl-option and sl-input, which Velcro does not implement yet. Its script imports the utilities from the Velcro bundle that the preview document loads, instead of Shoelace\'s /dist/utilities/animation.js. Shoelace has no React version of this example.',
  'Velcro builds on the @charm-ux/core base element (there is no core animation). The only core extension that remains is the non-bubbling ready event on first update, which the API tables label as inherited from core.',
  'dir and lang are declared as Shoelace\'s base element declares them: reactive, not reflected and undefined until set. Core\'s computed dir is not used.',
  'TypeScript types for dir are narrower than Shoelace\'s dir: string. At runtime dir is stored and returned as set, and the setter accepts any string, so element.dir = someString compiles (type-tests/animation-dir.tsx checks it). The read type stays core\'s \'ltr\' | \'rtl\' | \'auto\', because a subclass cannot widen an inherited getter\'s type, and everything generated from it follows: the manifest and the API table below, the React wrapper\'s dir prop, and the JSX dir and prop:dir types. Fixing this needs a change in @charm-ux/core and is deferred.',
  'Like Shoelace, the component does nothing for prefers-reduced-motion: a page that wants to honor it has to leave play off or choose another animation.',
  'The element is checked by product tests and by Shoelace\'s animation tests, both gated in Chromium only. The product tests also passed in WebKit in a local run that is not part of the gate. There is no Firefox check, no RTL or screen reader check, and no pixel comparison with Shoelace.',
  'Registration is browser-only and uses the native custom element registry for Velcro\'s own class, without changing the shared core prefix. Server-side rendering is not supported.',
  'The component renders nothing of its own and has no theme tokens, so it works with both themes. The examples\' boxes use --sl-color-primary-600, which both themes define.',
];

@customElement('page-components-animation')
export class AnimationPage extends LitElement {
  static override styles = [shellStyles];

  override render() {
    return docsShell('animation', html`
      <h1>Animation</h1>
      <p><code>&lt;sl-animation&gt;</code> is registered by <code>@charm-ux/velcro</code> on top of the <code>@charm-ux/core</code> base element. Prototype status: unreleased.</p>
      <p>Animate elements declaratively with nearly 100 baked-in presets, or roll your own with custom keyframes. Powered by the <a href="https://developer.mozilla.org/en-US/docs/Web/API/Web_Animations_API">Web Animations API</a>.</p>

      <h2 id="examples">Examples</h2>
      <p>Each preview runs in its own document, so its script uses plain <code>document.querySelector</code>. Four examples also have Shoelace's React version, ported to Velcro's generated React wrappers (<code>@charm-ux/velcro/react/VelcroAnimation.js</code> and <code>VelcroButton.js</code>, imported under Shoelace's names); only their import lines differ from Shoelace's. They are shown as source.</p>
      ${sections.map(
        ([id, title, key, text, react]) => html`
          <h3 id=${id}>${title}</h3>
          <p>${text}</p>
          <iframe class="example" title=${`Animation example: ${title}`} srcdoc=${exampleDocument(examples[key])}></iframe>
          <pre><code>${examples[key]}</code></pre>
          ${react
            ? html`<details class="react-example">
                <summary>React</summary>
                <pre><code>${reactExamples[react]}</code></pre>
              </details>`
            : ''}
        `
      )}

      <h2 id="utilities">Utilities</h2>
      <p><code>getAnimationNames()</code> returns the names of the baked-in animations and <code>getEasingNames()</code> the names of the baked-in easings, for example to build a picker. Import them with <code>import { getAnimationNames, getEasingNames } from '@charm-ux/velcro';</code>, or without registering anything from <code>@charm-ux/velcro/utilities/animation</code> (Shoelace's <code>dist/utilities/animation.js</code>). <code>@charm-ux/velcro/animation/animations</code> (Shoelace's <code>dist/components/animation/animations.js</code>) also exports <code>animations</code>, the namespace of every preset keyframe list plus the <code>easings</code> table.</p>

      ${apiReference('sl-animation', {
        attributes: html`<p>Only <code>play</code> reflects; it is removed when the animation finishes or is canceled. <code>keyframes</code> and <code>currentTime</code> are properties only. <code>dir</code> and <code>lang</code> are reactive properties with no default that are not reflected, as in Shoelace's base element.</p>`,
        events: html`<p>Inherited from core: a non-bubbling <code>ready</code> event on first update, which Shoelace does not have.</p>`,
        slots: html`<p>Only the first element in the default slot is animated; text and later elements are ignored.</p>`,
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

export default AnimationPage;
