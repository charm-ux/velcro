// Portions of the API documentation wording in this file and the rendered structure (an svg `base` part with
// role="progressbar" and the `spinner`, `spinner__track` and `spinner__indicator` class names) are adapted from Shoelace v2.20.1
// (src/components/spinner/spinner.component.ts), Copyright (c) 2020 A Beautiful Site, LLC, MIT License.
// See THIRD_PARTY_NOTICES.md. No Shoelace source file or runtime is included.
import { html } from 'lit';
import { property } from 'lit/decorators.js';
import { CoreSpinner } from '@charm-ux/core/dist/components/spinner/spinner.js';
import { LocalizeController } from '../../utilities/localize.js';
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
  // Core's own spinner styles are dropped on purpose: they style a `.spinner` flex wrapper (display, gap, direction, and
  // `:host([label-position])` rules) that would leak onto Shoelace's `svg.spinner`. Only the styles shared by every Charm
  // element (box-sizing, `[hidden]`) are kept.
  public static override styles = [...(Object.getPrototypeOf(CoreSpinner) as typeof CoreSpinner).styles, styles];

  private readonly localize = new LocalizeController(this);

  // `lang` is declared reactive, as in Shoelace, so a language change re-renders the accessible name. Like Shoelace it has no initial value (undefined).
  @property()
  public override lang!: string;

  // Core renders a label-bearing `status` layout with its own parts. Shoelace's contract is a single svg `base`
  // part that is an indeterminate `progressbar` named by the localized "loading" term, sized by font-size, so the template is replaced
  // here, with Shoelace's class names. Core's `label` and `label-position` properties are still declared by the base
  // class but are not used.
  protected override spinnerTemplate() {
    return html`
      <svg part="base" class="spinner" role="progressbar" aria-label=${this.localize.term('loading')}>
        <circle class="spinner__track"></circle>
        <circle class="spinner__indicator"></circle>
      </svg>
    `;
  }
}

export default VelcroSpinner;
