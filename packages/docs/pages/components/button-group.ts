import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { definePageData } from '@beatzball/litro';
import { docsShell, shellStyles } from '../../src/shell.js';
import { themeHead } from '../../src/theme.js';
import { apiReference } from '../../src/api.js';
import { examples, exampleDocument, reactExamples } from '../../src/example.js';

export const pageData = definePageData(async () => ({
  seoTitle: 'Button Group - Velcro',
  seoHead: themeHead + '<meta name="description" content="Velcro button group (prototype).">',
}));

const sections = [
  ['overview', 'Overview', 'button-group/basic', 'Set label to name the group: it is not shown, but assistive devices announce it when the user interacts with the group.', 'button-group/react/basic'],
  ['sizes', 'Button sizes', 'button-group/sizes', 'All button sizes are supported, but avoid mixing sizes within the same button group.', 'button-group/react/sizes'],
  ['theme', 'Theme buttons', 'button-group/theme-buttons', 'Theme buttons are supported through the button\'s variant attribute.', 'button-group/react/theme-buttons'],
  ['pill', 'Pill buttons', 'button-group/pill', 'Pill buttons are supported through the button\'s pill attribute.', 'button-group/react/pill'],
  ['dropdowns', 'Dropdowns in button groups', 'button-group/dropdown', 'Dropdowns can be placed inside button groups as long as the trigger is an sl-button element. Velcro has no sl-dropdown, sl-menu or sl-menu-item yet, so a plain span holds the trigger where sl-dropdown would and no menu opens. The group styles the button inside it as it does for a button inside sl-dropdown.', 'button-group/react/dropdown'],
  ['split', 'Split buttons', 'button-group/split', 'Create a split button using a button and a dropdown. Use a visually hidden label to ensure the dropdown is accessible to users with assistive devices. As above, a plain span stands in for sl-dropdown and no menu opens.', 'button-group/react/split'],
  ['tooltips', 'Tooltips in button groups', 'button-group/tooltips', 'Buttons can be wrapped in tooltips to provide more detail when the user interacts with them. Velcro has no sl-tooltip yet, so each button is wrapped in a span with a title attribute and the browser\'s own tooltip shows.', 'button-group/react/tooltips'],
  ['toolbar', 'Toolbar example', 'button-group/toolbar', 'Create interactive toolbars with button groups. The tooltips are title attributes, as above.', 'button-group/react/toolbar'],
] as const;

// Shoelace 2.20.1 behaviors that look like bugs but are matched exactly (candidates for a later opt-in fix). One line each.
const quirks = [
  'Only the first button inside a slotted element gets the group\'s data attributes: the element itself if it is an sl-button, otherwise its closest sl-button ancestor, otherwise its first sl-button descendant. A wrapper that holds several buttons styles just one of them, and a slotted element with no button gets nothing.',
  'The data attributes are recomputed only when the default slot\'s assigned elements change (a slotchange event). A button added to, or removed from, a wrapper that is already slotted does not trigger it, so the group\'s first, inner and last attributes stay as they were.',
  'Nothing is removed from a button when it leaves the group: the data-sl-button-group__button attribute stays on it, with the position (first, inner or last) and the hover attribute it had, until another group computes them again. The group it left recomputes the buttons that stayed.',
  'aria-label is always written on the base element, so a group with no label has aria-label="" (an empty value, which assistive devices treat as no name).',
  'The hidden attribute does not hide the group: the host\'s own display: inline-block outranks the browser\'s [hidden] rule, so a hidden group stays visible.',
] as const;

