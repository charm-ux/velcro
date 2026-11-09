import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { definePageData } from '@beatzball/litro';
import { docsShell, shellStyles } from '../../src/shell.js';
import { themeHead } from '../../src/theme.js';
import { apiReference } from '../../src/api.js';
import { examples, exampleDocument, reactExamples } from '../../src/example.js';

export const pageData = definePageData(async () => ({
  seoTitle: 'Alert - Velcro',
  seoHead: themeHead + '<meta name="description" content="Velcro alert (prototype).">',
}));

// Shoelace's examples, in the order of its page: [id, title, text, example key, React example key or null]. The first has
// no heading in Shoelace's page; it is the page's opening example. Every example is live; Shoelace's last one has no React
// version.
const sections = [
  ['basic', 'Default', html`Alerts will not be visible if the <code>open</code> attribute is not present.`, 'alert/basic', 'alert/react/basic'],
  ['variants', 'Variants', html`Set the <code>variant</code> attribute to change the alert's variant.`, 'alert/variants', 'alert/react/variants'],
  ['closable', 'Closable', html`Add the <code>closable</code> attribute to show a close button that will hide the alert.`, 'alert/closable', 'alert/react/closable'],
  ['without-icons', 'Without Icons', html`Icons are optional. Simply omit the <code>icon</code> slot if you don't want them.`, 'alert/without-icons', 'alert/react/without-icons'],
  ['duration', 'Duration', html`Set the <code>duration</code> attribute to automatically hide an alert after a period of time. This is useful for alerts that don't require acknowledgement.`, 'alert/duration', 'alert/react/duration'],
  ['countdown', 'Countdown', html`Set the <code>countdown</code> attribute to display a loading bar that indicates the alert remaining time. This is useful for alerts with relatively long duration.`, 'alert/countdown', 'alert/react/countdown'],
  ['toast', 'Toast Notifications', html`To display an alert as a toast notification, or "toast", create the alert and call its <code>toast()</code> method. This will move the alert out of its position in the DOM and into the toast stack where it will be shown. Once dismissed, it will be removed from the DOM completely. To reuse a toast, store a reference to it and call <code>toast()</code> again later on. You should always use the <code>closable</code> attribute so users can dismiss the notification. It's also common to set a reasonable <code>duration</code> when the notification doesn't require acknowledgement.`, 'alert/toast', 'alert/react/toast'],
  ['creating-toasts-imperatively', 'Creating Toasts Imperatively', html`For convenience, you can create a utility that emits toast notifications with a function call rather than composing them in your HTML. To do this, generate the alert with JavaScript, append it to the body, and call the <code>toast()</code> method as shown in the example below.`, 'alert/toast-imperative', null],
] as const;

// Shoelace's Toast Stack section: a CSS snippet, not a live example.
const toastStackCss = `.sl-toast-stack {
  left: 0;
  right: auto;
}`;

// Shoelace 2.20.1 behaviors that look like bugs but are matched exactly (candidates for a later opt-in fix). One line each.
const quirks = [
  'The hidden attribute does not hide the alert: the host is display: contents, which outranks the browser\'s [hidden] rule, so an open alert stays displayed. Only open shows and hides it.',
  'A duration change that arrives in the same update that first renders the countdown bar of an open alert throws a TypeError before the render: the countdown is started before the bar exists. So an alert written in markup with open, a finite duration and countdown all set does not render (its shadow root stays empty), and setting countdown and duration together on an open alert leaves it without the bar. Without countdown, or opened later with show(), it works.',
  'Removing the duration attribute does not restore Infinity (duration is not reflected): it sets the property to null, which counts as a finite duration of 0, so an open alert hides on the next timer tick.',
  'Moving the pointer over the alert pauses the auto-hide timer, and moving it out resumes it with the time that was left; it does not start the full duration again, although the duration description says the timer will restart.',
  'Calling toast() on an alert that is already shown as a toast adds a second sl-after-hide listener; when the alert then hides, the second listener tries to remove the alert from the toast stack again and throws a NotFoundError (reported as an uncaught error).',
  'The document direction used to pick an animation\'s rtlKeyframes is the localization controller\'s snapshot of <html dir>, refreshed by its mutation observer or a translation registration, not a live read: a change made in the same task as show() or hide() (for example in an sl-show listener) is not seen by that animation.',
  'The close button is the only way to dismiss the alert from the keyboard: there is no Escape handling. The close button is a regular tab stop, and its label is the localization module\'s close term in the alert\'s own language.',
  'A variant outside the documented list is kept as given and gets no variant class: the top border and the icon take the panel border color and the inherited text color, and the countdown bar has no color.',
  'Removing a reflected attribute restores what the property held when the alert\'s first attribute change was handled, as Shoelace\'s base element does: normally the default primary for variant. countdown has no value then, so removing it leaves null (no countdown), and a removed Boolean attribute (open, closable) gives false.',
  'Shoelace\'s React examples pass duration="3000" as a string; the wrapper sets the property to that string, which still works because it is compared as a number. Its Countdown React example uses duration="3000" where the HTML example uses 10000; both are kept as Shoelace has them.',
] as const;

