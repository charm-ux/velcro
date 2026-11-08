// Adapted from Shoelace v2.20.1 (src/components/tab/tab.component.ts and the reflected-property restore and dependency
// definition in src/internal/shoelace-element.ts), Copyright (c) 2020 A Beautiful Site, LLC, MIT License. See
// THIRD_PARTY_NOTICES.md. The API documentation wording, the rendered structure (a `base` <div> with the `tab` /
// `tab--*` class names around the default slot and, when closable, an `<sl-icon-button>` close button), the generated
// `sl-tab-<n>` id, the `role`, `aria-selected`, `aria-disabled` and `tabindex` handling, the `sl-close` event and the
// restore of reflected properties' initial values follow Shoelace. Velcro changes: built on the @charm-ux/core tab (see
// the class comment for what is kept and what is switched off), and the dependency on <sl-icon-button> is defined when a
// tab is constructed through Velcro's registration helper rather than Shoelace's `static dependencies`. Shoelace's
// behavior is matched exactly, including its quirks; each one is marked "Upstream quirk" below and listed on the docs page.
import { html, type PropertyValues } from 'lit';
import { property, query } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { CoreTab } from '@charm-ux/core/dist/components/tab/tab.js';
import { defineVelcroComponent, type VelcroComponentConstructor } from '../../utilities/registration.js';
import { LocalizeController } from '../../utilities/localize.js';
import { VelcroIconButton } from '../icon-button/class.js';
import styles from './tab.styles.js';

// Upstream quirk: the counter is shared by every tab and advances when a tab is constructed, not when it is rendered, so
// a tab that is created and never connected still uses a number.
let id = 0;

/**
 * Tabs are used inside tab groups to represent and activate tab panels. API modelled on Shoelace's `sl-tab`. A closable
 * tab renders an `<sl-icon-button>`, as in Shoelace; like Shoelace's, constructing a tab defines its dependency
 * `<sl-icon-button>` (Velcro's) when no element owns that tag yet, so the class-only entry needs no extra step.
 *
 * Velcro extensions inherited from the core tab and kept working: the core `ready` event only. The rest of core's tab
 * belongs to core's own tabs and conflicts with Shoelace's model (`active`, `aria-selected` that follows `active` even
 * when the tab is disabled), so it is switched off: core's `selected` property has no attribute and no effect, its
 * internal `tabPanel` property has no effect, its `start` and `end` slots, `tab-base` part and `--tab-*` custom
 * properties do not exist.
 *
 * @tag sl-tab
 * @status prototype
 *
 * @slot - The tab's label.
 *
 * @event sl-close - Emitted when the tab is closable and the close button is activated.
 *
 * @csspart base - The component's base wrapper.
 * @csspart close-button - The close button, an `<sl-icon-button>`.
 * @csspart close-button__base - The close button's exported `base` part.
 */
export class VelcroTab extends CoreTab {
  // Core's base and tab styles are replaced by Shoelace's own (see the styles file).
  public static override styles = [styles];

  // Shoelace's `static dependencies` for the tab: the elements its template renders. Shoelace keys them by tag; here the
  // tag is derived from each class's `baseName` (`sl-icon-button` for `VelcroIconButton`), the same tag
  // `defineVelcroComponent` defines and the template renders. As in Shoelace's base element, each one that is not defined
  // yet is defined when a tab is constructed, and a tag that another constructor already owns is left alone (with
  // Shoelace's version warning when the versions differ). If the platform refuses the class itself (for example because it is already registered
  // under another tag), an anonymous subclass is defined instead, as Shoelace does. The icon button in turn defines
  // `<sl-icon>` when it is constructed. Core's own array-typed `dependencies` (registration in core's scope) stays empty.
  private static readonly shoelaceDependencies: readonly VelcroComponentConstructor[] = [VelcroIconButton];

  public constructor() {
    super();
    for (const component of VelcroTab.shoelaceDependencies) defineVelcroComponent(component);
  }

  private readonly localize = new LocalizeController(this);

  private readonly attrId = ++id;

  private readonly componentId = `sl-tab-${this.attrId}`;

  // Shoelace's base element restores a reflected property's initial value when its attribute is removed (see
  // attributeChangedCallback). `panel`, `active`, `closable`, `disabled` and `tabIndex` are the reflected properties here.
  private readonly initialReflectedProperties = new Map<string, unknown>();

  private hasRecordedInitialProperties = false;

  private velcroDir?: string;

  // Shoelace's public `@query('.tab')` field: the tab's base wrapper.
  @query('.tab')
  public tab!: HTMLElement;

