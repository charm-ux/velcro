// Portions of the API documentation wording and the behavior in this file (a MutationObserver over the element and its
// subtree, configured by `attr`, `attr-old-value`, `char-data`, `char-data-old-value` and `child-list`, started and stopped
// by `disabled`, reporting through `sl-mutation`, and the restore of reflected properties' initial values) are adapted
// from Shoelace v2.20.1 (src/components/mutation-observer/mutation-observer.component.ts and src/internal/
// shoelace-element.ts), Copyright (c) 2020 A Beautiful Site, LLC, MIT License. See THIRD_PARTY_NOTICES.md. No Shoelace
// source file or runtime is included. Shoelace's behavior is matched exactly, including its quirks; each one is marked
// "Upstream quirk" below and listed on the docs page.
import { html, type PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import { CharmElement } from '@charm-ux/core/dist/base/index.js';
import styles from './mutation-observer.styles.js';

/**
 * The Mutation Observer component offers a thin, declarative interface to the MutationObserver API.
 * API modelled on Shoelace's `sl-mutation-observer`. There is no core counterpart, so it extends the core base element.
 *
 * @tag sl-mutation-observer
 * @status prototype
 *
 * @slot - The content to watch for mutations.
 *
 * @event {{ mutationList: MutationRecord[] }} sl-mutation - Emitted when a mutation occurs.
 */
export class VelcroMutationObserver extends CharmElement {
  public static override baseName = 'mutation-observer';

  // Core's base styles are replaced by Shoelace's own (see the styles file). The only core rule that can apply to this
  // template is `:host([hidden]) { display: none !important }`, which Shoelace does not have.
  public static override styles = [styles];

  private mutationObserver!: MutationObserver;

  // Shoelace's base element declares `lang` as a reactive property with no initial value and no reflection, which also
  // makes `lang` an observed attribute. Without this, `lang` would be the native one, which reflects: assigning it
  // would change the attribute (and be reported by `attr="lang"`) and reading it would give '' instead of undefined.
  @property()
  public override lang!: string;

  /**
   * Watches for changes to attributes. To watch only specific attributes, separate them by a space, e.g.
   * `attr="class id title"`. To watch all attributes, use `*`.
   */
  @property({ reflect: true })
  public attr!: string;

  /** Indicates whether or not the attribute's previous value should be recorded when monitoring changes. */
  @property({ attribute: 'attr-old-value', type: Boolean, reflect: true })
  public attrOldValue = false;

  /** Watches for changes to the character data contained within the node. */
  @property({ attribute: 'char-data', type: Boolean, reflect: true })
  public charData = false;

  /** Indicates whether or not the previous value of the node's text should be recorded. */
  @property({ attribute: 'char-data-old-value', type: Boolean, reflect: true })
  public charDataOldValue = false;

  /** Watches for the addition or removal of new child nodes. */
  @property({ attribute: 'child-list', type: Boolean, reflect: true })
  public childList = false;

  /** Disables the observer. */
  @property({ type: Boolean, reflect: true })
  public disabled = false;

  // Upstream behavior: the first time any observed attribute changes (including `dir` and `lang`), the values of all
  // reflected properties that are not null are recorded, and when one of them later becomes null (its attribute was
  // removed) it is set back to the recorded value. Upstream quirk: `attr` has no default, so it is only recorded (and
  // so only restored) if it already held a value at that moment, for example when it was assigned as a property
  // before any attribute changed.
  private hasRecordedInitialProperties = false;

  private readonly initialReflectedProperties = new Map<string, unknown>();

  public override attributeChangedCallback(name: string, previous: string | null, next: string | null) {
    if (!this.hasRecordedInitialProperties) {
      (this.constructor as typeof VelcroMutationObserver).elementProperties.forEach((options, prop) => {
        // Reflection is checked first, as upstream does, so that a non-reflected property's getter is not read here
        // (core's `dir` getter computes the style).
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

  public override connectedCallback() {
    super.connectedCallback();

    // Upstream quirk: a reconnect creates a new observer without disconnecting the previous one. If the previous one was
    // restarted while disconnected (see `handleChange`), both observe, and every mutation is reported twice.
    this.mutationObserver = new MutationObserver(this.handleMutation);

    if (!this.disabled) {
      this.startObserver();
    }
  }

  public override disconnectedCallback() {
    super.disconnectedCallback();
    this.stopObserver();
  }

  protected override willUpdate(changed: PropertyValues<this>) {
    super.willUpdate(changed);
    this.initialReflectedProperties.forEach((value, prop) => {
      const self = this as unknown as Record<string, unknown>;
      if (changed.has(prop as keyof VelcroMutationObserver) && self[prop] == null) {
        self[prop] = value;
      }
    });
  }

  // Shoelace's `@watch` decorators, in their order: they run before the render (and before reflection).
  protected override update(changed: PropertyValues<this>) {
    // Upstream quirk: Shoelace also watches 'attr-old-value', 'char-data' and 'char-data-old-value', but under their
    // attribute names, which never match a property name, so only `attr` and `childList` restart the observer.
    // Changing `attrOldValue`, `charData` or `charDataOldValue` after the first update takes effect only at the next
    // restart (a change to `attr` or `childList`, or `disabled` going false again).
    if (this.hasUpdated) {
      for (const name of ['attr', 'childList'] as const) {
        if (changed.has(name) && changed.get(name) !== this[name]) {
          this.handleChange();
        }
      }
    }

    // Not guarded by hasUpdated: the first update always (re)starts an enabled observer, so options assigned right
    // after the element is connected take effect.
    if (changed.has('disabled') && changed.get('disabled') !== this.disabled) {
      this.handleDisabledChange();
    }

    super.update(changed);
  }

  private handleMutation = (mutationList: MutationRecord[]) => {
    this.emit('sl-mutation', {
      detail: { mutationList },
    });
  };

  private startObserver() {
    const observeAttributes = typeof this.attr === 'string' && this.attr.length > 0;
    const attributeFilter = observeAttributes && this.attr !== '*' ? this.attr.split(' ') : undefined;

    try {
      this.mutationObserver.observe(this, {
        subtree: true,
        childList: this.childList,
        attributes: observeAttributes,
        attributeFilter,
        attributeOldValue: this.attrOldValue,
        characterData: this.charData,
        characterDataOldValue: this.charDataOldValue,
      });
    } catch {
      //
      // A mutation observer was created without one of the required attributes: attr, char-data, or child-list. The
      // browser will normally throw an error, but we'll suppress that so it doesn't appear as attributes are added
      // and removed.
      //
    }
  }

  private stopObserver() {
    this.mutationObserver.disconnect();
  }

  private handleDisabledChange() {
    if (this.disabled) {
      this.stopObserver();
    } else {
      this.startObserver();
    }
  }

  // Upstream quirks: restarting does not check `disabled`, so changing `attr` or `childList` on a disabled observer
  // starts it, and it does not check that the element is connected, so a restart while disconnected observes the
  // detached subtree.
  private handleChange() {
    this.stopObserver();
    this.startObserver();
  }

  protected override render() {
    return html` <slot></slot> `;
  }
}

export default VelcroMutationObserver;
