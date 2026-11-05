import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { definePageData } from '@beatzball/litro';
import { docsShell, shellStyles } from '../../src/shell.js';
import { themeHead } from '../../src/theme.js';
import { examples, exampleDocument } from '../../src/example.js';

export const pageData = definePageData(async () => ({
  seoTitle: 'Button - Velcro',
  seoHead: themeHead + '<meta name="description" content="Velcro button (prototype).">',
}));

const attributes: Array<[string, string, string, string]> = [
  ['variant', "'default' | 'primary' | 'success' | 'neutral' | 'warning' | 'danger' | 'text'", 'default', "The button's theme variant. Reflects."],
  ['size', "'small' | 'medium' | 'large'", 'medium', "The button's size. Reflects."],
  ['caret', 'boolean', 'false', 'Draws the button with a caret. Used to indicate that the button triggers a dropdown menu or similar behavior. Reflects.'],
  ['disabled', 'boolean', 'false', 'Disables the button. Reflects.'],
  ['loading', 'boolean', 'false', 'Draws the button in a loading state. Reflects.'],
  ['outline', 'boolean', 'false', 'Draws an outlined button. Reflects.'],
  ['pill', 'boolean', 'false', 'Draws a pill-style button with rounded edges. Reflects.'],
  ['circle', 'boolean', 'false', 'Draws a circular icon button. When this attribute is present, the button expects a single icon element in the default slot. Reflects.'],
  ['type', "'button' | 'submit' | 'reset'", 'button', 'The type of button. The default is button, not submit as on a native button. When the type is submit, the button submits the surrounding form.'],
  ['name', 'string', "''", 'Submitted as a name/value pair with form data, but only when this button is the submitter. Ignored when href is present.'],
  ['value', 'string', "''", "Submitted with the button's name, but only when this button is the submitter. Ignored when href is present."],
  ['href', 'string', "''", 'When set, the button is rendered as an <a> with this href instead of a <button>.'],
  ['target', "'_blank' | '_parent' | '_self' | '_top'", '-', 'Tells the browser where to open the link. Only used when href is present.'],
  ['rel', 'string', 'noreferrer noopener', "Maps to the link's rel. The default prevents security exploits but also stops target from reaching a named tab or window; set it to an empty string or another value to change that. Only used when href is present."],
  ['download', 'string', '-', 'Tells the browser to download the linked file as this filename. Only used when href is present.'],
  ['form', 'string', '-', 'The id of the form that owns the button, in the same document or shadow root. If omitted, the closest containing form is used.'],
  ['formaction', 'string', '-', "Overrides the form owner's action."],
  ['formenctype', "'application/x-www-form-urlencoded' | 'multipart/form-data' | 'text/plain'", '-', "Overrides the form owner's enctype."],
  ['formmethod', "'post' | 'get'", '-', "Overrides the form owner's method."],
  ['formnovalidate', 'boolean', '-', "Overrides the form owner's novalidate."],
  ['formtarget', "'_self' | '_blank' | '_parent' | '_top' | string", '-', "Overrides the form owner's target."],
  ['title', 'string', "''", 'Passed to the inner control.'],
];

const sections: Array<[string, string, string, string]> = [
  ['overview', 'Overview', 'button/basic', 'Buttons represent actions that are available to the user. Clicks reach ordinary click listeners on the element; a disabled button receives none.'],
  ['variants', 'Variants', 'button/variants', 'Use the variant attribute to set the button\'s variant.'],
  ['sizes', 'Sizes', 'button/sizes', 'Use the size attribute to change a button\'s size.'],
  ['outline', 'Outline buttons', 'button/outline', 'Use the outline attribute to draw outlined buttons with transparent backgrounds.'],
  ['pill', 'Pill buttons', 'button/pill', 'Use the pill attribute to give buttons rounded edges.'],
  ['circle', 'Circle buttons', 'button/circle', 'Use the circle attribute to create circular icon buttons. Give the icon an accessible name; a label on the sl-button element itself does not reach the inner button.'],
  ['text', 'Text buttons', 'button/text', 'Use the text variant to create text buttons that share the same size as regular buttons but don\'t have backgrounds or borders.'],
  ['links', 'Link buttons', 'button/links', 'It\'s often helpful to have a button that works like a link. Set href and the button renders an <a> instead of a <button>; target and download work as on a link. A disabled link button has no href and swallows clicks.'],
  ['width', 'Setting a custom width', 'button/width', 'As expected, buttons can be given a custom width by setting the width attribute. This is useful for making buttons span the full width of their container on smaller screens.'],
  ['prefix-suffix', 'Prefix and suffix icons', 'button/prefix-suffix', 'Use the prefix and suffix slots to add icons. Velcro has no sl-icon yet, so these examples use text glyphs.'],
  ['caret', 'Caret', 'button/caret', 'Use the caret attribute to add a dropdown indicator when a button will trigger a dropdown, menu, or popover.'],
  ['loading', 'Loading', 'button/loading', 'Use the loading attribute to make a button busy. The width will remain the same as before, preventing adjacent elements from moving around. Clicks still work while loading, as in Shoelace.'],
  ['disabled', 'Disabled', 'button/disabled', 'Use the disabled attribute to disable a button.'],
  ['styling', 'Styling buttons', 'button/styling', 'This example demonstrates how to style buttons using a custom class. This is the recommended approach if you need to add additional variations. To customize an existing variation, modify the selector to target the button\'s variant attribute instead of a class (e.g. sl-button[variant="primary"]).'],
  ['forms', 'Forms', 'button/forms', 'A submit button submits its form with the button as the submitter: the submit event fires, constraint validation runs unless novalidate or formnovalidate is set, and the button\'s name and value are sent. A reset button resets the form.'],
];

