// Adapted from Shoelace v2.20.1 (src/components/button-group/button-group.component.ts and the reflected-property restore
// in src/internal/shoelace-element.ts), Copyright (c) 2020 A Beautiful Site, LLC, MIT License. See THIRD_PARTY_NOTICES.md.
// The API documentation wording, the rendered structure (a `base` div with the group `role` and `aria-label` around one
// default slot), the data attributes written to the slotted buttons, the focus and hover tracking and the restore of
// reflected properties' initial values follow Shoelace. Velcro changes: built on the @charm-ux/core button group through
// Velcro's local scope resolver (core's extras are kept where they do not change Shoelace's behavior, see the class
// comment). Shoelace's behavior is matched exactly, including its quirks; each one is marked "Upstream quirk" below and
// listed on the docs page.
import { html, type PropertyValues } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { CoreButtonGroup } from '@charm-ux/core/dist/components/button-group/button-group.js';
import { useVelcroScope } from '../../internal/scope.js';
import styles from './button-group.styles.js';

/**
 * Button groups can be used to group related buttons into sections. API modelled on Shoelace's `sl-button-group`.
 *
 * Velcro extensions inherited from the core button group and kept working: `select` (`single` or `multiple` marks the
 * slotted `<sl-button>` elements as toggle buttons; `single` also un-presses the others when one is toggled) and
 * `toolbar` (the base element gets `role="toolbar"`, the buttons get a roving tab index, and the arrow keys move focus
 * between the slotted elements). They only act while set, are released when removed (the key handler, the roving tab
 * index and the `toggle` attribute the group wrote are taken back) and do not change Shoelace's behavior. The core
 * `vertical` and `split` attributes are accepted and reflected but have no effect: they only drive core's own button
 * styles, which this component does not use. Core's `button-group-button-position` attribute is not written to the
 * buttons, and core's `--button-group-*` custom properties and `button-group-base` part do not exist.
 *
 * @tag sl-button-group
 * @status prototype
 *
 * @slot - One or more `<sl-button>` elements to display in the button group.
 *
 * @inheritedEventDropped change - Never emitted by the group: core only listens for the `change` events of its buttons.
 *
 * @csspart base - The component's base wrapper.
 */
export class VelcroButtonGroup extends CoreButtonGroup {
  // Core's base and button group styles are replaced by Shoelace's own (see the styles file). Core adds a
  // `:host([hidden]) { display: none !important }` rule, which Shoelace does not have, and its group styles style
  // `::slotted([button])` and the `button-group-base` wrapper, neither of which this template uses.
  public static override styles = [styles];

  /** The default slot element in the shadow root. Not documented by Shoelace. */
  @query('slot')
  public defaultSlot!: HTMLSlotElement;

  /**
   * When true, the base element has `role="presentation"` instead of the group role. Internal state that `sl-radio-group`
   * sets; it has no attribute. Not documented by Shoelace.
   */
  @state()
  public disableRole = false;

  private hasRecordedInitialProperties = false;

  private readonly initialReflectedProperties = new Map<string, unknown>();

  private velcroDir?: string;

  // What the extensions wrote, so that removing an extension can take it back and leave a plain Shoelace group: the
  // `tabindex` a button or slotted element had before the roving tab index (null: none), the buttons that got `toggle`
  // from the group, and the nested groups that got `toolbar` from it. Weak: nothing here keeps an element alive.
  private readonly savedTabindex = new WeakMap<Element, string | null>();

  private readonly toggleAdded = new WeakSet<Element>();

  private readonly toolbarAdded = new WeakSet<Element>();

  // Core installs the single-select `change` listener only when it connects with `select` set, never when `select`
  // changes later. `attached`: core installed it and it is on; `parked`: removing `select` took it off, and setting
  // `select` again puts it back; `none`: there is none, and a group that connected without `select` stays that way
  // (core's late-first-enable behavior).
  private selectListener: 'none' | 'attached' | 'parked' = 'none';

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

  /**
   * A label to use for the button group. This won't be displayed on the screen, but it will be announced by assistive
   * devices when interacting with the control and is strongly recommended.
   */
  @property()
  public override label = '';

  /**
   * Velcro extension (core), inert: accepted and reflected for compatibility with the core button group, but without
   * effect. Core uses it to style its own buttons, which this group does not do; Shoelace has no such attribute, and the
   * group never stacks its buttons vertically.
   */
  @property({ type: Boolean, reflect: true })
  public override vertical?: boolean;

  /**
   * Velcro extension (core), inert: accepted and reflected for compatibility with the core button group, but without
   * effect. Core uses it to remove the gap and border radius between its own buttons, which this group does not do;
   * Shoelace has no such attribute.
   */
  @property({ type: Boolean, reflect: true })
  public override split?: boolean;

