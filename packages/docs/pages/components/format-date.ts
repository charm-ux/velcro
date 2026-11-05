import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { definePageData } from '@beatzball/litro';
import { docsShell, shellStyles } from '../../src/shell.js';
import { themeHead } from '../../src/theme.js';
import { examples, exampleDocument } from '../../src/example.js';

export const pageData = definePageData(async () => ({
  seoTitle: 'Format Date - Velcro',
  seoHead: themeHead + '<meta name="description" content="Velcro format date (prototype).">',
}));

const attributes: Array<[string, string, string, string]> = [
  ['date', 'Date | string', 'the current date and time (when the element is created)', 'The date/time to format. A string should be ISO 8601 so time zones are handled correctly; avoid ambiguous strings such as 03/04/2020. An invalid date renders nothing.'],
  ['weekday', 'narrow | short | long', '(none)', 'The format for displaying the weekday.'],
  ['era', 'narrow | short | long', '(none)', 'The format for displaying the era.'],
  ['year', 'numeric | 2-digit', '(none)', 'The format for displaying the year.'],
  ['month', 'numeric | 2-digit | narrow | short | long', '(none)', 'The format for displaying the month.'],
  ['day', 'numeric | 2-digit', '(none)', 'The format for displaying the day.'],
  ['hour', 'numeric | 2-digit', '(none)', 'The format for displaying the hour.'],
  ['minute', 'numeric | 2-digit', '(none)', 'The format for displaying the minute.'],
  ['second', 'numeric | 2-digit', '(none)', 'The format for displaying the second.'],
  ['time-zone-name (timeZoneName)', 'short | long', '(none)', 'The format for displaying the time zone name.'],
  ['time-zone (timeZone)', 'string', '(none)', 'The time zone to express the time in.'],
  ['hour-format (hourFormat)', 'auto | 12 | 24', 'auto', 'Forces 12-hour or 24-hour time; auto leaves the choice to the locale.'],
  ['lang', 'string', '(none)', 'The formatting locale. Falls back to the lang of the document element, then the browser language.'],
];

const gaps = [
  'There is no core format-date: the component extends the core CharmElement base and renders a time element in its shadow root. The text is produced by Intl.DateTimeFormat through a minimal localization controller (packages/velcro/src/internal/localize.ts).',
  'The localization controller has no translation registry: nothing is translated (this component needs no strings), and registerTranslation / term() do not exist. It resolves lang from the element, then the document element, then the browser language, and re-renders when the document element lang or dir changes.',
  'The formatted output depends on the browser Intl data. It was compared with Shoelace 2.20.1 only by the algorithm (the same options passed to Intl.DateTimeFormat, hour-format mapped to hour12) and by asserted strings in Chromium, not by running Shoelace.',
  'Divergence: Shoelace restores the initial value only of reflected properties and none of these are reflected, so a removed attribute leaves null there. Here removing hour-format restores auto (upstream a null value renders 24-hour time), removing date restores the current date and time (upstream: the epoch), and a removed format attribute is treated as unset (upstream, null reaches Intl and throws a RangeError). The same applies to removing time-zone: here it is unset and the default time zone is used, whereas upstream passes null as the time zone and Intl throws a RangeError. The other format attributes are treated as unset here for the same reason. Initial lang is an empty string here (the native HTMLElement value); Shoelace declares it as a reactive property with no default, so it starts undefined there. Removing the lang attribute leaves null in both.',
  'Invalid option values (for example month="bogus") and an invalid time-zone are passed to Intl as in Shoelace and make it throw a RangeError while rendering; they are not guarded and that throw was not tested.',
  'The Shoelace date is read once when the element is created; the rendered current time does not tick. The Shoelace examples that show the current time are ported, but their output cannot be fixed, so the tests compare them with Intl in the browser.',
  'The "ready" event of the core base is emitted once after the first update (non-bubbling, non-composed). Shoelace has no such event. The element has no other events, methods, slots, CSS parts or custom properties; it has no ARIA role (the time element provides the semantics).',
  'Registration is browser-only and uses the native custom element registry for Velcro\'s own class, without changing the shared core prefix. Scope-dependent core features are not used. Server-side rendering is not supported.',
  'Checked in Chromium only; no Firefox, WebKit, screen reader or RTL check. Both the light and dark themes exist; this component reads no theme tokens.',
];

@customElement('page-components-format-date')
export class FormatDatePage extends LitElement {
  static override styles = [shellStyles];

  override render() {
    const source = examples['format-date/basic'];
    return docsShell('format-date', html`
      <h1>Format Date</h1>
      <p><code>&lt;sl-format-date&gt;</code> is registered by <code>@charm-ux/velcro</code> on the <code>@charm-ux/core</code> base element. Prototype status: unreleased.</p>
      <p>Formats a date/time using the specified locale and options. Localization is handled by the browser's <code>Intl.DateTimeFormat</code>; no language packs are required.</p>

      <h2 id="examples">Examples</h2>
      <iframe class="example" title="Format Date example" srcdoc=${exampleDocument(source)}></iframe>
      <pre><code>${source}</code></pre>

      <h2 id="attributes">Attributes and properties</h2>
      <table>
        <thead><tr><th>Name</th><th>Type</th><th>Default</th><th>Description</th></tr></thead>
        <tbody>
          ${attributes.map(([n, t, d, desc]) => html`<tr><td><code>${n}</code></td><td>${t}</td><td><code>${d}</code></td><td>${desc}</td></tr>`)}
        </tbody>
      </table>
      <p>As in Shoelace, none of these are reflected to attributes. The attribute names are the property names, except the kebab-case ones shown in the table.</p>

      <h2 id="slots">Slots</h2>
      <p>None.</p>

      <h2 id="parts">CSS parts</h2>
      <p>None. The shadow root contains a <code>time</code> element whose <code>datetime</code> attribute is the ISO 8601 date; it has no ARIA role.</p>

      <h2 id="css-properties">CSS custom properties</h2>
      <p>None.</p>

      <h2 id="events">Events</h2>
      <p>Only the inherited <code>ready</code> event (see below); Shoelace 2.20.1 has none.</p>

      <h2 id="not-implemented">Not implemented or unverified</h2>
      <ul>
        ${gaps.map(g => html`<li>${g}</li>`)}
      </ul>
    `);
  }
}

export default FormatDatePage;
