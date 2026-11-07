/*
 * Localization guide. Wording and examples adapted from Shoelace v2.20.1 docs/pages/getting-started/localization.md
 * (Copyright (c) 2020 A Beautiful Site, LLC, MIT License). See THIRD_PARTY_NOTICES.md.
 * Changes: rewritten for what Velcro supports today, with its package entry points, its differences and the upstream
 * quirks it matches.
 */
import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { definePageData } from '@beatzball/litro';
import { withBase } from '../src/base.js';
import { docsShell, shellStyles } from '../src/shell.js';
import { themeHead } from '../src/theme.js';

export const pageData = definePageData(async () => ({
  seoTitle: 'Localization - Velcro',
  seoHead: themeHead + '<meta name="description" content="How Velcro components localize their built-in text (prototype).">',
}));

// The 29 translation modules Shoelace 2.20.1 ships, all included in the Velcro package.
const TRANSLATIONS = ['ar', 'cs', 'da', 'de', 'de-ch', 'en', 'en-gb', 'es', 'fa', 'fi', 'fr', 'he', 'hr', 'hu', 'id', 'it', 'ja',
  'nb', 'nl', 'nn', 'pl', 'pt', 'ru', 'sl', 'sv', 'tr', 'uk', 'zh-cn', 'zh-tw'];

const LOCALIZED = [
  ['spinner', 'sl-spinner', 'the accessible name of its base part (term "loading")'],
  ['progress-bar', 'sl-progress-bar', 'the default accessible name, when label is empty (term "progress"), and the direction of the indeterminate animation'],
  ['progress-ring', 'sl-progress-ring', 'the default accessible name, when label is empty (term "progress")'],
  ['split-panel', 'sl-split-panel', 'the accessible name of the divider (term "resize"), and the direction of the keyboard and pointer handling'],
] as const;

const SPANISH = `<html lang="es">
  <head>
    <script type="module">
      import '@charm-ux/velcro/translations/es';
    </script>
  </head>
  <body>
    ...
  </body>
</html>`;

const DYNAMIC = `// Same as setting <html lang="de">
document.documentElement.lang = 'de';

// Import the translation
import('@charm-ux/velcro/translations/de');`;

const PER_ELEMENT = `<html lang="es">
  <body>
    <sl-spinner></sl-spinner>             <!-- Spanish -->
    <sl-spinner lang="ru"></sl-spinner>   <!-- Russian -->
    <div lang="ru">
      <sl-spinner></sl-spinner>           <!-- still Spanish: an ancestor's lang is not read -->
    </div>
  </body>
</html>`;

const OWN = `import { registerTranslation } from '@charm-ux/velcro/utilities/localize';
import type { Translation } from '@charm-ux/velcro/utilities/localize';

const translation: Translation = {
  $code: 'es',
  $name: 'Español',
  $dir: 'ltr',

  term1: '...',
  term2: '...',
  ...
};

registerTranslation(translation);

export default translation;`;

@customElement('page-localization')
export class LocalizationPage extends LitElement {
  static override styles = [shellStyles];

