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

// Shoelace 2.20.1 behaviors that look like bugs but are matched exactly (candidates for a later opt-in fix). One line each.
const quirks = [
  'Only attr and child-list restart the observer after the first update. Shoelace also watches attr-old-value, char-data and char-data-old-value, but registers them under their attribute names, which never match a property name. Changing those three options after the first update therefore has no effect until the observer is next restarted (by a change to attr or child-list, or by disabled going false again), and turning char-data off does not stop reporting character data.',
  'A change to attr or child-list restarts the observer without checking disabled, so on a disabled observer it starts observing and reports mutations while disabled stays true. Only a later change of disabled stops it again.',
  'Restarting does not check that the element is connected: a change to attr or child-list while the element is disconnected makes it observe its detached subtree and report mutations.',
  'Reconnecting creates a new observer without disconnecting the previous one. After a restart while disconnected (the quirk above), both observe, and every mutation is reported twice.',
  'The first update always (re)starts an enabled observer, because disabled counts as changed then. Options assigned right after the element is connected, before its first update, therefore take effect.',
  'Removing a reflected attribute restores the value the property had when the first change to any observed attribute happened (including dir and lang, which every Shoelace component observes), and attr has no default. An attr set as an attribute is never recorded, and neither is one assigned after a dir or lang attribute changed, so removing it leaves the property null (and the restart that follows observes no attributes). An attr assigned as a property before any attribute changed is recorded when it reflects, so removing the attribute sets the property back to that value and it reflects again.',
  'With attr="*" the host itself is observed too, so a change to its own reflected attributes (attr, attr-old-value, char-data, char-data-old-value, child-list, disabled) is reported like any other attribute change.',
] as const;

const gaps = [
  'The Shoelace documentation examples log event.detail to the console; the ported examples write an event count and a summary of the records into the page instead, so they can be checked. The Shoelace React examples are not ported.',
  'The component extends the core base element, so it also has core\'s "dir" property and dispatches core\'s non-bubbling "ready" event on first update. These are Velcro extensions that Shoelace\'s manifest for this component does not list; the API tables label them as inherited from core. Core\'s base styles are not used (the host styles are Shoelace\'s own), so the host and the hidden attribute render as they do in Shoelace.',
  'Observation was checked in Chromium with the examples and product tests only: attribute, attribute filter, old values, character data, child list and subtree reports, each option, disabling, re-enabling, property changes after the first update, reconnecting, the empty configuration and the quirks above. Observing across slots, nested shadow roots and very high mutation volumes was not tested.',
  'The element has no role and exposes nothing to assistive technology; no screen reader testing was done.',
  'Registration is browser-only and uses the native custom element registry for Velcro\'s own class, without changing the shared core prefix. Scope-dependent core features (declared dependencies, scope-aware templates) are not supported. Server-side rendering is not supported.',
  'Shoelace\'s own mutation observer test runs against Velcro and passes (it only checks that the element renders). The hidden-attribute rendering was compared with a stand-in element carrying Shoelace\'s stylesheet, in Chromium only; there is no Firefox, WebKit or RTL check.',
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
        attributes: html`<p>Removing a boolean attribute sets its property back to <code>false</code>. As in Shoelace's base element, <code>lang</code> is a reactive property with no default that is not reflected, so assigning <code>el.lang</code> does not change the attribute. <code>attr</code> has no default; see the upstream quirks below for what removing it does. Only <code>attr</code> and <code>child-list</code> restart the observer when they change after the element has first updated (see the quirks below).</p>`,
        events: html`<p><code>sl-mutation</code> bubbles and is composed. Inherited from core: a non-bubbling <code>ready</code> event on first update, which Shoelace does not have.</p>`,
        slots: html`<p>The default slot holds the content to watch. The host is <code>display: contents</code>, and the whole subtree of the host is observed.</p>`,
      })}

      <h2 id="upstream-quirks">Upstream quirks matched</h2>
      <p>Velcro matches Shoelace 2.20.1 exactly, including behavior that looks like a bug. Each of these is covered by a product test and is a candidate for a later opt-in fix.</p>
      <ul>
        ${quirks.map(q => html`<li>${q}</li>`)}
      </ul>

      <h2 id="not-implemented">Not implemented or unverified</h2>
      <p>Velcro extensions and limits of what has been checked.</p>
      <ul>
        ${gaps.map(g => html`<li>${g}</li>`)}
      </ul>
    `);
  }
}

export default MutationObserverPage;