const methods: Array<[string, string]> = [
  ['click()', 'Simulates a click on the button. Does nothing while disabled.'],
  ['focus(options?: FocusOptions)', 'Sets focus on the button.'],
  ['blur()', 'Removes focus from the button.'],
  ['checkValidity()', 'Checks for validity but does not show a validation message. Returns true when valid and false when invalid.'],
  ['getForm()', 'Gets the associated form, if one exists.'],
  ['reportValidity()', "Checks for validity and shows the browser's validation message if the control is invalid."],
  ['setCustomValidity(message: string)', 'Sets a custom validation message. Pass an empty string to restore validity.'],
];

const gaps = [
  'Velcro builds on the @charm-ux/core button and keeps its extras, which are not part of the Shoelace contract: toggle and pressed (an aria-pressed toggle button that emits a change event instead of acting on a form), expanded and current (aria-expanded / aria-current on the inner control), autofocus, referrerpolicy on links (defaults to strict-origin-when-cross-origin, the browser default), and shows / hides / toggles. The element also carries the core attribute "focusable" and emits the core ready event (see Events). The core icon-only and allow-wrap attributes are accepted but have no effect.',
  'A disabled link button swallows clicks: click listeners on the element do not run. Reading the Shoelace 2.20.1 source (not run here), the inner <a> of a disabled link there still delivers its click to listeners on the element. A disabled native button fires no click in either library.',
  'Form reset leaves the button\'s value alone. Reading the Shoelace 2.20.1 source (not run here), Shoelace sets a button\'s value to its undefined defaultValue on form reset, so a later submit sends the string "undefined" as the submitter value.',
  'The caret is an inline svg inside a <span part="caret"> instead of an <sl-icon>; Velcro has no icon component yet. The loading spinner is Velcro\'s own <sl-spinner>, which the sl-button entry and the package root register. The class-only entry registers nothing, so register a spinner yourself if you use loading with it.',
  'As in Shoelace, the element is not form-associated: it does not appear in form.elements, is not disabled by a disabled <fieldset>, and adds nothing to FormData unless it is the submitter. Implicit submission (Enter in a text field) does not use it as the default button. Submission goes through a temporary native button appended to the form, so event.submitter in the submit event is that <button>, not the sl-button element.',
  'As in Shoelace, a button attached to a form replaces the form\'s checkValidity() and reportValidity() with versions that also check Velcro controls (restored when the last one detaches), and sets data-valid / data-invalid / data-optional / data-user-valid / data-user-invalid attributes on itself.',
  'Registration is browser-only and uses the native custom element registry for Velcro\'s own class, without changing the shared core prefix. The package root is checked in Chromium against core\'s prefix, project configuration and scope maps, with core\'s own button loaded in either order. Scope-dependent core features (declared dependencies, scope-aware templates) are not supported. Server-side rendering is not supported.',
  'Shoelace\'s own button tests run against Velcro; the remaining failures are listed with reasons in the upstream ledger. Rendering is checked by computed-style assertions in Chromium; there is no pixel comparison against Shoelace, and no Firefox or WebKit run. Dark rendering is not screenshot-checked.',
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

      <h2 id="attributes">Attributes and properties</h2>
      <table>
        <thead><tr><th>Attribute</th><th>Type</th><th>Default</th><th>Description</th></tr></thead>
        <tbody>
          ${attributes.map(([a, v, d, desc]) => html`<tr><td><code>${a}</code></td><td>${v}</td><td><code>${d}</code></td><td>${desc}</td></tr>`)}
        </tbody>
      </table>
      <p>The form override properties are <code>formAction</code>, <code>formEnctype</code>, <code>formMethod</code>, <code>formNoValidate</code> and <code>formTarget</code>. Read-only: <code>validity</code> and <code>validationMessage</code> (always valid and empty for a link). Removing a reflected attribute restores the property's initial value, as in Shoelace.</p>

      <h2 id="methods">Methods</h2>
      <table>
        <thead><tr><th>Method</th><th>Description</th></tr></thead>
        <tbody>
          ${methods.map(([m, desc]) => html`<tr><td><code>${m}</code></td><td>${desc}</td></tr>`)}
        </tbody>
      </table>

      <h2 id="slots">Slots</h2>
      <p>Default (the button's label), <code>prefix</code> (a presentational prefix icon or similar element) and <code>suffix</code> (a presentational suffix icon or similar element).</p>

      <h2 id="parts">CSS parts</h2>
      <p><code>base</code> (the inner <code>&lt;button&gt;</code> or <code>&lt;a&gt;</code>), <code>prefix</code>, <code>label</code>, <code>suffix</code>, <code>caret</code> and <code>spinner</code>.</p>

      <h2 id="events">Events</h2>
      <p><code>sl-focus</code> and <code>sl-blur</code> (bubbling, composed), <code>sl-invalid</code> (emitted on the element when it has been checked for validity and its constraints aren't satisfied; does not bubble, cancelable), and the native <code>click</code>. Velcro extensions, not in Shoelace: <code>change</code> from a <code>toggle</code> button, and the core <code>ready</code> event, dispatched once on the element after its first update (it does not bubble and is not composed).</p>

      <h2 id="not-implemented">Not implemented or unverified</h2>
      <p>Differences from Shoelace 2.20.1 and limits of what has been checked.</p>
      <ul>
        ${gaps.map(g => html`<li>${g}</li>`)}
      </ul>
    `);
  }
}

export default ButtonPage;