const gaps = [
  'All of Shoelace\'s examples (the opening one, Variants, Closable, Without Icons, Duration, Countdown, Toast Notifications and Creating Toasts Imperatively) are ported with a live preview, in Shoelace\'s order, and every one that has a React version in Shoelace\'s page has it here. The React examples import Velcro\'s generated wrappers (@charm-ux/velcro/react/VelcroAlert.js and the others they use) under Shoelace\'s names; nothing else differs.',
  'The toast stack is a <div class="sl-toast-stack"> appended to the document body. Shoelace\'s built themes include the rules that position it (src/themes/_utility.css: fixed to the top end of the viewport, the toast z-index, a scrollable column of alerts with a medium margin and a large shadow), and so do Velcro\'s two themes; without a theme the toasts sit unpositioned at the end of the body.',
  'Velcro\'s sl-alert is built on the @charm-ux/core alert. Kept core extension: toggle() shows a hidden alert and hides an open one. The core dismissible, closeLabel (closelabel), heading and politeness properties are accepted, and dismissible is reflected, but they have no effect: the close button follows closable, its label is the localized close term, there is no heading, and the message is always aria-live="polite", as in Shoelace. The core alert events (alert-show, alert-after-show, alert-hide, alert-after-hide) are never emitted, and core\'s alert markup, --alert-* custom properties and parts are not used. The non-bubbling ready event on first update is inherited from core; the API tables label it as such.',
  'The close button is an sl-icon-button, as in Shoelace. The registering entry (@charm-ux/velcro/alert or the package root) registers Velcro\'s sl-icon-button and sl-icon up front, each when its tag is not defined yet. Importing the class-only entry (@charm-ux/velcro/alert/class) registers nothing; as with Shoelace\'s declared dependencies, constructing an alert defines Velcro\'s sl-icon-button when that tag is not defined yet (and constructing that defines sl-icon). If another constructor already owns sl-icon-button, the alert renders that element and, as in Shoelace, logs a console warning when the two versions differ (Velcro\'s classes declare no version, so the warning appears only when the other constructor declares one, such as a Shoelace element).',
  'The show and hide animations come from the animation registry (@charm-ux/velcro/utilities/animation-registry, Shoelace\'s dist/utilities/animation-registry.js) under the names alert.show and alert.hide, with Shoelace\'s defaults (scale 0.8 to 1 and opacity over 250 ms, ease). The animation direction (which picks an animation\'s rtlKeyframes) is the alert\'s dir property, else the localization controller\'s document-direction snapshot, as Shoelace\'s controller resolves it; the product tests check both, and the snapshot timing (see the quirks). Reduced motion is honored by the registry\'s animateTo, as in Shoelace.',
  'dir and lang are declared as Shoelace\'s base element declares them: reactive, not reflected and undefined until set. Core\'s computed dir is not used. TypeScript types for dir are narrower than Shoelace\'s dir: string: at runtime dir is stored and returned as set and the setter accepts any string, but the read type stays core\'s \'ltr\' | \'rtl\' | \'auto\', because a subclass cannot widen an inherited getter\'s type. Fixing this needs a change in @charm-ux/core and is deferred.',
  'The product test suite is configured for Chromium, Firefox and WebKit; this component\'s spec was run locally in Chromium and WebKit only, and Firefox is covered only by the project\'s CI run. Shoelace\'s own alert test (24 tests, including its axe accessibility check) runs in Chromium only and passes. The accessibility-tree check is Playwright\'s ARIA snapshot, which Playwright computes from the DOM; no screen reader and no browser accessibility API was tried, and there is no RTL layout check and no pixel comparison with Shoelace.',
  'Registration is browser-only and uses the native custom element registry for Velcro\'s own class, without changing the shared core prefix. Server-side rendering is not supported.',
  'The alert reads these theme tokens: --sl-panel-background-color, --sl-panel-border-width, --sl-panel-border-color, --sl-border-radius-medium, --sl-font-sans, --sl-font-size-{small,medium,large}, --sl-font-weight-normal, --sl-color-neutral-700, --sl-color-{primary,success,neutral,warning,danger}-600 and --sl-spacing-{medium,large}, and the toast stack --sl-z-index-toast, --sl-spacing-medium and --sl-shadow-large; both Velcro themes define them. Rendering under the dark theme has not been checked, and color contrast was not evaluated.',
];