const gaps = [
  'The Shoelace examples that use sl-dropdown, sl-menu, sl-menu-item and sl-tooltip are ported with plain stand-ins, because Velcro does not implement those elements yet: a span holds the dropdown trigger (no menu opens) and a span with a title attribute stands in for each tooltip (the browser\'s tooltip, not sl-tooltip\'s). The group\'s behavior with the real elements is therefore not checked. The stand-in source is shown, with a comment that says so.',
  'The group also styles sl-radio-button elements (the data-sl-button-group__button--radio attribute), and sl-radio-group renders a button group with disableRole set around its radio buttons, as in Shoelace; that use is covered by the radio group\'s and radio button\'s product tests.',
  'Velcro builds on the @charm-ux/core button group and keeps two of its extras, which are not part of the Shoelace contract: select (single or multiple marks the slotted sl-button elements as toggle buttons; single also un-presses the other buttons when one is toggled) and toolbar (role="toolbar" on the base element, a roving tab index on the buttons and arrow-key focus movement between the slotted elements, also applied to nested groups). Both only act while set and are released when removed (the toolbar key handler, the roving tab index and the toggle attribute the group wrote are taken back, and so is the toolbar attribute it gave nested groups), so a group without them is a plain Shoelace group; the exception is the reflected-property restore described under Attributes, which puts a property that was set from script before its attribute first changed back when the attribute is removed. Core\'s button-group-button-position attribute is not written to the buttons, and core\'s own button and group styles do not apply to Velcro\'s sl-button, so core\'s vertical and split attributes are accepted but have no effect, and core\'s --button-group-* custom properties and button-group-base part do not exist. Core\'s tooltip distance for a group is not applied either. The core ready event is emitted once after the first update (see Events).',
  'The select and toolbar extensions are checked only with sl-button children, and they work as core does: toggle and the roving tab index are written on a slot change, so setting select or toolbar after the buttons are slotted does not apply either until the slot next changes, and the single-select reset listens only if select was set when the group connected (a later select leaves every toggled button pressed). Both are covered by product tests.',
  'dir and lang are declared as Shoelace\'s base element declares them: reactive, not reflected and undefined until set. Core\'s computed dir is not used.',
  'TypeScript types for dir are narrower than Shoelace\'s dir: string. At runtime dir is stored and returned as set, and the setter accepts any string, so element.dir = someString compiles (type-tests/button-group-dir.tsx checks it). The read type stays core\'s \'ltr\' | \'rtl\' | \'auto\', because a subclass cannot widen an inherited getter\'s type, and everything generated from it follows: the manifest and the API table below, the React wrapper\'s dir prop, and the JSX dir and prop:dir types. So <VelcroButtonGroup dir={someString}> and <sl-button-group dir={someString}> do not compile where Shoelace\'s types accept them. Fixing this needs a change in @charm-ux/core and is deferred.',
  'The element is covered by product tests (structure, ARIA, the data attributes and the computed button styles they drive, focus and hover tracking, the examples and their React versions) that were run in Chromium and WebKit when it was written; they are also configured for Firefox, which only CI runs. In Chromium, Shoelace\'s five button group tests, including its axe accessibility check, all pass. There is no RTL, screen reader or pixel comparison with Shoelace, and the examples\' appearance under the dark theme has not been checked.',
  'Registration is browser-only and uses the native custom element registry for Velcro\'s own class, without changing the shared core prefix; core\'s scope lookups go through Velcro\'s local scope resolver. Server-side rendering is not supported.',
  'The group has no theme tokens of its own; its buttons use the button\'s tokens, so it works with both themes.',
];

@customElement('page-components-button-group')
export class ButtonGroupPage extends LitElement {
  static override styles = [shellStyles];

  override render() {
    return docsShell('button-group', html`
      <h1>Button Group</h1>
      <p><code>&lt;sl-button-group&gt;</code> is registered by <code>@charm-ux/velcro</code> on top of the <code>@charm-ux/core</code> button group. Prototype status: unreleased.</p>
      <p>Button groups can be used to group related buttons into sections.</p>

      <h2 id="examples">Examples</h2>
      <p>Each preview runs in its own document, so its script uses plain <code>document.querySelector</code>. Every example also has Shoelace's React version, ported to Velcro's generated React wrappers (<code>@charm-ux/velcro/react/VelcroButtonGroup.js</code>, <code>VelcroButton.js</code>, <code>VelcroIcon.js</code> and <code>VelcroVisuallyHidden.js</code>, imported under Shoelace's names); their import lines and the stand-ins differ from Shoelace's, and two ports add what Shoelace's HTML example has and its React snippet lacks, so that they match the HTML examples here: the split example's trigger button holds an <code>SlVisuallyHidden</code> "More options" label, and the toolbar example's icons have <code>label</code> attributes. They are shown as source and run by the product tests.</p>
      ${sections.map(
        ([id, title, key, text, react]) => html`
          <h3 id=${id}>${title}</h3>
          <p>${text}</p>
          <iframe class="example" title=${`Button Group example: ${title}`} srcdoc=${exampleDocument(examples[key])}></iframe>
          <pre><code>${examples[key]}</code></pre>
          <details class="react-example">
            <summary>React</summary>
            <pre><code>${reactExamples[react]}</code></pre>
          </details>
        `
      )}

      ${apiReference('sl-button-group', {
        attributes: html`<p>Only <code>label</code> is a Shoelace attribute; it is not reflected. The group sets data attributes on its slotted buttons (<code>data-sl-button-group__button</code>, <code>--first</code>, <code>--inner</code>, <code>--last</code>, <code>--radio</code>, <code>--hover</code> and <code>--focus</code>), which the button's styles read. <code>defaultSlot</code> and <code>disableRole</code> are Shoelace's public but undocumented members. Velcro extensions, not in Shoelace: <code>select</code> and <code>toolbar</code> (inherited from core and kept working), and <code>vertical</code> and <code>split</code>, which are accepted and reflected but have no effect (the API table marks them inert). Removing a reflected attribute restores the property's initial value, as in Shoelace, which only matters for those four. <code>dir</code> and <code>lang</code> are reactive properties with no default that are not reflected, as in Shoelace's base element.</p>`,
        events: html`<p>Shoelace's button group has no events. Inherited from core: a non-bubbling <code>ready</code> event on first update, which Shoelace does not have. Core's <code>change</code> is not emitted by the group; it only listens for the <code>change</code> events of its buttons.</p>`,
        slots: html`<p>Slot the buttons directly, or inside an element that holds one (a tooltip or dropdown anchor).</p>`,
        parts: html`<p>The <code>base</code> part is the wrapper around the slot, as in Shoelace.</p>`,
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

export default ButtonGroupPage;