  /**
   * Velcro extension (core): `single` or `multiple` makes the slotted `<sl-button>` elements toggle buttons; with `single`
   * pressing one un-presses the others. Not part of Shoelace's button group. Setting it after the buttons are slotted
   * applies when the slot next changes, as in core. Removing it takes the `toggle` attribute back from the buttons the
   * group gave it to and the single-select listener off; their `pressed` state stays. Setting it again puts the listener
   * back, if the group had connected with `select` set.
   */
  @property({ reflect: true })
  public override select?: 'single' | 'multiple' | null;

  /**
   * Velcro extension (core): gives the base element `role="toolbar"`, the buttons a roving tab index and the arrow keys
   * focus movement between the slotted elements, and applies `toolbar` to nested button groups. Not part of Shoelace's
   * button group. Removing it takes the key handler, the roving tab index and the `toolbar` attribute it gave nested
   * groups back.
   */
  @property({ type: Boolean, reflect: true })
  public override toolbar?: boolean;

  // Upstream behavior: the first time any observed attribute changes (including `dir` and `lang`), the values of all
  // reflected properties that are not null are recorded, and when one of them later becomes null (its attribute was
  // removed) it is set back to the recorded value. Shoelace's group declares no reflected property, so here this only
  // concerns the inherited `vertical`, `split`, `select` and `toolbar` extensions.
  public override attributeChangedCallback(name: string, previous: string | null, next: string | null) {
    if (!this.hasRecordedInitialProperties) {
      (this.constructor as typeof VelcroButtonGroup).elementProperties.forEach((options, prop) => {
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

  // Core removes the toolbar key handler on disconnect and adds it back only when the `toolbar` attribute changes, so a
  // reconnected toolbar group would lose its arrow keys. Adding the same listener again is a no-op.
  public override connectedCallback() {
    super.connectedCallback();
    if (this.toolbar) {
      this.addEventListener('keydown', this.handleKeyDown);
    }
    this.selectListener = this.select ? 'attached' : 'none';
  }

  public override disconnectedCallback() {
    super.disconnectedCallback();
    // Core takes the listener off on disconnect, so there is nothing left to put back.
    this.selectListener = 'none';
  }

  protected override willUpdate(changed: PropertyValues<this>) {
    this.initialReflectedProperties.forEach((value, prop) => {
      const self = this as unknown as Record<string, unknown>;
      if (changed.has(prop as keyof VelcroButtonGroup) && self[prop] == null) {
        self[prop] = value;
      }
    });
  }

  // Removing an extension: core adds the toolbar key handler and writes `toggle` and the roving tab index, and never
  // takes them back, so a group that lost `toolbar` or `select` would keep acting on them. Only the final values count,
  // read after the reflected-property restore in `willUpdate` has had its say: Lit reports the value from before the
  // first change in a batch, so an attribute set and removed in one turn shows no earlier value, yet core has added its
  // key handler on the set. Releasing is safe on a group that never had the extension (it only undoes what the group
  // recorded writing), and setting `select` again puts back the listener that removing it took off.
  protected override updated(changed: PropertyValues<this>) {
    super.updated(changed);
    if (changed.has('toolbar') && !this.toolbar) {
      this.releaseToolbar();
    }
    if (changed.has('select')) {
      if (this.select) {
        this.restoreSelect();
      } else {
        this.releaseSelect();
      }
    }
  }

  private releaseToolbar() {
    this.removeEventListener('keydown', this.handleKeyDown);
    new Set<Element>([...this.buttons, ...this.slottedElements]).forEach(el => {
      if (this.savedTabindex.has(el)) {
        const saved = this.savedTabindex.get(el) ?? null;
        if (saved === null) {
          el.removeAttribute('tabindex');
        } else {
          el.setAttribute('tabindex', saved);
        }
        this.savedTabindex.delete(el);
      }
    });
    this.slottedElements.forEach(el => {
      [el, ...el.querySelectorAll('*')].forEach(candidate => {
        if (candidate instanceof CoreButtonGroup && this.toolbarAdded.has(candidate)) {
          this.toolbarAdded.delete(candidate);
          candidate.removeAttribute('toolbar');
        }
      });
    });
    this.focusedIndex = 0;
    this.prevSelectedIndex = 0;
  }

  private restoreSelect() {
    if (this.selectListener === 'parked') {
      this.addEventListener('change', this.handleToggleChange);
      this.selectListener = 'attached';
    }
  }

  private releaseSelect() {
    if (this.selectListener === 'attached') {
      this.removeEventListener('change', this.handleToggleChange);
      this.selectListener = 'parked';
    }
    this.buttons.forEach(button => {
      if (this.toggleAdded.has(button)) {
        this.toggleAdded.delete(button);
        button.removeAttribute('toggle');
      }
    });
  }

  private saveTabindex(el: Element) {
    if (!this.savedTabindex.has(el)) {
      this.savedTabindex.set(el, el.getAttribute('tabindex'));
    }
  }

  private handleFocus(event: Event) {
    const button = findButton(event.target as HTMLElement);
    button?.toggleAttribute('data-sl-button-group__button--focus', true);
  }

  private handleBlur(event: Event) {
    const button = findButton(event.target as HTMLElement);
    button?.toggleAttribute('data-sl-button-group__button--focus', false);
  }

  private handleMouseOver(event: Event) {
    const button = findButton(event.target as HTMLElement);
    button?.toggleAttribute('data-sl-button-group__button--hover', true);
  }

  private handleMouseOut(event: Event) {
    const button = findButton(event.target as HTMLElement);
    button?.toggleAttribute('data-sl-button-group__button--hover', false);
  }

  // Upstream quirks: only the first button inside a slotted element gets the attributes (a wrapper with several buttons
  // styles one of them), and a button that leaves the group keeps whatever attributes it was given.
  private handleSlotChange() {
    const slottedElements = [...this.defaultSlot.assignedElements({ flatten: true })] as HTMLElement[];

    slottedElements.forEach(el => {
      const index = slottedElements.indexOf(el);
      const button = findButton(el);

      if (button) {
        button.toggleAttribute('data-sl-button-group__button', true);
        button.toggleAttribute('data-sl-button-group__button--first', index === 0);
        button.toggleAttribute('data-sl-button-group__button--inner', index > 0 && index < slottedElements.length - 1);
        button.toggleAttribute('data-sl-button-group__button--last', index === slottedElements.length - 1);
        button.toggleAttribute('data-sl-button-group__button--radio', button.tagName.toLowerCase() === 'sl-radio-button');
      }
    });

    // Core's own slot-change work, limited to what its extensions need (see `setAttributes`).
    this.initializeSlottedElements();
  }

  // Core also writes `button-group-button-position`, `vertical` and `split` to the buttons, which only core's own button
  // styles read, and Shoelace writes none of them: only the extensions' attributes are kept (`toggle` for `select`, the
  // roving tab index and the propagated attribute for `toolbar`).
  protected override setAttributes() {
    this.buttons.forEach((button, index) => {
      if (this.select) {
        if (!button.hasAttribute('toggle')) {
          this.toggleAdded.add(button);
        }
        button.setAttribute('toggle', '');
      }
      if (this.toolbar) {
        this.saveTabindex(button);
        button.tabIndex = index === 0 ? 0 : -1;
      }
    });
    if (this.toolbar) {
      // Propagate toolbar to child button groups, including nested ones (as core does).
      this.slottedElements.forEach(el => {
        [el, ...el.querySelectorAll('*')].forEach(candidate => {
          if (candidate instanceof CoreButtonGroup) {
            if (!candidate.hasAttribute('toolbar')) {
              this.toolbarAdded.add(candidate);
            }
            candidate.setAttribute('toolbar', '');
          }
        });
      });
    }
  }

  // The arrow keys move the roving tab index to slotted elements, which core writes without remembering what was there.
  protected override setFocus(prevIndex: number, newIndex: number) {
    [this.slottedElements[prevIndex], this.slottedElements[newIndex]].forEach(el => el && this.saveTabindex(el));
    super.setFocus(prevIndex, newIndex);
  }

  // Core gives tooltips in a group a larger distance. Shoelace does not, and the tooltip is whatever `sl-tooltip` is.
  protected override setTooltipPosition() {
    // Intentionally empty.
  }

  protected override render() {
    // eslint-disable-next-line lit-a11y/mouse-events-have-key-events
    return html`
      <div
        part="base"
        class="button-group"
        role="${this.disableRole ? 'presentation' : this.toolbar ? 'toolbar' : 'group'}"
        aria-label=${this.label}
        @focusout=${this.handleBlur}
        @focusin=${this.handleFocus}
        @mouseover=${this.handleMouseOver}
        @mouseout=${this.handleMouseOut}
      >
        <slot @slotchange=${this.handleSlotChange}></slot>
      </div>
    `;
  }
}

function findButton(el: HTMLElement) {
  const selector = 'sl-button, sl-radio-button';

  // The button could be the target element or a child of it (e.g. a dropdown or tooltip anchor)
  return el.closest(selector) ?? el.querySelector(selector);
}

useVelcroScope(VelcroButtonGroup);

export default VelcroButtonGroup;
