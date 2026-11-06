import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { definePageData } from '@beatzball/litro';
import { docsShell, shellStyles } from '../../src/shell.js';
import { themeHead } from '../../src/theme.js';
import { apiReference } from '../../src/api.js';
import { examples, exampleDocument } from '../../src/example.js';

export const pageData = definePageData(async () => ({
  seoTitle: 'Include - Velcro',
  seoHead: themeHead + '<meta name="description" content="Velcro include (prototype).">',
}));

const sections = [
  ['overview', 'Overview', 'include/basic', 'Shoelace\'s example includes a file hosted on its own website. Here the file is a small fixture the documentation site serves, so the page needs no other site. A relative src in these previews is resolved against the root of this documentation site.'],
  ['listening-for-events', 'Listening for Events', 'include/events', 'When an include file loads successfully, the sl-load event will be emitted. You can listen for this event to add custom loading logic to your includes. If the request fails, the sl-error event will be emitted. In this case, event.detail.status will contain the resulting HTTP status code of the request, e.g. 404 (not found). The preview writes the events into the page instead of the console, and its button points a second include at a file that does not exist so you can see an error.'],
  ['allow-scripts', 'Allowing Scripts', 'include/allow-scripts', 'Scripts in an included file are inserted but do not run unless the include has the allow-scripts attribute. The included file here ends with a script that rewrites one of its own paragraphs; compare it with the overview, where the same file is included without the attribute.'],
] as const;

// Shoelace 2.20.1 behaviors that look like bugs but are matched exactly (candidates for a later opt-in fix). One line each.
const quirks = [
  'Responses are cached by src for the life of the page and the cache is never cleared. A response that is not ok (404, 500, ...) is cached too, and so is a request that failed outright (the cached request stays rejected), so a src that failed once fails again at once, with no new request, until the page is reloaded, even if the file has since appeared. Only a successful first request makes later ones cheap, and any other include with the same src shares the result.',
  'The cache key is src alone, so a request for a src that is already cached ignores its mode. The first request decides, success or failure.',
  'Only src starts a request. Changing mode or allow-scripts does nothing until src changes, and allow-scripts only applies to the scripts of content that loads afterwards: scripts that were included without it stay inert when it is set later.',
  'A response that is not ok emits sl-error and leaves the include\'s content as it was, so an earlier file stays on screen next to the error. A successful response replaces all of the element\'s children, including any content the page put inside the element itself.',
  'A request that is superseded because src changed while it was in flight is dropped without sl-load or sl-error, so the events of an include that is retargeted quickly do not pair up with its src changes.',
  'Any exception emits sl-error with status -1: a network failure, a CORS refusal, a mode that fetch rejects. The mode no-cors returns an opaque response, so it always ends in sl-error with status 0 (and caches that).',
  'None of the include\'s properties reflect, so nothing is restored when an attribute is removed. Removing src sets it to null, which requests the relative URL "null"; removing mode sets it to null, after which the next request for an uncached src fails with sl-error status -1 because fetch rejects a null mode (and that failure is cached). Removing allow-scripts sets it back to false.',
  'The hidden attribute does not hide an include: the host is display: block, which wins over the browser\'s rule for hidden, and Shoelace\'s own [hidden] rule sits inside the shadow root, where it matches nothing. Hide it with a style or by removing it, not with hidden.',
  'sl-load and sl-error bubble and are composed, so an include nested in included content also fires them at the outer include\'s listeners. The Shoelace examples check event.eventPhase === Event.AT_TARGET for that reason.',
] as const;

const gaps = [
  'The Shoelace examples include a file on shoelace.style, which needs network access and another site. The ported examples include a small fixture file served by this site (public/include-fixtures/hello/, with its own wording and a different script), through a root-relative URL that works at the site root and under a project-site prefix. Besides the two Shoelace examples (the overview and listening for events) there is an extra one for allow-scripts. The events example shows events in the page instead of the console and adds a button for the error path.',
  'Included content is inserted as HTML with the browser\'s innerHTML, as in Shoelace, with no sanitizing. Only include files you trust: with allow-scripts they run as code, and without it handlers such as onerror attributes in the markup still run. The element does not check the origin of src.',
  'Shoelace publishes its request helper at dist/components/include/request.js. The same requestInclude(src, mode) function, with the same shared cache, is exported at @charm-ux/velcro/include/request. As in Shoelace, it is not exported from the package root or from @charm-ux/velcro/include. Calling it directly shares the cache the elements use.',
  'There is no core include, so the component extends the @charm-ux/core base element directly. The only core extension is the non-bubbling ready event on first update, which Shoelace does not have; the API tables label it as inherited from core. Core\'s base styles are replaced by Shoelace\'s, and Shoelace\'s handleSrcChange and render methods are public, as here.',
  'dir and lang are declared as Shoelace\'s base element declares them: reactive, not reflected and undefined until set. Core\'s computed dir is not used.',
  'TypeScript types for dir are narrower than Shoelace\'s dir: string. At runtime dir is stored and returned as set, and the setter accepts any string, so element.dir = someString compiles (type-tests/include.tsx checks it). The read type stays core\'s \'ltr\' | \'rtl\' | \'auto\', because a subclass cannot widen an inherited getter\'s type, and everything generated from it follows: the manifest and the API table below, the React wrapper\'s dir prop, and the JSX dir and prop:dir types. So <VelcroInclude dir={someString}> and <sl-include dir={someString}> do not compile where Shoelace\'s types accept them. Fixing this needs a change in @charm-ux/core and is deferred.',
  'The element is checked in Chromium by product tests (with the documentation site\'s fixtures, routed responses, and a real second origin on the loopback address for each mode) and by Shoelace\'s two include tests, which pass. The product tests also passed once in WebKit, run by hand; Firefox could not be started in the environment they were written in, and no RTL or screen reader check was done. The included content is ordinary light DOM, so what is announced depends on that content.',
  'Registration is browser-only and uses the native custom element registry for Velcro\'s own class, without changing the shared core prefix. Server-side rendering is not supported.',
  'The component has no theme tokens or styles of its own beyond display: block, so it works with both themes.',
];