@customElement('page-components-alert')
export class AlertPage extends LitElement {
  static override styles = [shellStyles];

  override render() {
    return docsShell('alert', html`
      <h1>Alert</h1>
      <p><code>&lt;sl-alert&gt;</code> is registered by <code>@charm-ux/velcro</code> on top of the <code>@charm-ux/core</code> alert. Prototype status: unreleased.</p>
      <p>Alerts are used to display important messages inline or as toast notifications.</p>

      <h2 id="examples">Examples</h2>
      <p>Each preview runs in its own document. The React version of each live example is Shoelace's, ported to Velcro's generated React wrappers; only its import lines differ. It is shown as source.</p>
      ${sections.map(
        ([id, title, text, key, react]) => html`
          <h3 id=${id}>${title}</h3>
          <p>${text}</p>
          <iframe class="example" title=${`Alert example: ${title}`} srcdoc=${exampleDocument(examples[key])}></iframe>
          <pre><code>${examples[key]}</code></pre>
          ${react === null
            ? ''
            : html`<details class="react-example">
                <summary>React</summary>
                <pre><code>${reactExamples[react]}</code></pre>
              </details>`}
        `
      )}

      <h3 id="toast-stack">The Toast Stack</h3>
      <p>The toast stack is a fixed position singleton element created and managed internally by the alert component. It will be added and removed from the DOM as needed when toasts are shown. When more than one toast is visible, they will stack vertically in the toast stack.</p>
      <p>By default, the toast stack is positioned at the top-right of the viewport. You can change its position by targeting <code>.sl-toast-stack</code> in your stylesheet. To make toasts appear at the top-left of the viewport, for example, use the following styles.</p>
      <pre><code>${toastStackCss}</code></pre>
      <p>By design, it is not possible to show toasts in more than one stack simultaneously. Such behavior is confusing and makes for a poor user experience.</p>

      ${apiReference('sl-alert', {
        attributes: html`<p><code>open</code>, <code>closable</code>, <code>variant</code> and <code>countdown</code> are reflected; <code>duration</code> is not (it defaults to <code>Infinity</code>, so the alert never hides on its own). Removing a reflected attribute restores the value the property held when the alert's first attribute change was handled, as in Shoelace's base element. <code>dir</code> and <code>lang</code> are reactive properties with no default that are not reflected, as in Shoelace's base element. The core <code>dismissible</code>, <code>closelabel</code>, <code>heading</code> and <code>politeness</code> attributes are accepted without effect (see below).</p>`,
        methods: html`<p><code>show()</code> and <code>hide()</code> resolve after <code>sl-after-show</code> or <code>sl-after-hide</code>, and resolve to <code>undefined</code> at once when the alert is already in that state. <code>toast()</code> moves the alert into the toast stack, shows it, and resolves after it hides and is removed from the DOM. Velcro extension from core: <code>toggle()</code>.</p>`,
        events: html`<p><code>sl-show</code>, <code>sl-after-show</code>, <code>sl-hide</code> and <code>sl-after-hide</code> bubble and are composed, are not cancelable and have an empty <code>detail</code>. Inherited from core: a non-bubbling <code>ready</code> event on first update, which Shoelace does not have.</p>`,
        parts: html`<p><code>base</code> is the inner <code>div</code> with <code>role="alert"</code>, hidden while the alert is closed; it holds the <code>icon</code> part (the <code>icon</code> slot), the <code>message</code> part (the default slot, <code>aria-live="polite"</code>) and, while <code>closable</code>, an <code>sl-icon-button</code> (the <code>close-button</code> part, labelled with the localized <code>close</code> term, using the <code>x-lg</code> icon of the <code>system</code> library) that re-exports its own <code>base</code> part as <code>close-button__base</code>.</p>`,
      })}

      <h2 id="upstream-quirks">Upstream quirks matched</h2>
      <p>Velcro matches Shoelace 2.20.1 exactly, including behavior that looks like a bug. Each of these is covered by a product test. Each is a candidate for a later opt-in fix.</p>
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

export default AlertPage;
