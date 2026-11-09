import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { definePageData } from '@beatzball/litro';
import { docsShell, shellStyles } from '../../src/shell.js';
import { themeHead } from '../../src/theme.js';
import { apiReference } from '../../src/api.js';
import { examples, exampleDocument } from '../../src/example.js';

export const pageData = definePageData(async () => ({
  seoTitle: 'Button - Velcro',
  seoHead: themeHead + '<meta name="description" content="Velcro button (prototype).">',
}));

const sections: Array<[string, string, string, string]> = [
  ['overview', 'Overview', 'button/basic', 'Buttons represent actions that are available to the user. Clicks reach ordinary click listeners on the element; a disabled native button receives none.'],
  ['variants', 'Variants', 'button/variants', 'Use the variant attribute to set the button\'s variant.'],
  ['sizes', 'Sizes', 'button/sizes', 'Use the size attribute to change a button\'s size.'],
  ['outline', 'Outline buttons', 'button/outline', 'Use the outline attribute to draw outlined buttons with transparent backgrounds.'],
  ['pill', 'Pill buttons', 'button/pill', 'Use the pill attribute to give buttons rounded edges.'],
  ['circle', 'Circle buttons', 'button/circle', 'Use the circle attribute to create circular icon buttons. Give the icon an accessible name; a label on the sl-button element itself does not reach the inner button.'],
  ['text', 'Text buttons', 'button/text', 'Use the text variant to create text buttons that share the same size as regular buttons but don\'t have backgrounds or borders.'],
  ['links', 'Link buttons', 'button/links', 'It\'s often helpful to have a button that works like a link. Set href and the button renders an <a> instead of a <button>; target and download work as on a link. A disabled link button renders without href, so it does not navigate; as in Shoelace, its clicks still reach click listeners on the element.'],
  ['width', 'Setting a custom width', 'button/width', 'As expected, buttons can be given a custom width by setting the width attribute. This is useful for making buttons span the full width of their container on smaller screens.'],
  ['prefix-suffix', 'Prefix and suffix icons', 'button/prefix-suffix', 'Use the prefix and suffix slots to add icons. These examples were ported before Velcro had sl-icon and still use text glyphs instead of Shoelace\'s icons.'],
  ['caret', 'Caret', 'button/caret', 'Use the caret attribute to add a dropdown indicator when a button will trigger a dropdown, menu, or popover.'],
  ['loading', 'Loading', 'button/loading', 'Use the loading attribute to make a button busy. The width will remain the same as before, preventing adjacent elements from moving around. Clicks still work while loading, as in Shoelace.'],
  ['disabled', 'Disabled', 'button/disabled', 'Use the disabled attribute to disable a button.'],
  ['styling', 'Styling buttons', 'button/styling', 'This example demonstrates how to style buttons using a custom class. This is the recommended approach if you need to add additional variations. To customize an existing variation, modify the selector to target the button\'s variant attribute instead of a class (e.g. sl-button[variant="primary"]).'],
  ['forms', 'Forms', 'button/forms', 'A submit button submits its form with the button as the submitter: the submit event fires, constraint validation runs unless novalidate or formnovalidate is set, and the button\'s name and value are sent. A reset button resets the form. As in Shoelace, a form reset also sets each button\'s value to its undefined defaultValue, so a later submit sends the string "undefined" as the submitter value.'],
];

const gaps = [
  'Velcro builds on the @charm-ux/core button and keeps its extras, which are not part of the Shoelace contract: toggle and pressed (an aria-pressed toggle button that emits a change event instead of acting on a form), expanded and current (aria-expanded / aria-current on the inner control), autofocus, referrerpolicy on links (defaults to strict-origin-when-cross-origin, the browser default), and shows / hides / toggles, whose actions do nothing while the button is disabled (a disabled link\'s click still reaches click listeners on the element). The element also carries the core attribute "focusable" and emits the core ready event (see Events). The core icon-only and allow-wrap attributes are accepted but have no effect.',
  'The caret is an inline svg inside a <span part="caret"> instead of an <sl-icon>, as before Velcro had an icon component. The loading spinner is Velcro\'s own <sl-spinner>, which the sl-button entry and the package root register when that tag is not defined yet; as with Shoelace\'s dependencies, an sl-spinner another constructor already owns is left in place, without an error; as in Shoelace, a console warning is logged when the two versions differ (Velcro\'s classes declare no version, so only when the other constructor declares one). The class-only entry registers nothing, so register a spinner yourself if you use loading with it.',
  'As in Shoelace, the element is not form-associated: it does not appear in form.elements, is not disabled by a disabled <fieldset>, and adds nothing to FormData unless it is the submitter. Implicit submission (Enter in a text field) does not use it as the default button. Submission goes through a temporary native button appended to the form, so event.submitter in the submit event is that <button>, not the sl-button element.',
  'As in Shoelace, a button attached to a form replaces the form\'s checkValidity() and reportValidity() with versions that also check Velcro controls (restored when the last one detaches), and sets data-valid / data-invalid / data-optional / data-user-valid / data-user-invalid attributes on itself.',
  'Registration is browser-only and uses the native custom element registry for Velcro\'s own class, without changing the shared core prefix. The package root is checked in Chromium, Firefox and WebKit against core\'s prefix, project configuration and scope maps, with core\'s own button loaded in either order. Scope-dependent core features (declared dependencies, scope-aware templates) are not supported. Server-side rendering is not supported.',
  'Shoelace\'s own button tests run against Velcro and all pass. Rendering is checked by computed-style assertions in Chromium, Firefox and WebKit; there is no pixel comparison against Shoelace. Dark rendering is not screenshot-checked.',
];

@customElement('page-components-button')
export class ButtonPage extends LitElement {
  static override styles = [shellStyles];

  override render() {
    return docsShell('button', html`
      <h1>Button</h1>
      <p><code>&lt;sl-button&gt;</code> is registered by <code>@charm-ux/velcro</code> on top of the <code>@charm-ux/core</code> button. Prototype status: unreleased.</p>
      <p>Buttons represent actions that are available to the user.</p>

      <h2 id="examples">Examples</h2>
      <p>Each preview runs in its own document, so its script uses plain <code>document.querySelector</code>.</p>
      ${sections.map(
        ([id, title, key, text]) => html`
          <h3 id=${id}>${title}</h3>
          <p>${text}</p>
          <iframe class="example" title=${`Button example: ${title}`} srcdoc=${exampleDocument(examples[key as keyof typeof examples])}></iframe>
          <pre><code>${examples[key as keyof typeof examples]}</code></pre>
        `
      )}

      ${apiReference('sl-button', {
        attributes: html`<p>Removing a reflected attribute restores the property's initial value, as in Shoelace. <code>validity</code> and <code>validationMessage</code> are always valid and empty for a link.</p>`,
        events: html`<p>The native <code>click</code> event also fires. <code>sl-focus</code> and <code>sl-blur</code> bubble and are composed; <code>sl-invalid</code> does not bubble and is cancelable. Velcro extensions, not in Shoelace: <code>change</code> from a <code>toggle</code> button, and the core <code>ready</code> event, dispatched once on the element after its first update (it does not bubble and is not composed).</p>`,
      })}

      <h2 id="not-implemented">Not implemented or unverified</h2>
      <p>Differences from Shoelace 2.20.1 and limits of what has been checked.</p>
      <ul>
        ${gaps.map(g => html`<li>${g}</li>`)}
      </ul>
    `);
  }
}

export default ButtonPage;
