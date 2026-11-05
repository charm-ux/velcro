import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { definePageData } from '@beatzball/litro';
import { docsShell, shellStyles } from '../../src/shell.js';
import { themeHead } from '../../src/theme.js';
import { apiReference } from '../../src/api.js';
import { examples, exampleDocument } from '../../src/example.js';

export const pageData = definePageData(async () => ({
  seoTitle: 'Skeleton - Velcro',
  seoHead: themeHead + '<meta name="description" content="Velcro skeleton (prototype).">',
}));

const sections: Array<[string, string, string, string]> = [
  ['overview', 'Overview', 'skeleton/basic', 'Skeletons are simple containers for scaffolding layouts that mimic what users will see when content has finished loading. Use more than one to build the arrangement you want.'],
  ['effects', 'Effects', 'skeleton/effects', 'There are two built-in effects, sheen and pulse. Effects are intentionally subtle. The default is none, a static skeleton.'],
  ['paragraphs', 'Paragraphs', 'skeleton/paragraphs', 'Use multiple skeletons and some styles to simulate paragraphs.'],
  ['avatars', 'Avatars', 'skeleton/avatars', 'Set a matching width and height to make a circle, square or rounded avatar skeleton.'],
  ['shapes', 'Custom shapes', 'skeleton/shapes', 'Use the --border-radius custom property to make circles, squares and rectangles. For more complex shapes, apply clip-path to the indicator part.'],
  ['colors', 'Custom colors', 'skeleton/colors', "Set the --color and --sheen-color custom properties to adjust the skeleton's color."],
];

const gaps = [
  'The skeleton renders no ARIA role, aria-busy or aria-live, as in Shoelace; it is decorative markup with no accessible name. The core skeleton\'s aria-busy and aria-live attributes are replaced. Screen reader behavior was not tested.',
  'Neither Shoelace 2.20.1 nor this component stops the pulse or sheen animations for prefers-reduced-motion; they keep animating. This is recorded as parity, not as an accessibility endorsement.',
  'The inherited core properties shape and animation, the core "skeleton-base" part and the core "--skeleton-*" custom properties exist on the element but have no effect; they are not part of the Shoelace contract. The core skeleton styles (including its bordered, overflow-hidden host) are not applied.',
  'The "React" variants of the Shoelace examples are not ported.',
  'Registration is browser-only and uses the native custom element registry for Velcro\'s own class, without changing the shared core prefix; the sl-skeleton entry and the package root (which the examples load) both register this way. The root import is checked in Chromium against core\'s prefix, project configuration and scope maps. Scope-dependent core features (declared dependencies, scope-aware templates) are not supported: a Velcro component that needs them fails when it is created, even when it is the only Charm library on the page. Server-side rendering is not supported.',
  'Rendering was checked by computed-style assertions in Chromium only; there is no pixel comparison against Shoelace, and no Firefox, WebKit, RTL or localization check.',
  'Both the light and dark themes exist (dark values are token-checked against Shoelace 2.20.1; dark rendering of this component is not screenshot-checked), and the theme should be loaded: the skeleton reads --sl-color-neutral-200/300 and --sl-border-radius-* (with fallbacks for its own defaults, but the examples use --sl-border-radius-medium and --sl-border-radius-circle, which come from the theme).',
];

@customElement('page-components-skeleton')
export class SkeletonPage extends LitElement {
  static override styles = [shellStyles];

  override render() {
    return docsShell('skeleton', html`
      <h1>Skeleton</h1>
      <p><code>&lt;sl-skeleton&gt;</code> is registered by <code>@charm-ux/velcro</code> on top of the <code>@charm-ux/core</code> skeleton. Prototype status: unreleased.</p>
      <p>Skeletons are used to provide a visual representation of where content will eventually be drawn. This prevents large areas of empty space during asynchronous operations.</p>

      <h2 id="examples">Examples</h2>
      ${sections.map(
        ([id, title, key, text]) => html`
          <h3 id=${id}>${title}</h3>
          <p>${text}</p>
          <iframe class="example" title=${`Skeleton example: ${title}`} srcdoc=${exampleDocument(examples[key as keyof typeof examples])}></iframe>
          <pre><code>${examples[key as keyof typeof examples]}</code></pre>
        `
      )}

      ${apiReference('sl-skeleton', {
        attributes: html`<p>The property is not reflected to an attribute (as in Shoelace) and an unknown value draws a static skeleton.</p>`,
        parts: html`<p><code>base</code> (the wrapper <code>div</code>) and <code>indicator</code> (the inner <code>div</code> that draws the color, radius and animation).</p>`,
        events: html`<p>Shoelace 2.20.1 emits no events from the skeleton. Velcro differs: the element inherits the core <code>ready</code> event, a <code>CustomEvent</code> dispatched on the element itself after its first update. It does not bubble, is not composed, is not cancelable and has an empty <code>detail</code>, so only a listener attached directly to the skeleton receives it, and it fires once per element. It is not part of the Shoelace contract and is not named with the <code>sl-</code> prefix.</p>`,
      })}

      <h2 id="not-implemented">Not implemented or unverified</h2>
      <ul>
        ${gaps.map(g => html`<li>${g}</li>`)}
      </ul>
    `);
  }
}

export default SkeletonPage;
