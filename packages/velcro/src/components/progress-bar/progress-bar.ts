// Portions of the API documentation wording in this file and the rendered structure (a `base` part with
// role="progressbar", an `indicator` part sized by a width style and a default slot with the `label` part) are
// adapted from Shoelace v2.20.1 (src/components/progress-bar/progress-bar.component.ts), Copyright (c) 2020
// A Beautiful Site, LLC, MIT License. See THIRD_PARTY_NOTICES.md. No Shoelace source file or runtime is included.
import { html } from 'lit';
import { property } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { styleMap } from 'lit/directives/style-map.js';
import { CoreProgressBar } from '@charm-ux/core/dist/components/progress-bar/progress-bar.js';
import styles from './progress-bar.styles.js';

/**
 * Progress bars are used to show the status of an ongoing operation. API modelled on Shoelace's `sl-progress-bar`.
 *
 * @tag sl-progress-bar
 * @status prototype
 *
 * @slot - A label to show inside the progress indicator.
 *
 * @csspart base - The component's base wrapper.
 * @csspart indicator - The progress bar's indicator.
 * @csspart label - The progress bar's label.
 *
 * @cssproperty --height - The progress bar's height.
 * @cssproperty --track-color - The color of the track.
 * @cssproperty --indicator-color - The color of the indicator.
 * @cssproperty --label-color - The color of the label.
 */
export class VelcroProgressBar extends CoreProgressBar {
  public static override styles = [...super.styles, styles];

  /** The current progress as a percentage, 0 to 100. */
  @property({ type: Number, reflect: true })
  public override value = 0;

  /** When true, percentage is ignored, the label is hidden, and the progress bar is drawn in an indeterminate state. */
  @property({ type: Boolean, reflect: true })
  public override indeterminate = false;

  /** A custom label for assistive devices. */
  @property()
  public override label = '';

  // Shoelace's base class restores a reflected property's initial value when its attribute is removed; Lit alone would
  // leave `value` null and `label` null. Only the two non-boolean properties need it (`indeterminate` converts to false).
  public override attributeChangedCallback(name: string, previous: string | null, next: string | null) {
    super.attributeChangedCallback(name, previous, next);
    if (next === null && name === 'value') this.value = 0;
    if (next === null && name === 'label') this.label = '';
  }

  // Core writes `--progress-percent` onto the host here. Nothing in the Velcro template reads it and Shoelace never
  // touches the host's style, so it is a no-op.
  protected override syncRange() {}

  // What is reused from core: the CharmElement base (scoping attribute, `dir`, the `ready` event), the `baseName`, the
  // shared base styles (including the `ready` event, which Shoelace does not have) and `render()`, which delegates to this hook. Core's markup (a form-control label, a track with
  // `progress-bar-*` parts, help text and `max`/`meter` support) is replaced because Shoelace's contract is a single
  // `base` progressbar with `indicator` and `label` parts and a fixed 0 to 100 range.
  protected override progressBarTemplate() {
    // The default accessible name is English-only; Shoelace localizes it through its own localization controller.
    return html`
      <div
        part="base"
        class=${classMap({
          'progress-bar': true,
          'progress-bar--indeterminate': this.indeterminate,
          'progress-bar--rtl': this.dir === 'rtl',
        })}
        role="progressbar"
        title=${ifDefined(this.title)}
        aria-label=${this.label.length > 0 ? this.label : 'Progress'}
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuenow=${this.indeterminate ? 0 : this.value}
      >
        <div part="indicator" class="progress-bar__indicator" style=${styleMap({ width: `${this.value}%` })}>
          ${!this.indeterminate ? html` <slot part="label" class="progress-bar__label"></slot> ` : ''}
        </div>
      </div>
    `;
  }
}

export default VelcroProgressBar;
