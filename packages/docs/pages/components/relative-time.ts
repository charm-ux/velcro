import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { definePageData } from '@beatzball/litro';
import { docsShell, shellStyles } from '../../src/shell.js';
import { themeHead } from '../../src/theme.js';
import { apiReference } from '../../src/api.js';
import { examples, exampleDocument } from '../../src/example.js';

export const pageData = definePageData(async () => ({
  seoTitle: 'Relative Time - Velcro',
  seoHead: themeHead + '<meta name="description" content="Velcro relative time (prototype).">',
}));

const gaps = [
  'There is no core relative-time: the component extends the core CharmElement base. The phrase is produced by Intl.RelativeTimeFormat through Velcro\'s localization controller (packages/velcro/src/utilities/localize.ts), reused unchanged.',
  'This component uses no translated terms, so registered translations do not change it. The localization controller resolves lang from the element, then the document element, then the browser language, and re-renders when the document element lang or dir changes or a translation is registered.',
  'The text depends on the browser Intl data. It was compared with Shoelace 2.20.1 by the algorithm (the same unit thresholds, rounding and sync scheduling) and by asserted strings in Chromium, not by running Shoelace.',
  'Divergence: removing the date, format or numeric attribute restores the default here (the current time, long, auto), whereas Shoelace restores only reflected properties, so there the property would become null. Setting an invalid value by property is not guarded; an invalid date renders nothing, as in Shoelace.',
  'Divergence: with sync, an element that is disconnected and reconnected resumes updating; in Shoelace its timer is cleared on disconnect and not restarted.',
  'Divergence: the host has no border-box rule from the core base (the styles reset it to content-box, as in Shoelace, where the element does not import the shared base styles). Shoelace also keeps isoTime and relativeTime as internal reactive state; here they are local values of the render.',
  'The "ready" event of the core base is emitted once after the first update (non-bubbling, non-composed). Shoelace has no such event. The element has no other events, methods, slots, parts or custom properties.',
  'The Shoelace React examples are not ported. Time-dependent output (the "now" of the date) is verified in Chromium with relative dates, not fixed clocks; sync is checked in real time in Chromium: a synced element updates within about two seconds in the minute range while an unsynced one does not, the timer stops while the element is disconnected, and it resumes after reconnect. The scheduling branches for the hour (next minute), day (next hour) and larger units (next day) are not exercised, and no fake clock or long run is used.',
  'Registration is browser-only and uses the native custom element registry for Velcro\'s own class, without changing the shared core prefix. Scope-dependent core features are not used. Server-side rendering is not supported.',
  'Checked in Chromium only; no Firefox, WebKit, screen reader or RTL check. Both the light and dark themes exist; this component reads no theme tokens.',
];

@customElement('page-components-relative-time')
export class RelativeTimePage extends LitElement {
  static override styles = [shellStyles];

  override render() {
    const source = examples['relative-time/basic'];
    return docsShell('relative-time', html`
      <h1>Relative Time</h1>
      <p><code>&lt;sl-relative-time&gt;</code> is registered by <code>@charm-ux/velcro</code> on the <code>@charm-ux/core</code> base element. Prototype status: unreleased.</p>
      <p>Outputs a localized time phrase relative to the current date and time, using the browser's <code>Intl.RelativeTimeFormat</code>. No language packs are required.</p>

      <h2 id="examples">Examples</h2>
      <iframe class="example" title="Relative Time example" srcdoc=${exampleDocument(source)}></iframe>
      <pre><code>${source}</code></pre>

      ${apiReference('sl-relative-time', {
        attributes: html`<p>As in Shoelace, none of these are reflected to attributes. Avoid ambiguous date strings such as <code>03/04/2020</code>; use an ISO 8601 string.</p>`,
        parts: html`<p>The component renders a <code>time</code> element with an ISO <code>datetime</code> attribute in its shadow root and has no ARIA role. An invalid date renders nothing.</p>`,
        events: html`<p>Only the inherited <code>ready</code> event (see below); Shoelace 2.20.1 has none.</p>`,
      })}

      <h2 id="not-implemented">Not implemented or unverified</h2>
      <ul>
        ${gaps.map(g => html`<li>${g}</li>`)}
      </ul>
    `);
  }
}

export default RelativeTimePage;
