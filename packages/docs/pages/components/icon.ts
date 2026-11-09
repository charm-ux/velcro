// Example sections and explanatory text adapted from Shoelace v2.20.1 (docs/pages/components/icon.md), Copyright (c)
// 2020 A Beautiful Site, LLC, MIT License. See THIRD_PARTY_NOTICES.md.
import { LitElement, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { definePageData } from '@beatzball/litro';
import { docsShell, shellStyles } from '../../src/shell.js';
import { themeHead } from '../../src/theme.js';
import { apiReference } from '../../src/api.js';
import { examples, exampleDocument } from '../../src/example.js';

export const pageData = definePageData(async () => ({
  seoTitle: 'Icon - Velcro',
  seoHead: themeHead + '<meta name="description" content="Velcro icon (prototype).">',
}));

type Section = [string, string, string, string];

const sections: Section[] = [
  ['colors', 'Colors', 'icon/colors', 'Icons inherit their color from the current text color. Thus, you can set the color property on the <sl-icon> element or an ancestor to change the color.'],
  ['sizing', 'Sizing', 'icon/sizing', 'Icons are sized relative to the current font size. To change their size, set the font-size property on the icon itself or on a parent element as shown below.'],
  ['labels', 'Labels', 'icon/labels', 'For non-decorative icons, use the label attribute to announce it to assistive devices.'],
  ['custom-icons', 'Custom icons', 'icon/custom', 'Custom icons can be loaded individually with the src attribute. Only SVGs on a local or CORS-enabled endpoint are supported. If you\'re using more than one custom icon, it might make sense to register a custom icon library. In an application you would usually set the src attribute to the icon\'s URL directly; this example sets src from a script only because this site\'s address depends on where it is deployed.'],
];

const cdn = ' The icons load from the CDN in your browser, and only after you choose to load the example; Velcro ships none of them.';
const libraries: Section[] = [
  ['boxicons', 'Boxicons', 'icon/boxicons', 'This will register the Boxicons library using the jsDelivr CDN. This library has three variations: regular (bx-*), solid (bxs-*), and logos (bxl-*). A mutator function is required to set the SVG\'s fill to currentColor. Icons in this library are licensed under the Creative Commons 4.0 License.' + cdn],
  ['lucide', 'Lucide', 'icon/lucide', 'This will register the Lucide icon library using the jsDelivr CDN. This project is a community-maintained fork of the popular Feather icon library. Icons in this library are licensed under the MIT License.' + cdn],
  ['font-awesome', 'Font Awesome', 'icon/font-awesome', 'This will register the Font Awesome Free library using the jsDelivr CDN. This library has three variations: regular (far-*), solid (fas-*), and brands (fab-*). A mutator function is required to set the SVG\'s fill to currentColor. Icons in this library are licensed under the Font Awesome Free License. Some of the icons that appear on the Font Awesome website require a license and are therefore not available in the CDN.' + cdn],
  ['heroicons', 'Heroicons', 'icon/heroicons', 'This will register the Heroicons library using the jsDelivr CDN. Icons in this library are licensed under the MIT License.' + cdn],
  ['iconoir', 'Iconoir', 'icon/iconoir', 'This will register the Iconoir library using the jsDelivr CDN. Icons in this library are licensed under the MIT License.' + cdn],
  ['ionicons', 'Ionicons', 'icon/ionicons', 'This will register the Ionicons library using the jsDelivr CDN. This library has three variations: outline (default), filled (*-filled), and sharp (*-sharp). A mutator function is required to polyfill a handful of styles we\'re not including. Icons in this library are licensed under the MIT License.' + cdn],
  ['jam', 'Jam Icons', 'icon/jam', 'This will register the Jam Icons library using the jsDelivr CDN. This library has two variations: regular (default) and filled (*-f). A mutator function is required to set the SVG\'s fill to currentColor. Icons in this library are licensed under the MIT License.' + cdn],
  ['material', 'Material Icons', 'icon/material', 'This will register the Material Icons library using the jsDelivr CDN. This library has three variations: outline (default), round (*_round), and sharp (*_sharp). A mutator function is required to set the SVG\'s fill to currentColor. Icons in this library are licensed under the Apache 2.0 License.' + cdn],
  ['remix', 'Remix Icon', 'icon/remix', 'This will register the Remix Icon library using the jsDelivr CDN. This library groups icons by categories, so the name must include the category and icon separated by a slash, as well as the -line or -fill suffix as needed. A mutator function is required to set the SVG\'s fill to currentColor. Icons in this library are licensed under the Apache 2.0 License.' + cdn],
  ['tabler', 'Tabler Icons', 'icon/tabler', 'This will register the Tabler Icons library using the jsDelivr CDN. This library features over 1,950 open source icons. Icons in this library are licensed under the MIT License.' + cdn],
  ['unicons', 'Unicons', 'icon/unicons', 'This will register the Unicons library using the jsDelivr CDN. This library has two variations: line (default) and solid (*-s). A mutator function is required to set the SVG\'s fill to currentColor. Icons in this library are licensed under the Apache 2.0 License. Some of the icons that appear on the Unicons website, particularly many of the solid variations, require a license and are therefore not available in the CDN.' + cdn],
];

const basePathExample = `<!-- Point Velcro at its dist folder, or a copy of it (it holds assets/icons) -->
<script type="module" src="app.js" data-shoelace="/path/to/velcro/dist"></script>

<!-- or set it from a script that runs before any icon is drawn -->
<script type="module">
  import { setBasePath } from '@charm-ux/velcro';

  setBasePath('/path/to/velcro/dist');
</script>`;

const registerExample = `<script type="module">
  import { registerIconLibrary } from '@charm-ux/velcro';

  registerIconLibrary('my-icons', {
    resolver: name => \`/assets/icons/\${name}.svg\`,
    mutator: svg => svg.setAttribute('fill', 'currentColor')
  });
</script>`;

const useExample = `<!-- This will show the icon located at /assets/icons/smile.svg -->
<sl-icon library="my-icons" name="smile"></sl-icon>`;

const defaultLibraryExample = `<script type="module">
  import { registerIconLibrary } from '@charm-ux/velcro';

  registerIconLibrary('default', {
    resolver: name => \`https://cdn.jsdelivr.net/npm/bootstrap-icons@1.0.0/icons/\${name}.svg\`
  });
</script>`;

const systemLibraryExample = `<script type="module">
  import { registerIconLibrary } from '@charm-ux/velcro';

  registerIconLibrary('system', {
    resolver: name => \`/path/to/custom/icons/\${name}.svg\`
  });
</script>`;

const gaps = [
  'Velcro builds on the @charm-ux/core icon but replaces how it resolves and draws icons: core\'s own icon set, its fallback icon, its visually hidden label and its icon-base part are not used, and core\'s styles (its base styles and its icon styles: inline-flex, contain: strict, vertical-align: middle, fill: currentColor) are replaced by Shoelace\'s. Velcro extensions kept from core: the url attribute, used like src but only when src is null (never set, or its attribute removed) and no library icon applies, and the icon-load and icon-error events, which fire together with sl-load and sl-error (icon-error carries the HTTP status in detail.status, or -1 when there is none). Changing url redraws only when url is the source in effect and no Shoelace property changed with it. The element also emits the core ready event.',
  'The default library resolves to assets/icons/<name>.svg under the base path, found as in Shoelace: a data-shoelace attribute on any script, else the folder of a script named shoelace.js or shoelace-autoloader.js (or their .min versions), else the site root, re-checked on each call while it is empty. Velcro has no script with those names, so in practice set the base path with setBasePath() or data-shoelace. The package ships Bootstrap Icons 1.11.3 (2,050 icons, MIT, with their license and an icons.json index) in dist/assets/icons, so the base path to use is the package\'s dist folder or a copy of it.',
  'TypeScript types for dir are narrower than Shoelace\'s dir: string. At runtime dir is stored and returned as set, and the setter accepts any string, so element.dir = someString compiles. The read type stays core\'s \'ltr\' | \'rtl\' | \'auto\', because a subclass cannot widen an inherited getter\'s type, and everything generated from it follows: the manifest and the API table below, the React wrapper\'s dir prop, and the JSX dir and prop:dir types. So <VelcroIcon dir={someString}> and <sl-icon dir={someString}> do not compile where Shoelace\'s types accept them. Fixing this needs a change in @charm-ux/core and is deferred. Other Velcro components inherit the same narrowed type, and sl-switch\'s setter is also still narrowed.',
  'registerIconLibrary, unregisterIconLibrary, getBasePath and setBasePath are exported from @charm-ux/velcro, @charm-ux/velcro/icon and @charm-ux/velcro/icon/class. There are no utilities/icon-library or utilities/base-path entry points.',
  'The icon search on this page is Velcro\'s own: Shoelace\'s uses sl-input, sl-select and sl-tooltip, and Velcro has no sl-select, so the search uses a native input and select. It matches icon names, titles, tags and categories. As in Shoelace, the first time the pointer lands on an icon it is wrapped in a live sl-tooltip that shows the icon\'s name, and clicking an icon copies its name and shows "Copied!" in that tooltip for a second; the tooltip is added on pointer hover only, so keyboard focus does not show it (the icon buttons carry their name as aria-label). The copy uses navigator.clipboard.writeText, where Shoelace\'s page selects a hidden input and calls document.execCommand(\'copy\').',
  'The CDN icon library examples load third-party icons from jsDelivr only when you choose to load them, so this page contacts no third party until then. The examples run in same-origin frames, and the icon parses each fetched file as HTML (see the quirks above), so only load examples whose source you trust. The Iconoir example is pinned to version 5.5.2 where Shoelace\'s docs use @latest (for the six icons shown, the same files). Velcro\'s tests answer the CDN requests locally, so they check the URLs each resolver builds and what each mutator sets, not the CDN content.',
  'Registration is browser-only and uses the native custom element registry for Velcro\'s own class, without changing the shared core prefix. Server-side rendering is not supported.',
  'Shoelace\'s own icon tests run against Velcro and all pass; one (an error for a missing sprite sheet icon) is skipped by Shoelace itself. Rendering is checked by computed-style assertions in Chromium, Firefox and WebKit; there is no pixel comparison against Shoelace.',
];

const quirks = [
  'When name, src and library change in the same update, the icon is drawn once per changed property: changing name and library together on a drawn icon fetches once (the cache is shared) but runs the mutator twice and emits sl-load (or sl-error) twice. The draw starts before the label is applied.',
  'An icon with the hidden attribute stays visible: the icon\'s display: inline-block beats the browser\'s [hidden] rule.',
  'The system library looks names up with the in operator, so inherited names such as toString or constructor resolve to a file that is not an SVG, and the icon emits sl-error instead of drawing nothing.',
  'The fetched file is parsed as HTML and not sanitized, so an event handler attribute in it (for example on an img next to the svg) runs in the page. Only use src and library URLs you trust.',
  'Responses are cached by URL for the page\'s lifetime and shared by every icon and library: a 410 or a file that is not an SVG stays cached as an error and is never requested again, other failures are requested again next time, and a URL first drawn by a sprite sheet library is drawn as a sprite reference for every icon that uses it, src included.',
  'A response that arrives after the icon\'s source changed is ignored, so only the latest source is drawn and only it emits an event.',
  'Sprite sheet icons never emit sl-load or sl-error, even when the sprite or the symbol does not exist.',
];

const example = ([id, title, key, text]: Section) => html`
  <h3 id=${id}>${title}</h3>
  <p>${text}</p>
  <iframe class="example" title=${`Icon example: ${title}`} srcdoc=${exampleDocument(examples[key as keyof typeof examples])}></iframe>
  <pre><code>${examples[key as keyof typeof examples]}</code></pre>
`;

const spriteSection: Section = [
  'sprite',
  'Customize the default library to use SVG sprites',
  'icon/sprite',
  'To improve performance you can use a SVG sprites to avoid multiple trips for each SVG. The browser will load the sprite sheet once and then you reference the particular SVG within the sprite sheet using hash selector. As always, make sure to benchmark these changes. When using HTTP/2, it may in fact be more bandwidth-friendly to use multiple small requests instead of 1 large sprite sheet. When using sprite sheets, the sl-load and sl-error events will not fire. For security reasons, browsers may apply the same-origin policy on <use> elements located in the <sl-icon> shadow DOM and may refuse to load a cross-origin URL, so sprite sheets should only be used if you\'re self-hosting them. This site serves the Bootstrap Icons sprite at assets/images/sprite.svg under its base path.',
];

@customElement('page-components-icon')
export class IconPage extends LitElement {
  static override styles = [shellStyles];

  // The CDN examples contact jsDelivr, so their frames are created only when the reader asks for them.
  @state() private loadedCdnExamples = new Set<string>();

  private cdnExample = ([id, title, key, text]: Section) => this.loadedCdnExamples.has(id)
    ? example([id, title, key, text])
    : html`
      <h3 id=${id}>${title}</h3>
      <p>${text}</p>
      <p><button type="button" class="load-cdn-example" @click=${() => { this.loadedCdnExamples = new Set([...this.loadedCdnExamples, id]); }}>Load ${title} example from jsDelivr</button></p>
      <pre><code>${examples[key as keyof typeof examples]}</code></pre>
    `;

  override render() {
    return docsShell('icon', html`
      <h1>Icon</h1>
      <p><code>&lt;sl-icon&gt;</code> is registered by <code>@charm-ux/velcro</code> on top of the <code>@charm-ux/core</code> icon. Prototype status: unreleased.</p>
      <p>Icons are symbols that can be used to represent various options within an application.</p>
      <p>Velcro comes bundled with over 2,000 icons courtesy of the Bootstrap Icons project. These icons are part of the <code>default</code> icon library. If you prefer, you may register custom icon libraries as well.</p>
      <p>Depending on how you're loading Velcro, you may need to copy icon assets and/or set the base path so it knows where to load them from. Otherwise, icons may not appear and you'll see 404 Not Found errors in the dev console.</p>
      <pre><code>${basePathExample}</code></pre>

      <h2 id="default-icons">Default icons</h2>
      <p>All available icons in the <code>default</code> icon library are shown below. Click or tap on any icon to copy its name, then you can use it in your HTML like this.</p>
      <pre><code>&lt;sl-icon name="icon-name-here"&gt;&lt;/sl-icon&gt;</code></pre>
      <iframe class="example" title="Icon search" srcdoc=${exampleDocument(examples['icon/default-icons'])}></iframe>

      <h2 id="examples">Examples</h2>
      <p>Each preview runs in its own document, so its script uses plain <code>document.querySelector</code>, and an import map lets it import <code>@charm-ux/velcro</code>.</p>
      ${sections.map(example)}

      <h2 id="icon-libraries">Icon libraries</h2>
      <p>You can register additional icons to use with the <code>&lt;sl-icon&gt;</code> component through icon libraries. Icon files can exist locally or on a CORS-enabled endpoint (e.g. a CDN). There is no limit to how many icon libraries you can register and there is no cost associated with registering them, as individual icons are only requested when they're used.</p>
      <p>Velcro ships with two built-in icon libraries, <code>default</code> and <code>system</code>. The default icon library contains all of the icons in the Bootstrap Icons project. The system icon library contains only the small set of icons Shoelace components use internally, hard-coded so they need no assets.</p>
      <p>To register an additional icon library, use the <code>registerIconLibrary()</code> function that's exported from <code>@charm-ux/velcro</code>. At a minimum, you must provide a name and a resolver function. The resolver function translates an icon name to a URL where the corresponding SVG file exists. Refer to the examples below to better understand how it works.</p>
      <p>If necessary, a mutator function can be used to mutate the SVG element before rendering. This is necessary for some libraries due to the many possible ways SVGs are crafted. For example, icons should ideally inherit the current text color via <code>currentColor</code>, so you may need to apply <code>fill="currentColor"</code> or <code>stroke="currentColor"</code> to the SVG element using this function.</p>
      <p>Here's an example that registers an icon library located in the <code>/assets/icons</code> directory.</p>
      <pre><code>${registerExample}</code></pre>
      <p>To display an icon, set the <code>library</code> and <code>name</code> attributes of an <code>&lt;sl-icon&gt;</code> element.</p>
      <pre><code>${useExample}</code></pre>
      <p>If an icon is used before registration occurs, it will be empty initially but shown when registered.</p>
      <p>The following examples demonstrate how to register a number of popular, open source icon libraries via CDN. Feel free to adapt the code as you see fit to use your own origin or naming conventions.</p>
      ${libraries.map(this.cdnExample)}

      <h3 id="customizing-the-default-library">Customizing the default library</h3>
      <p>The default icon library contains over 2,000 icons courtesy of the Bootstrap Icons project. These are the icons that display when you use <code>&lt;sl-icon&gt;</code> without the <code>library</code> attribute. If you prefer to have these icons resolve elsewhere or to a different icon library, register an icon library using the <code>default</code> name and a custom resolver.</p>
      <p>This example will load the same set of icons from the jsDelivr CDN instead of your local assets folder.</p>
      <pre><code>${defaultLibraryExample}</code></pre>
      ${example(spriteSection)}

      <h3 id="customizing-the-system-library">Customizing the system library</h3>
      <p>The system library contains only the icons used internally by Shoelace components. Unlike the default icon library, the system library does not rely on physical assets. Instead, its icons are hard-coded as data URIs into the resolver to ensure their availability.</p>
      <p>If you want to change the system icons, you can register an icon library using the <code>system</code> name and a custom resolver. If you choose to do this, it's your responsibility to provide all of the icons that are required by components.</p>
      <pre><code>${systemLibraryExample}</code></pre>

      ${apiReference('sl-icon', {
        attributes: html`<p>Removing a reflected attribute (<code>name</code>, <code>library</code>) restores the property's initial value, as in Shoelace. With no label the host gets <code>aria-hidden="true"</code>; with one it gets <code>role="img"</code> and <code>aria-label</code>.</p>`,
        events: html`<p><code>sl-load</code> and <code>sl-error</code> bubble and are composed, and do not fire for sprite sheets. Velcro extensions, not in Shoelace: the core <code>icon-load</code> and <code>icon-error</code> events, which fire together with them, and the core <code>ready</code> event, dispatched once on the element after its first update (it does not bubble and is not composed).</p>`,
      })}

      <h2 id="upstream-quirks">Upstream quirks matched</h2>
      <p>Shoelace 2.20.1 behaviors that Velcro reproduces on purpose, including bugs; each is a candidate for a later opt-in fix.</p>
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

export default IconPage;
