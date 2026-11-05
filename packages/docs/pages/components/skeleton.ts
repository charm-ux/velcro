import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { definePageData } from '@beatzball/litro';
import { shell, shellStyles } from '../../src/shell.js';
import { examples, exampleDocument } from '../../src/example.js';

export const pageData = definePageData(async () => ({
  seoTitle: 'Skeleton - Velcro',
  seoHead: '<meta name="description" content="Velcro skeleton (prototype).">',
}));

const attributes: Array<[string, string, string, string]> = [
  ['effect', 'pulse | sheen | none', 'none', 'Determines which effect the skeleton will use.'],
];

const cssProperties: Array<[string, string, string]> = [
  ['--border-radius', 'var(--sl-border-radius-pill)', "The skeleton's border radius."],
  ['--color', 'var(--sl-color-neutral-200)', 'The color of the skeleton.'],
  ['--sheen-color', 'var(--sl-color-neutral-300)', 'The sheen color when the skeleton is in its loading state.'],
];

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
  'Only the light theme exists, and the theme should be loaded: the skeleton reads --sl-color-neutral-200/300 and --sl-border-radius-* (with fallbacks for its own defaults, but the examples use --sl-border-radius-medium and --sl-border-radius-circle, which come from the theme). Dark and the full token set are not done.',
];

@customElement('page-components-skeleton')
export class SkeletonPage extends LitElement {
  static override styles = [shellStyles];

  override render() {
    return shell(html`
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

      <h2 id="attributes">Attributes and properties</h2>
      <table>
        <thead><tr><th>Name</th><th>Type</th><th>Default</th><th>Description</th></tr></thead>
        <tbody>
          ${attributes.map(([n, t, d, desc]) => html`<tr><td><code>${n}</code></td><td>${t}</td><td><code>${d}</code></td><td>${desc}</td></tr>`)}
        </tbody>
      </table>
      <p>The property is not reflected to an attribute (as in Shoelace) and an unknown value draws a static skeleton.</p>

      <h2 id="slots">Slots</h2>
      <p>None.</p>

      <h2 id="parts">CSS parts</h2>
      <p><code>base</code> (the wrapper <code>div</code>) and <code>indicator</code> (the inner <code>div</code> that draws the color, radius and animation).</p>

      <h2 id="css-properties">CSS custom properties</h2>
      <table>
        <thead><tr><th>Property</th><th>Default</th><th>Description</th></tr></thead>
        <tbody>
          ${cssProperties.map(([p, d, desc]) => html`<tr><td><code>${p}</code></td><td><code>${d}</code></td><td>${desc}</td></tr>`)}
        </tbody>
      </table>

      <h2 id="events">Events</h2>
      <p>None.</p>

      <h2 id="not-implemented">Not implemented or unverified</h2>
      <ul>
        ${gaps.map(g => html`<li>${g}</li>`)}
      </ul>
    `);
  }
}

export default SkeletonPage;