  // Core declares `selected` as a reflected attribute. Shoelace has no such member: it uses `active`. A `selected`
  // attribute would change which attributes are observed, so it is redeclared with no attribute and no reflection; the
  // value does nothing, because core's `willUpdate` that reads it is not run.
  /**
   * Velcro extension inherited from the core tab, switched off: it has no attribute and no effect. Use `active`.
   */
  @property({ attribute: false })
  public override selected?: boolean;

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

  /** The name of the tab panel this tab is associated with. The panel must be located in the same tab group. */
  @property({ reflect: true })
  public panel = '';

  /** Draws the tab in an active state. */
  @property({ type: Boolean, reflect: true })
  public active = false;

  /** Makes the tab closable and shows a close button. */
  @property({ type: Boolean, reflect: true })
  public closable = false;

  /** Disables the tab and prevents selection. */
  @property({ type: Boolean, reflect: true })
  public override disabled = false;

  /**
   * @internal
   * Need to wrap in a `@property()` otherwise CustomElement throws a "The result must not have attributes" runtime error.
   */
  @property({ type: Number, reflect: true })
  public override tabIndex = 0;

  // Upstream behavior: the first time any observed attribute changes (including `dir` and `lang`), the values of all
  // reflected properties that are not null are recorded, and when one of them later becomes null (its attribute was
  // removed) it is set back to the recorded value.
  public override attributeChangedCallback(name: string, previous: string | null, next: string | null) {
    if (!this.hasRecordedInitialProperties) {
      (this.constructor as typeof VelcroTab).elementProperties.forEach((options, prop) => {
        // Reflection is checked first, so that a non-reflected property's getter is not read here.
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

  // Upstream quirk: `role` is always set to `tab` on connect, replacing any role the page gave the element. Core's tab's
  // `connectedCallback` does exactly what Shoelace's does (the base element's callback, then `role="tab"`), so it is
  // inherited unchanged.

  // Core's own willUpdate (which turns `selected` and `disabled` into `aria-selected`, clears `selected` when disabled
  // and drives its tab panel) is not called, see the class comment.
  protected override willUpdate(changed: PropertyValues<this>) {
    this.initialReflectedProperties.forEach((value, prop) => {
      const self = this as unknown as Record<string, unknown>;
      if (changed.has(prop as keyof VelcroTab) && self[prop] == null) {
        self[prop] = value;
      }
    });
  }

  // Shoelace's `@watch('active')` and `@watch('disabled')`: they run before the render, including on the first update.
  // Shoelace applies the decorators in declaration order and each wraps `update`, so the later one (`disabled`) runs
  // first.
  protected override update(changed: PropertyValues<this>) {
    if (changed.has('disabled') && changed.get('disabled') !== this.disabled) {
      this.handleDisabledChange();
    }
    if (changed.has('active') && changed.get('active') !== this.active) {
      this.handleActiveChange();
    }

    super.update(changed);
  }

  private handleCloseClick(event: Event) {
    event.stopPropagation();
    this.emit('sl-close');
  }

  // Upstream quirk: `aria-selected` is written whenever `active` changes and so replaces one the page set.
  public handleActiveChange() {
    this.setAttribute('aria-selected', this.active ? 'true' : 'false');
  }

  // Upstream quirk: a disabled tab that is active keeps `tabindex="0"`, and enabling a tab always sets it to 0, whatever
  // the tab group had set.
  public handleDisabledChange() {
    this.setAttribute('aria-disabled', this.disabled ? 'true' : 'false');

    if (this.disabled && !this.active) {
      this.tabIndex = -1;
    } else {
      this.tabIndex = 0;
    }
  }

  protected override render() {
    // Upstream quirk: the id is generated during render (if the user didn't provide one, so tabs and tab panels can be
    // linked with ARIA attributes), and an id removed later is regenerated on the next render.
    this.id = this.id.length > 0 ? this.id : this.componentId;

    return html`
      <div
        part="base"
        class=${classMap({
          tab: true,
          'tab--active': this.active,
          'tab--closable': this.closable,
          'tab--disabled': this.disabled,
        })}
      >
        <slot></slot>
        ${this.closable
          ? html`
              <sl-icon-button
                part="close-button"
                exportparts="base:close-button__base"
                name="x-lg"
                library="system"
                label=${this.localize.term('close')}
                class="tab__close-button"
                @click=${this.handleCloseClick}
                tabindex="-1"
              ></sl-icon-button>
            `
          : ''}
      </div>
    `;
  }
}

export default VelcroTab;
