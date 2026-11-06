// Portions of the API documentation wording and the behavior in this file (a MutationObserver over the element and its
// subtree, configured by `attr`, `attr-old-value`, `char-data`, `char-data-old-value` and `child-list`, started and stopped
// by `disabled`, reporting through `sl-mutation`) are adapted from Shoelace v2.20.1
// (src/components/mutation-observer/mutation-observer.component.ts), Copyright (c) 2020 A Beautiful Site, LLC, MIT
// License. See THIRD_PARTY_NOTICES.md. No Shoelace source file or runtime is included.
import { html, type PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import { CharmElement } from '@charm-ux/core/dist/base/index.js';
import styles from './mutation-observer.styles.js';

/** The properties that configure what the observer watches. `disabled` is handled separately. */
const OBSERVER_OPTIONS = ['attr', 'attrOldValue', 'charData', 'charDataOldValue', 'childList'] as const;

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

  public static override styles = [...CharmElement.styles, styles];

  private mutationObserver?: MutationObserver;

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

  public override connectedCallback() {
    super.connectedCallback();
    // A reconnect gets a fresh observer; the previous one must not keep reporting alongside it.
    this.mutationObserver?.disconnect();
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

    // Documented divergence from Shoelace 2.20.1, which restarts the observer only when `attr` or `childList` changes
    // (its watchers for `attr-old-value`, `char-data` and `char-data-old-value` are registered under the attribute names
    // and never fire) and does so even while `disabled`. Here a change to any of the five options restarts it, and a
    // disabled observer stays stopped. Like Shoelace, the first update is not a change, but it does (re)start an enabled
    // observer, so options assigned right after the element is connected take effect.
    if (this.hasUpdated && OBSERVER_OPTIONS.some(name => changed.has(name) && changed.get(name) !== this[name])) {
      this.handleChange();
    }

    if (changed.has('disabled') && changed.get('disabled') !== this.disabled) {
      this.handleDisabledChange();
    }
  }

  private handleMutation = (mutationList: MutationRecord[]) => {
    this.emit('sl-mutation', {
      detail: { mutationList },
    });
  };

  private startObserver() {
    // Nothing is observed while disconnected; connecting starts it again.
    if (!this.mutationObserver || !this.isConnected) return;

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
    this.mutationObserver?.disconnect();
  }

  private handleDisabledChange() {
    if (this.disabled) {
      this.stopObserver();
    } else {
      this.startObserver();
    }
  }

  private handleChange() {
    this.stopObserver();

    if (!this.disabled) {
      this.startObserver();
    }
  }

  protected override render() {
    return html` <slot></slot> `;
  }
}

export default VelcroMutationObserver;
