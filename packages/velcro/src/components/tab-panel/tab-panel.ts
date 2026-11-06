// Adapted from Shoelace v2.20.1 (src/components/tab-panel/tab-panel.component.ts and the reflected-property restore in
// src/internal/shoelace-element.ts), Copyright (c) 2020 A Beautiful Site, LLC, MIT License. See THIRD_PARTY_NOTICES.md.
// The API documentation wording, the rendered structure (one slot carrying the `base` part and the `tab-panel` /
// `tab-panel--active` classes), the generated `sl-tab-panel-<n>` id, the `role` and `aria-hidden` handling and the
// restore of reflected properties' initial values follow Shoelace. Velcro changes: built on the @charm-ux/core tab panel
// (see the class comment for what is kept and what is switched off). Shoelace's behavior is matched exactly, including
// its quirks; each one is marked "Upstream quirk" below and listed on the docs page.
import { html, type PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { CharmElement } from '@charm-ux/core/dist/base/charm-element/charm-element.js';
import { CoreTabPanel } from '@charm-ux/core/dist/components/tab-panel/tab-panel.js';
import styles from './tab-panel.styles.js';

// Upstream quirk: the counter is shared by every tab panel and advances when a panel is constructed, not when it is
// connected, so a panel that is created and never connected still uses a number.
let id = 0;

/**
 * Tab panels are used inside tab groups to display tabbed content. API modelled on Shoelace's `sl-tab-panel`.
 *
 * Velcro extensions inherited from the core tab panel and kept working: the core `ready` event only. The rest of core's
 * tab panel belongs to core's own tabs and conflicts with Shoelace's model (default slot, `active`, `display`), so it is
 * switched off: core's `slot="tabpanel"`, `hidden` and `transitionend` handling do not run, its internal `visible` and
 * `tab` properties have no effect (`visible` has no attribute either), the `tab-show`, `tab-hide`, `tab-after-show` and
 * `tab-after-hide` events are never emitted, and core's `--tab-panel-*` custom properties and `tab-panel-base` part do
 * not exist.
 *
 * @tag sl-tab-panel
 * @status prototype
 *
 * @slot - The tab panel's content.
 *
 * @csspart base - The component's base wrapper.
 *
 * @cssproperty [--padding=0] - The tab panel's padding.
 */
export class VelcroTabPanel extends CoreTabPanel {
  // Core's base and tab panel styles are replaced by Shoelace's own (see the styles file). Core adds a
  // `:host([hidden]) { display: none !important }` rule, which Shoelace does not have, and its panel styles style a
  // `tab-panel-base` wrapper that this template does not render.
  public static override styles = [styles];

  // Core's protected `handleTransitionEnd`, `hidePanel` and `tabPanelTemplate` are still inherited (and so still listed
  // in the manifest as protected members), but nothing calls them: `connectedCallback` does not add the listener,
  // `willUpdate` is not run and `render` is replaced.

  private readonly attrId = ++id;

  private readonly componentId = `sl-tab-panel-${this.attrId}`;

  private hasRecordedInitialProperties = false;

  private readonly initialReflectedProperties = new Map<string, unknown>();

  private velcroDir?: string;

  // Core declares `visible` as a reflected attribute. Shoelace has no such member, and a `visible` attribute would
  // change which attributes are observed and, through the restore of reflected properties below, when the initial
  // values are recorded. It is redeclared here with no attribute and no reflection, so the attribute is neither
  // observed nor written; the value does nothing, because core's `willUpdate` that reads it is not run.
  /** @internal Core's show/hide flag. Switched off: it has no attribute and no effect. */
  @property({ attribute: false })
  public override visible?: boolean;

  // `dir` and `lang` are declared as Shoelace's base element declares them: reactive, not reflected and without an
  // initial value (undefined). Core's `dir` would return the computed direction instead.
  // Types: Shoelace declares `dir: string`. The setter accepts any string, as Shoelace's does. The getter must keep
  // core's declared type, because TypeScript does not let a subclass widen an inherited property's read type; at
  // runtime it returns whatever was set.
  /**
   * The element's text direction, as set by the `dir` attribute or property and returned as set. Not reflected. Any
   * string can be assigned; the declared read type stays core's `'ltr' | 'rtl' | 'auto'`.
   */
  @property()
  public override get dir(): 'ltr' | 'rtl' | 'auto' {
    return this.velcroDir as 'ltr' | 'rtl' | 'auto';
  }
  public override set dir(value: string) {
    this.velcroDir = value;
  }

  /** The element's language, as set by the `lang` attribute or property. Not reflected. */
  @property()
  public override lang!: string;

  /** The tab panel's name. */
  @property({ reflect: true })
  public name = '';

  /** When true, the tab panel will be shown. */
  @property({ type: Boolean, reflect: true })
  public active = false;

  // Upstream behavior: the first time any observed attribute changes (including `dir` and `lang`), the values of all
  // reflected properties that are not null are recorded, and when one of them later becomes null (its attribute was
  // removed) it is set back to the recorded value.
  public override attributeChangedCallback(name: string, previous: string | null, next: string | null) {
    if (!this.hasRecordedInitialProperties) {
      (this.constructor as typeof VelcroTabPanel).elementProperties.forEach((options, prop) => {
        // Reflection is checked first, as upstream does, so that a non-reflected property's getter is not read here.
        if (options.reflect) {
          const current = (this as unknown as Record<PropertyKey, unknown>)[prop];
          if (current != null) {
            this.initialReflectedProperties.set(prop as string, current);
          }
        }
      });
      this.hasRecordedInitialProperties = true;
    }
    super.attributeChangedCallback(name, previous, next);
  }

  // Upstream quirks: the id is only generated when the element is connected, and only when it has none; `role` is
  // always set to `tabpanel` on connect, replacing any role the page gave the element.
  public override connectedCallback() {
    // Not `super.connectedCallback()`: core's tab panel would also set `slot="tabpanel"` (which would take the panel
    // out of the default slot of a Shoelace-style tab group), set `hidden`, and add a `transitionend` listener on every
    // connect. The core base element's own callback still runs.
    CharmElement.prototype.connectedCallback.call(this);
    this.id = this.id.length > 0 ? this.id : this.componentId;
    this.setAttribute('role', 'tabpanel');
  }

  // Core's own willUpdate (which turns the internal `visible` property into `hidden` and the `tab-*` events) is not
  // called, see the class comment.
  protected override willUpdate(changed: PropertyValues<this>) {
    this.initialReflectedProperties.forEach((value, prop) => {
      const self = this as unknown as Record<string, unknown>;
      if (changed.has(prop as keyof VelcroTabPanel) && self[prop] == null) {
        self[prop] = value;
      }
    });
  }

  // Shoelace's `@watch('active')`: it runs before the render, including on the first update.
  protected override update(changed: PropertyValues<this>) {
    if (changed.has('active') && changed.get('active') !== this.active) {
      this.handleActiveChange();
    }

    super.update(changed);
  }

  // Upstream quirk: `aria-hidden` is written whenever `active` changes and so replaces one the page set.
  private handleActiveChange() {
    this.setAttribute('aria-hidden', this.active ? 'false' : 'true');
  }

  protected override render() {
    return html`
      <slot
        part="base"
        class=${classMap({
          'tab-panel': true,
          'tab-panel--active': this.active,
        })}
      ></slot>
    `;
  }
}

export default VelcroTabPanel;