const reactUsage = `import { VelcroInclude as SlInclude } from '@charm-ux/velcro/react';

const App = () => <SlInclude src="fragments/intro.html" onSlLoad={() => console.log('Success')} />;`;

const requestUsage = `import { requestInclude } from '@charm-ux/velcro/include/request';

// Same cache as the elements: a second request for this src makes no request.
const file = await requestInclude('fragments/intro.html', 'same-origin');
console.log(file.ok, file.status, file.html.length);`;

@customElement('page-components-include')
export class IncludePage extends LitElement {
  static override styles = [shellStyles];

  override render() {
    return docsShell('include', html`
      <h1>Include</h1>
      <p><code>&lt;sl-include&gt;</code> is registered by <code>@charm-ux/velcro</code> on top of the <code>@charm-ux/core</code> base element. Prototype status: unreleased.</p>
      <p>Includes give you the power to embed external HTML files into the page.</p>
      <p>Included files are asynchronously requested using <code>window.fetch()</code>. Requests are cached, so the same file can be included multiple times, but only one request will be made.</p>
      <p>The included content will be inserted into the <code>&lt;sl-include&gt;</code> element's default slot so it can be easily accessed and styled through the light DOM.</p>
      <p><strong>Be sure you trust the content you are including.</strong> It is inserted as HTML and, with <code>allow-scripts</code>, executed as code, which can result in XSS attacks.</p>

      <h2 id="examples">Examples</h2>
      ${sections.map(
        ([id, title, key, text]) => html`
          <h3 id=${id}>${title}</h3>
          <p>${text}</p>
          <iframe class="example" title=${`Include example: ${title}`} srcdoc=${exampleDocument(examples[key], { siteRelative: true })}></iframe>
          <pre><code>${examples[key]}</code></pre>
        `
      )}

      ${apiReference('sl-include', {
        attributes: html`<p>None of the attributes reflect, and removing one sets its property to <code>null</code> (<code>allow-scripts</code> to <code>false</code>), as in Shoelace; see the upstream quirks below. Only <code>src</code> triggers a request.</p>`,
        events: html`<p><code>sl-load</code> and <code>sl-error</code> bubble, are composed and carry no cancelable default. <code>sl-load</code> has an empty <code>detail</code>; <code>sl-error</code> has <code>detail.status</code>, the HTTP status, or <code>-1</code> when the request threw (and <code>0</code> for a <code>no-cors</code> response). Inherited from core: a non-bubbling <code>ready</code> event on first update, which Shoelace does not have.</p>`,
        slots: html`<p>Shoelace documents no slot, so none is listed. The shadow root holds one unnamed slot that renders the element's light DOM, which is where the included content is inserted. The host is <code>display: block</code>.</p>`,
      })}

      <h2 id="request-include">The request helper</h2>
      <p>The function the element uses for its requests is available on its own, at the entry point Shoelace publishes it under (<code>dist/components/include/request.js</code>). It fetches <code>src</code> with the given <code>mode</code> (default <code>cors</code>), caches the result by <code>src</code>, and resolves with <code>{ ok, status, html }</code>.</p>
      <pre><code>${requestUsage}</code></pre>

      <h2 id="upstream-quirks">Upstream quirks matched</h2>
      <p>Velcro matches Shoelace 2.20.1 exactly, including behavior that looks like a bug. Each of these is covered by a product test and is a candidate for a later opt-in fix.</p>
      <ul>
        ${quirks.map(q => html`<li>${q}</li>`)}
      </ul>

      <h2 id="react">React</h2>
      <p>The React wrapper sets every prop as the element property, as Shoelace's wrappers do, and maps <code>onSlLoad</code> and <code>onSlError</code> to the <code>sl-load</code> and <code>sl-error</code> events. The prop for <code>allow-scripts</code> is <code>allowScripts</code>.</p>
      <pre><code>${reactUsage}</code></pre>

      <h2 id="not-implemented">Not implemented or unverified</h2>
      <p>Velcro extensions and limits of what has been checked.</p>
      <ul>
        ${gaps.map(g => html`<li>${g}</li>`)}
      </ul>
    `);
  }
}

export default IncludePage;
