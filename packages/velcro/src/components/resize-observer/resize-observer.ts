// Portions of the API documentation wording and the behavior in this file (a ResizeObserver over the elements
// assigned to the default slot, started and stopped by `disabled`, reporting through `sl-resize`) are adapted from
// Shoelace v2.20.1 (src/components/resize-observer/resize-observer.component.ts), Copyright (c) 2020 A Beautiful
// Site, LLC, MIT License. See THIRD_PARTY_NOTICES.md. No Shoelace source file or runtime is included.
import { html, type PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import { CharmElement } from '@charm-ux/core/dist/base/index.js';
import styles from './resize-observer.styles.js';

/**
 * The Resize Observer component offers a thin, declarative interface to the ResizeObserver API.
 * API modelled on Shoelace's `sl-resize-observer`. There is no core counterpart, so it extends the core base element.
 *
 * @tag sl-resize-observer
 * @status prototype
 *
 * @slot - One or more elements to watch for resizing.
 *
 * @event {{ entries: ResizeObserverEntry[] }} sl-resize - Emitted when the element is resized.
 */
export class VelcroResizeObserver extends CharmElement {
  public static override baseName = 'resize-observer';

  public static override styles = [...CharmElement.styles, styles];

  private resizeObserver?: ResizeObserver;
  private observedElements: HTMLElement[] = [];

  /** Disables the observer. */
  @property({ type: Boolean, reflect: true })
  public disabled = false;

  public override connectedCallback() {
    super.connectedCallback();
    this.resizeObserver = new ResizeObserver((entries: ResizeObserverEntry[]) => {
      this.emit('sl-resize', { detail: { entries } });
    });

    if (!this.disabled) {
      this.startObserver();
    }
  }

  public override disconnectedCallback() {
    super.disconnectedCallback();
    this.stopObserver();
  }

  protected override updated(changed: PropertyValues<this>) {
    super.updated(changed);
    // Same as Shoelace's `@watch('disabled', { waitUntilFirstUpdate: true })`: the initial value is not a change.
    if (changed.has('disabled') && changed.get('disabled') !== undefined) {
      if (this.disabled) {
        this.stopObserver();
      } else {
        this.startObserver();
      }
    }
  }

  private handleSlotChange() {
    if (!this.disabled) {
      this.startObserver();
    }
  }

  private startObserver() {
    const slot = this.shadowRoot?.querySelector('slot');

    if (slot && this.resizeObserver) {
      const elements = slot.assignedElements({ flatten: true }) as HTMLElement[];

      // Unwatch previous elements
      this.observedElements.forEach(el => this.resizeObserver!.unobserve(el));
      this.observedElements = [];

      // Watch new elements
      elements.forEach(el => {
        this.resizeObserver!.observe(el);
        this.observedElements.push(el);
      });
    }
  }

  private stopObserver() {
    this.resizeObserver?.disconnect();
  }

  protected override render() {
    return html` <slot @slotchange=${this.handleSlotChange}></slot> `;
  }
}

export default VelcroResizeObserver;
