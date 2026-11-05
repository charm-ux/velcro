import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { definePageData } from '@beatzball/litro';
import { shell, shellStyles } from '../../src/shell.js';
import { examples, exampleDocument } from '../../src/example.js';

export const pageData = definePageData(async () => ({
  seoTitle: 'Relative Time - Velcro',
  seoHead: '<meta name="description" content="Velcro relative time (prototype).">',
}));

const attributes: Array<[string, string, string, string]> = [
  ['date', 'Date | string', 'new Date()', 'The date from which to calculate time from. A string should be ISO 8601 so time zones are handled correctly. As an attribute it is a string; set a Date object by script.'],
  ['format', 'long | short | narrow', 'long', 'The formatting style to use.'],
  ['numeric', 'always | auto', 'auto', 'When auto, values such as "yesterday" and "tomorrow" are shown when possible. When always, values such as "1 day ago" and "in 1 day" are shown.'],
  ['sync', 'boolean', 'false', 'Keep the displayed value up to date as time passes.'],
  ['lang', 'string', '(none)', 'The formatting locale. Falls back to the lang of the document element, then the browser language. Undefined by default, as in Shoelace.'],
];

const gaps = [
  'There is no core relative-time: the component extends the core CharmElement base. The phrase is produced by Intl.RelativeTimeFormat through a minimal localization controller (packages/velcro/src/internal/localize.ts), reused unchanged.',
  'The localization controller has no translation registry: nothing is translated (this component needs no strings), and registerTranslation / term() do not exist. It resolves lang from the element, then the document element, then the browser language, and re-renders when the document element lang or dir changes.',
  'The text depends on the browser Intl data. It was compared with Shoelace 2.20.1 by the algorithm (the same unit thresholds, rounding and sync scheduling) and by asserted strings in Chromium, not by running Shoelace.',
  'Divergence: removing the date, format or numeric attribute restores the default here (the current time, long, auto), whereas Shoelace restores only reflected properties, so there the property would become null. Setting an invalid value by property is not guarded; an invalid date renders nothing, as in Shoelace.',
  'Divergence: with sync, an element that is disconnected and reconnected resumes updating; in Shoelace its timer is cleared on disconnect and not restarted.',
  'Divergence: the host has no border-box rule from the core base (the styles reset it to content-box, as in Shoelace, where the element does not import the shared base styles). Shoelace also keeps isoTime and relativeTime as internal reactive state; here they are local values of the render.',
  'The "ready" event of the core base is emitted once after the first update (non-bubbling, non-composed). Shoelace has no such event. The element has no other events, methods, slots, parts or custom properties.',
  'The Shoelace React examples are not ported. Time-dependent output (the "now" of the date) is verified in Chromium with relative dates, not fixed clocks; sync is checked in real time in Chromium: a synced element updates within about two seconds in the minute range while an unsynced one does not, the timer stops while the element is disconnected, and it resumes after reconnect. The scheduling branches for the hour (next minute), day (next hour) and larger units (next day) are not exercised, and no fake clock or long run is used.',
  'Registration is browser-only and uses the native custom element registry for Velcro\'s own class, without changing the shared core prefix. Scope-dependent core features are not used. Server-side rendering is not supported.',
  'Checked in Chromium only; no Firefox, WebKit, screen reader or RTL check. Only the light theme exists; this component reads no theme tokens.',
];

@customElement('page-components-relative-time')
export class RelativeTimePage extends LitElement {
  static override styles = [shellStyles];

  override render() {
    const source = examples['relative-time/basic'];
    return shell(html`
      <h1>Relative Time</h1>
      <p><code>&lt;sl-relative-time&gt;</code> is registered by <code>@charm-ux/velcro</code> on the <code>@charm-ux/core</code> base element. Prototype status: unreleased.</p>
      <p>Outputs a localized time phrase relative to the current date and time, using the browser's <code>Intl.RelativeTimeFormat</code>. No language packs are required.</p>

      <h2 id="examples">Examples</h2>
      <iframe class="example" title="Relative Time example" srcdoc=${exampleDocument(source)}></iframe>
      <pre><code>${source}</code></pre>

      <h2 id="attributes">Attributes and properties</h2>
      <table>
        <thead><tr><th>Name</th><th>Type</th><th>Default</th><th>Description</th></tr></thead>
        <tbody>
          ${attributes.map(([n, t, d, desc]) => html`<tr><td><code>${n}</code></td><td>${t}</td><td><code>${d}</code></td><td>${desc}</td></tr>`)}
        </tbody>
      </table>
      <p>As in Shoelace, none of these are reflected to attributes. Avoid ambiguous date strings such as <code>03/04/2020</code>; use an ISO 8601 string.</p>

      <h2 id="slots">Slots</h2>
      <p>None.</p>

      <h2 id="parts">CSS parts</h2>
      <p>None. The component renders a <code>time</code> element with an ISO <code>datetime</code> attribute in its shadow root and has no ARIA role. An invalid date renders nothing.</p>

      <h2 id="css-properties">CSS custom properties</h2>
      <p>None.</p>

      <h2 id="events">Events</h2>
      <p>Only the inherited <code>ready</code> event (see below); Shoelace 2.20.1 has none.</p>

      <h2 id="methods">Methods</h2>
      <p>None.</p>

      <h2 id="not-implemented">Not implemented or unverified</h2>
      <ul>
        ${gaps.map(g => html`<li>${g}</li>`)}
      </ul>
    `);
  }
}

export default RelativeTimePage;
