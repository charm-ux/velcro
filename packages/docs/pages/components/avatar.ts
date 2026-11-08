import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { definePageData } from '@beatzball/litro';
import { docsShell, shellStyles } from '../../src/shell.js';
import { themeHead } from '../../src/theme.js';
import { apiReference } from '../../src/api.js';
import { examples, exampleDocument, reactExamples } from '../../src/example.js';

export const pageData = definePageData(async () => ({
  seoTitle: 'Avatar - Velcro',
  seoHead: themeHead + '<meta name="description" content="Velcro avatar (prototype).">',
}));

// [id, title, example key, text, React example key], in the order of Shoelace's page.
const sections = [
  ['basic', 'Default', 'avatar/basic', 'By default, a generic icon will be shown. You can personalize avatars by adding custom icons, initials, and images. You should always provide a label for assistive devices.', 'avatar/react/basic'],
  ['images', 'Images', 'avatar/images', 'To use an image for the avatar, set the image and label attributes. This will take priority and be shown over initials and icons. Avatar images can be lazily loaded by setting the loading attribute to lazy. The photos of Shoelace\'s example are replaced by inline placeholder images.', 'avatar/react/images'],
  ['initials', 'Initials', 'avatar/initials', 'When you don\'t have an image to use, you can set the initials attribute to show something more personalized than an icon.', 'avatar/react/initials'],
  ['custom-icons', 'Custom Icons', 'avatar/custom-icons', 'When no image or initials are set, an icon will be shown. The default avatar shows a generic "user" icon, but you can customize this with the icon slot.', 'avatar/react/custom-icons'],
  ['shapes', 'Shapes', 'avatar/shapes', 'Avatars can be shaped using the shape attribute.', 'avatar/react/shapes'],
  ['groups', 'Avatar Groups', 'avatar/groups', 'You can group avatars with a few lines of CSS. The photos of Shoelace\'s example are replaced by inline placeholder images.', 'avatar/react/groups'],
] as const;

// Shoelace 2.20.1 behaviors that look like bugs but are matched exactly (candidates for a later opt-in fix). One line each.
const quirks = [
  'The hidden attribute does not hide the avatar: the host\'s own display: inline-block outranks the browser\'s [hidden] rule, so it stays displayed. Core\'s own base styles would hide it, so they are replaced by Shoelace\'s.',
  'The base part always has role="img" and always carries aria-label, so an avatar without a label is an image whose accessible name is empty. Shoelace asks for a label but does not require one.',
  'A failed image is retried only when image changes to a different value. Setting the same URL again keeps the fallback, even after the network recovers.',
  'Initials are not shortened: every character of initials is drawn, upper-cased by CSS, and long initials overflow the avatar. Shoelace recommends one or two characters.',
  'A shape value other than circle, square or rounded sets no shape class, so the avatar has square corners.',
] as const;

