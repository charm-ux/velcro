// Portions of the API documentation wording in this file and the rendered structure (an svg `base` part with
// role="progressbar" and a track and an indicator circle) are adapted from Shoelace v2.20.1
// (src/components/spinner/spinner.component.ts), Copyright (c) 2020 A Beautiful Site, LLC, MIT License.
// See THIRD_PARTY_NOTICES.md. No Shoelace source file or runtime is included.
import { html } from 'lit';
import { CoreSpinner } from '@charm-ux/core/dist/components/spinner/spinner.js';
import styles from './spinner.styles.js';

/**
 * Spinners are used to show the progress of an indeterminate operation. API modelled on Shoelace's `sl-spinner`.
 *
 * @tag sl-spinner
 * @status prototype
 *
 * @csspart base - The component's base wrapper.
 *
 * @cssproperty [--track-width=2px] - The width of the track.
 * @cssproperty [--track-color=rgb(128 128 128 / 25%)] - The color of the track.
 * @cssproperty [--indicator-color=var(--sl-color-primary-600)] - The color of the spinner's indicator.
 * @cssproperty [--speed=2s] - The time it takes for the spinner to complete one animation cycle.
 */
export class VelcroSpinner extends CoreSpinner {
  public static override styles = [...super.styles, styles];

  // Core renders a label-bearing `status` layout with its own parts. Shoelace's contract is a single svg `base`
  // part that is an indeterminate `progressbar` named "Loading", sized by font-size, so the template is replaced
  // here. Core's `label` and `label-position` properties are still declared by the base class but are not used.
  protected override spinnerTemplate() {
    // The accessible name is English-only; Shoelace localizes it through its own localization controller.
    return html`
      <svg part="base" class="ring" role="progressbar" aria-label="Loading">
        <circle class="track"></circle>
        <circle class="indicator"></circle>
      </svg>
    `;
  }
}

export default VelcroSpinner;