  override render() {
    return docsShell('localization', html`
      <h1>Localization</h1>
      <p>Velcro localizes the text that components render themselves, such as accessible names, the way Shoelace 2.20.1 does: a
        translation registry, Shoelace's translation files, and the <code>lang</code> and <code>dir</code> of the element or the document.
        Prototype status: unreleased.</p>

      <h2 id="entry-points">Entry points</h2>
      <p>The package exports the localization module and each of Shoelace's translation files:</p>
      <ul>
        <li><code>@charm-ux/velcro/utilities/localize</code>: <code>registerTranslation</code>, the <code>Translation</code> type and the
          <code>LocalizeController</code>, as in Shoelace's <code>utilities/localize</code>;</li>
        <li><code>@charm-ux/velcro/translations/&lt;code&gt;</code>, one per translation listed below, each registering itself when
          imported.</li>
      </ul>
      <p>Only those exact entry points exist; there is no wildcard. The examples use these bare specifiers, so a page needs a bundler or
        an import map that resolves the package. A page that registers no translation renders English, the fallback, whatever its
        <code>lang</code>.</p>

      <h2 id="usage">Usage</h2>
      <p>Components are localized by importing the translation file and setting the <code>lang</code> attribute, and the <code>dir</code>
        attribute where it applies, on the <code>&lt;html&gt;</code> element. This renders the components in Spanish:</p>
      <pre><code>${SPANISH}</code></pre>
      <p>A mutation observer watches <code>lang</code> and <code>dir</code> on <code>&lt;html&gt;</code>, so changing them updates every
        localized component. Translations need not be loaded up front. A translation imported after the <code>lang</code> change updates
        the components when it registers.</p>
      <pre><code>${DYNAMIC}</code></pre>

      <h2 id="available-translations">Available translations</h2>
      <p>English (US) is the default and the fallback; it is registered by the module itself and need not be imported. The package
        contains Shoelace 2.20.1's 29 translation files, unchanged except for one import line in eight of them:</p>
      <p>${TRANSLATIONS.map((code, i) => html`${i ? ', ' : ''}<code>${code}</code>`)}</p>
      <p>Each file registers itself when imported, and the package marks them, and the localize module, as having side effects so that
        bundlers keep those imports.</p>

      <h3 id="resolution">Translation resolution</h3>
      <p>The language is the element's <code>lang</code>, otherwise the <code>lang</code> of <code>&lt;html&gt;</code>, otherwise the browser
        language. For a code with a region, such as <code>es-PE</code>, a term is looked up:</p>
      <ol>
        <li>in <code>es-PE</code>;</li>
        <li>in <code>es</code>;</li>
        <li>in the fallback, English.</li>
      </ol>
      <p>Codes are matched case-insensitively, and <code>es_PE</code> is read as <code>es-PE</code>. Registering a code again merges the new
        terms over the old ones. The localization is for component internals, not a tool for localizing an application's own content.</p>

      <h2 id="multiple-locales">Multiple locales per page</h2>
      <p>A component can use its own locale through its <code>lang</code> and <code>dir</code> attributes. As in Shoelace, they must be on
        the component itself: an ancestor's are not read.</p>
      <pre><code>${PER_ELEMENT}</code></pre>

      <h2 id="own-translations">Creating your own translations</h2>
      <p>Copy <code>src/translations/en.ts</code>, translate the terms and register the result. A translation needs a code, a name and a
        direction, and may provide only some terms: missing ones come from the fallback. Use the same localization module as the
        components. A translation registered through another copy of the module is not seen.</p>
      <pre><code>${OWN}</code></pre>

      <h2 id="components">Localized components</h2>
      <ul>
        ${LOCALIZED.map(([name, tag, what]) => html`<li><a href=${withBase(`/components/${name}`)}><code>&lt;${tag}&gt;</code></a>: ${what}.</li>`)}
      </ul>
      <p>Format bytes, format date, format number and relative time use the same <code>lang</code> resolution for <code>Intl</code>
        formatting; they render no translated terms.</p>

      <h2 id="differences">Differences from Shoelace</h2>
      <ul>
        <li>The entry points are package exports without <code>dist/</code> or a <code>.js</code> extension
          (<code>@charm-ux/velcro/translations/es</code>, where Shoelace's path is
          <code>@shoelace-style/shoelace/dist/translations/es.js</code>), and there is no CDN build or autoloader.</li>
        <li>Velcro has no <code>@shoelace-style/localize</code> package. Its registry and controller are adapted from it into a module of
          Velcro's own, with the same API (<code>registerTranslation</code>, and on the controller <code>term</code>, <code>exists</code>, <code>lang</code>,
          <code>dir</code>, <code>date</code>, <code>number</code> and <code>relativeTime</code>). The eight translation files that
          import it (ar, cs, en, fi, hr, id, it and sl) import Velcro's module instead.</li>
        <li>The direction is read from the element's <code>dir</code> attribute, not its property, because core's <code>dir</code> getter
          resolves the computed direction. A direction set only through the property (<code>el.dir = 'rtl'</code> without the attribute)
          is therefore not seen by the localization module.</li>
        <li>The <code>date</code> helper returns an empty string for an invalid date, where upstream throws a <code>RangeError</code>. (The
          <code>number</code> helper returns an empty string for a non-numeric value, as upstream does.)</li>
      </ul>

      <h2 id="upstream-quirks">Upstream quirks matched</h2>
      <ul>
        <li>The <code>lang</code> and <code>dir</code> of <code>&lt;html&gt;</code> are read from a snapshot that is refreshed when the observer
          reports a change and when a translation is registered. A lookup in the same task as the change still sees the previous value;
          components re-render with the new one once the observer runs.</li>
        <li>The first translation ever registered is the fallback. The eight files that import the registry directly (ar, cs, en, fi, hr,
          id, it, sl) do not load English first, so importing one of them before any component makes it the fallback instead of English.</li>
        <li>A translation's <code>$dir</code> does not set any direction; only the <code>dir</code> attributes do.</li>
        <li>A term found in no translation logs "No translation found for: &lt;key&gt;" and renders the key.</li>
        <li>An invalid <code>lang</code> (one that <code>Intl.Locale</code> rejects) throws when a term is looked up.</li>
        <li>A term that is an empty string counts as missing, and the next translation in the order is used.</li>
      </ul>

      <h2 id="not-implemented">Not implemented or unverified</h2>
      <ul>
        <li>Checked in Chromium only; there is no Firefox or WebKit check. The text of the 29 translation files is Shoelace's and was not
          reviewed by Velcro.</li>
      </ul>
    `);
  }
}

export default LocalizationPage;