const gaps = [
  'The examples use inline placeholder images (data: URLs drawn for Velcro) where Shoelace\'s use photos from images.unsplash.com, so the docs site makes no third-party request; their labels describe the placeholders. Shoelace\'s React images example returns two adjacent elements, which is not valid JSX; the ported one wraps them in a fragment. The React examples import Velcro\'s generated wrappers (@charm-ux/velcro/react/VelcroAvatar.js and VelcroIcon.js) under Shoelace\'s names; nothing else differs.',
  'Velcro builds on the @charm-ux/core avatar but replaces its markup and styles. Core\'s avatar-* parts, its image, status-indicator and default slots and its --avatar-* custom properties do not exist on sl-avatar. Core declares image, label and initials as reflected attributes with no default; they are redeclared as in Shoelace (not reflected, default empty string). The only core extension that remains is the non-bubbling ready event on first update, which the API tables label as inherited from core.',
  'The default icon is an sl-icon from the system icon library, as in Shoelace. The registering entry (@charm-ux/velcro/avatar or the package root) registers Velcro\'s sl-icon up front. Importing the class-only entry (@charm-ux/velcro/avatar/class) registers nothing; as with Shoelace\'s declared dependencies, constructing an avatar defines Velcro\'s sl-icon when that tag is not defined yet, so no extra step is needed. If another constructor already owns sl-icon, the avatar renders that element and logs nothing, where Shoelace logs a warning when the registered version differs from its own.',
  'dir and lang are declared as Shoelace\'s base element declares them: reactive, not reflected and undefined until set. Core\'s computed dir is not used. TypeScript types for dir are narrower than Shoelace\'s dir: string: at runtime dir is stored and returned as set and the setter accepts any string, but the read type stays core\'s \'ltr\' | \'rtl\' | \'auto\', because a subclass cannot widen an inherited getter\'s type. Fixing this needs a change in @charm-ux/core and is deferred.',
  'The product test suite is configured for Chromium, Firefox and WebKit; this component\'s spec was run locally in Chromium and WebKit only, and Firefox is covered only by the project\'s CI run. Shoelace\'s own avatar test, including its axe accessibility checks, runs in Chromium only and passes. The accessibility-tree check is Playwright\'s ARIA snapshot, which Playwright computes from the DOM; no screen reader and no browser accessibility API was tried, and there is no RTL check and no pixel comparison with Shoelace. Lazy loading is passed to the image unchanged; when the browser defers the load was not tested.',
  'Registration is browser-only and uses the native custom element registry for Velcro\'s own class, without changing the shared core prefix. Server-side rendering is not supported.',
  'The avatar reads six theme tokens (--sl-color-neutral-400, --sl-color-neutral-0, --sl-font-sans, --sl-font-weight-normal, --sl-border-radius-circle and --sl-border-radius-medium); both Velcro themes define them. Without a theme the avatar has no background, font or rounded corners. Rendering under the dark theme has not been checked, and the contrast of the initials on the default background was not evaluated.',
];

@customElement('page-components-avatar')
export class AvatarPage extends LitElement {
  static override styles = [shellStyles];

  override render() {
    return docsShell('avatar', html`
      <h1>Avatar</h1>
      <p><code>&lt;sl-avatar&gt;</code> is registered by <code>@charm-ux/velcro</code> on top of the <code>@charm-ux/core</code> avatar. Prototype status: unreleased.</p>
      <p>Avatars are used to represent a person or object.</p>

      <h2 id="examples">Examples</h2>
      <p>Each preview runs in its own document. The React version of each example is Shoelace's, ported to Velcro's generated React wrappers; only its import lines and the images differ (and the images example gains a fragment). It is shown as source.</p>
      ${sections.map(
        ([id, title, key, text, react]) => html`
          <h3 id=${id}>${title}</h3>
          <p>${text}</p>
          <iframe class="example" title=${`Avatar example: ${title}`} srcdoc=${exampleDocument(examples[key])}></iframe>
          <pre><code>${examples[key]}</code></pre>
          <details class="react-example">
            <summary>React</summary>
            <pre><code>${reactExamples[react]}</code></pre>
          </details>
        `
      )}

      ${apiReference('sl-avatar', {
        attributes: html`<p>Only <code>shape</code> is reflected; removing its attribute restores <code>circle</code>. <code>image</code>, <code>label</code>, <code>initials</code> and <code>loading</code> are not reflected, as in Shoelace. Changing <code>image</code> clears the error state, so the new image is tried. <code>dir</code> and <code>lang</code> are reactive properties with no default that are not reflected, as in Shoelace's base element.</p>`,
        events: html`<p><code>sl-error</code> bubbles and is composed, with an empty <code>detail</code>. Inherited from core: a non-bubbling <code>ready</code> event on first update, which Shoelace does not have.</p>`,
        slots: html`<p>The <code>icon</code> slot replaces the default <code>sl-icon</code>. It is rendered only while there is no image to show and no initials.</p>`,
        parts: html`<p><code>base</code> is the element with <code>role="img"</code> and the label. Exactly one of <code>image</code> (an <code>img</code> with an empty <code>alt</code>), <code>initials</code> or <code>icon</code> (with <code>aria-hidden="true"</code>) is rendered inside it.</p>`,
        'css-properties': html`<p><code>--size</code> sets the width and height of the base part; the initials are drawn at half of it.</p>`,
      })}

      <h2 id="upstream-quirks">Upstream quirks matched</h2>
      <p>Velcro matches Shoelace 2.20.1 exactly, including behavior that looks like a bug. Each of these is covered by a product test and is a candidate for a later opt-in fix.</p>
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

export default AvatarPage;
