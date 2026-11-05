// Portions of the API documentation wording in this file and the rendered structure (a `div` with the `base` part and
// `role="progressbar"`, an svg with a track and an indicator circle, and a default slot with the `label` part) are adapted
// from Shoelace v2.20.1 (src/components/progress-ring/progress-ring.component.ts), Copyright (c) 2020 A Beautiful Site, LLC,
// MIT License. See THIRD_PARTY_NOTICES.md. No Shoelace source file or runtime is included.
import { html } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { CharmElement } from '@charm-ux/core/dist/base/charm-element/charm-element.js';
import styles from './progress-ring.styles.js';

/**
 * Progress rings are used to show the progress of a determinate operation in a circular fashion. API modelled on
 * Shoelace's `sl-progress-ring`.
 *
 * @tag sl-progress-ring
 * @status prototype
 *
 * @slot - A label to show inside the ring.
 *
 * @csspart base - The component's base wrapper.
 * @csspart label - The progress ring label.
 *
 * @cssproperty [--size=128px] - The diameter of the progress ring (cannot be a percentage).
 * @cssproperty [--track-width=4px] - The width of the track.
 * @cssproperty [--track-color=var(--sl-color-neutral-200)] - The color of the track.
 * @cssproperty [--indicator-width=var(--track-width)] - The width of the indicator. Defaults to the track width.
 * @cssproperty [--indicator-color=var(--sl-color-primary-600)] - The color of the indicator.
 * @cssproperty [--indicator-transition-duration=0.35s] - The duration of the indicator's transition when the value changes.
 */
export class VelcroProgressRing extends CharmElement {
  public static override baseName = 'progress-ring';

  public static override styles = [...super.styles, styles];

  @query('.progress-ring__indicator')
  private indicator!: SVGCircleElement;

  @state()
  private indicatorOffset?: string;

  /** The current progress as a percentage, 0 to 100. */
  @property({ type: Number, reflect: true })
  public value = 0;

  /** A custom label for assistive devices. */
  @property()
  public label = '';

  protected override willUpdate(changedProps: Map<PropertyKey, unknown>) {
    super.willUpdate?.(changedProps);

    // Shoelace's base restores a reflected property's initial value when its attribute is removed.
    if (changedProps.has('value') && (this.value as unknown) == null) {
      this.value = 0;
    }
  }

  protected override updated(changedProps: Map<PropertyKey, unknown>) {
    super.updated?.(changedProps);

    // Same Safari workaround as Shoelace: Safari does not transition the circle when the custom properties change,
    // so the dash offset is also set explicitly from the computed radius.
    if (changedProps.has('value')) {
      const radius = parseFloat(getComputedStyle(this.indicator).getPropertyValue('r'));
      const circumference = 2 * Math.PI * radius;
      const offset = circumference - (this.value / 100) * circumference;

      this.indicatorOffset = `${offset}px`;
    }
  }

  protected override render() {
    // The default accessible name is English-only; Shoelace localizes it through its own localization controller.
    return html`
      <div
        part="base"
        class="progress-ring"
        role="progressbar"
        aria-label=${this.label.length > 0 ? this.label : 'Progress'}
        aria-describedby="label"
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuenow="${this.value}"
        style="--percentage: ${this.value / 100}"
      >
        <svg class="progress-ring__image">
          <circle class="progress-ring__track"></circle>
          <circle class="progress-ring__indicator" style="stroke-dashoffset: ${this.indicatorOffset}"></circle>
        </svg>

        <slot id="label" part="label" class="progress-ring__label"></slot>
      </div>
    `;
  }
}

export default VelcroProgressRing;
