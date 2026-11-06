import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { definePageData } from '@beatzball/litro';
import { docsShell, shellStyles } from '../../src/shell.js';
import { themeHead } from '../../src/theme.js';
import { apiReference } from '../../src/api.js';
import { examples, exampleDocument } from '../../src/example.js';

export const pageData = definePageData(async () => ({
  seoTitle: 'Mutation Observer - Velcro',
  seoHead: themeHead + '<meta name="description" content="Velcro mutation observer (prototype).">',
}));

const sections = [
  ['overview', 'Overview', 'mutation-observer/basic', 'The wrapped button\'s variant attribute is watched with attr="variant". Clicking the button changes the attribute, and each report is written below the button. The first report comes from the button itself, which sets its variant attribute again when it first renders.'],
  ['child-list', 'Child List', 'mutation-observer/child-list', 'Use the child-list attribute to watch for new child elements that are added or removed.'],
] as const;

const gaps = [
  'The Shoelace documentation examples log event.detail to the console; the ported examples write an event count and a summary of the records into the page instead, so they can be checked. The Shoelace React examples are not ported.',
  'Velcro deliberately differs from Shoelace 2.20.1 in three behaviors. (1) Shoelace restarts the observer after the first update only when attr or child-list changes: its watchers for attr-old-value, char-data and char-data-old-value are registered under the attribute names and never fire, so changing those options after the first update has no effect there. Here a change to any of the five options restarts the observer. (2) In Shoelace a restart caused by attr or child-list also starts a disabled observer, which then reports mutations. Here a disabled observer stays stopped. (3) Here nothing is observed while the element is disconnected, and reconnecting replaces the observer; Shoelace restarts its observer on a property change even while disconnected. Each is covered by a product test.',
  'The component extends the core base element, so it also dispatches core\'s non-bubbling "ready" event on first update, which Shoelace does not. Core also keeps its "dir" property and its base styles, including a hidden-attribute rule: the hidden attribute hides the element and its content.',
  'The observer watches the element itself as well as its content, as in Shoelace, so with attr="*" a change to the element\'s own attributes, including the reflected attr, attr-old-value, char-data, char-data-old-value, child-list and disabled attributes, is reported too.',
  'Observation was checked in Chromium with the examples and product tests only: attribute, attribute filter, old values, character data, child list and subtree reports, each option, disabling, re-enabling, property changes after the first update, reconnecting and the empty configuration. Observing across slots, nested shadow roots and very high mutation volumes was not tested.',
  'The element has no role and exposes nothing to assistive technology; no screen reader testing was done.',
  'Registration is browser-only and uses the native custom element registry for Velcro\'s own class, without changing the shared core prefix. Scope-dependent core features (declared dependencies, scope-aware templates) are not supported. Server-side rendering is not supported.',
  'Shoelace\'s own mutation observer test runs against Velcro and passes (it only checks that the element renders). Rendering was checked by computed-style assertions in Chromium only; there is no Firefox, WebKit or RTL check.',
  'Both the light and dark themes exist. The component needs no theme tokens; the examples use sl-button, whose tokens both themes define.',
];

@customElement('page-components-mutation-observer')
export class MutationObserverPage extends LitElement {
  static override styles = [shellStyles];

  override render() {
    return docsShell('mutation-observer', html`
      <h1>Mutation Observer</h1>
      <p><code>&lt;sl-mutation-observer&gt;</code> is registered by <code>@charm-ux/velcro</code> on top of the <code>@charm-ux/core</code> base element. Prototype status: unreleased.</p>
      <p>The Mutation Observer component offers a thin, declarative interface to the <a href="https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver"><code>MutationObserver</code> API</a>. It reports changes to the content it wraps through the <code>sl-mutation</code> event. When emitted, a collection of <a href="https://developer.mozilla.org/en-US/docs/Web/API/MutationRecord"><code>MutationRecord</code></a> objects is attached to <code>event.detail.mutationList</code> and contains information about how the content changed.</p>
      <p>When you create a mutation observer, you must indicate what changes it should respond to by including at least one of <code>attr</code>, <code>child-list</code> or <code>char-data</code>. If you don't specify at least one of these attributes, no mutation events are emitted.</p>

      <h2 id="examples">Examples</h2>
      <p>Each preview runs in its own document, so its script uses plain <code>document.querySelector</code>.</p>
      ${sections.map(
        ([id, title, key, text]) => html`
          <h3 id=${id}>${title}</h3>
          <p>${text}</p>
          <iframe class="example" title=${`Mutation Observer example: ${title}`} srcdoc=${exampleDocument(examples[key])}></iframe>
          <pre><code>${examples[key]}</code></pre>
        `
      )}

      ${apiReference('sl-mutation-observer', {
        attributes: html`<p>Removing a boolean attribute sets its property back to <code>false</code>; removing <code>attr</code> sets it to <code>null</code>. Changing any of the five options after the element has first updated restarts the observer with the new options (see the notes below).</p>`,
        events: html`<p><code>sl-mutation</code> bubbles and is composed. Inherited from core: a non-bubbling <code>ready</code> event on first update, which Shoelace does not have.</p>`,
        slots: html`<p>The default slot holds the content to watch. The host is <code>display: contents</code>, and the whole subtree of the host is observed.</p>`,
      })}

      <h2 id="not-implemented">Not implemented or unverified</h2>
      <p>Differences from Shoelace 2.20.1 and limits of what has been checked.</p>
      <ul>
        ${gaps.map(g => html`<li>${g}</li>`)}
      </ul>
    `);
  }
}

export default MutationObserverPage;
