// Portions of the API documentation wording and the rendering algorithm (an `Intl.DateTimeFormat` result inside a `<time>`
// element with an ISO `datetime`, `hour-format` mapped to `hour12`) in this file are adapted from Shoelace v2.20.1
// (src/components/format-date/format-date.component.ts), Copyright (c) 2020 A Beautiful Site, LLC, MIT License.
// See THIRD_PARTY_NOTICES.md. No Shoelace source file or runtime is included.
import { html } from 'lit';
import { property } from 'lit/decorators.js';
import { CharmElement } from '@charm-ux/core/dist/base/charm-element/charm-element.js';
import { LocalizeController } from '../../internal/localize.js';
import styles from './format-date.styles.js';

/**
 * Formats a date/time using the specified locale and options. API modelled on Shoelace's `sl-format-date`.
 *
 * @tag sl-format-date
 * @status prototype
 *
 * @event ready - Inherited from the core base: emitted (non-bubbling, non-composed) after the first update. Shoelace has no such event.
 */
export class VelcroFormatDate extends CharmElement {
  public static override baseName = 'format-date';
  public static override styles = [...CharmElement.styles, styles];

  private readonly localize = new LocalizeController(this);

  /**
   * The date/time to format. If not set, the current date and time will be used. When passing a string, it's strongly
   * recommended to use the ISO 8601 format to ensure timezones are handled correctly.
   */
  @property()
  public date: Date | string = new Date();

  /** The format for displaying the weekday. */
  @property()
  public weekday?: 'narrow' | 'short' | 'long';

  /** The format for displaying the era. */
  @property()
  public era?: 'narrow' | 'short' | 'long';

  /** The format for displaying the year. */
  @property()
  public year?: 'numeric' | '2-digit';

  /** The format for displaying the month. */
  @property()
  public month?: 'numeric' | '2-digit' | 'narrow' | 'short' | 'long';

  /** The format for displaying the day. */
  @property()
  public day?: 'numeric' | '2-digit';

  /** The format for displaying the hour. */
  @property()
  public hour?: 'numeric' | '2-digit';

  /** The format for displaying the minute. */
  @property()
  public minute?: 'numeric' | '2-digit';

  /** The format for displaying the second. */
  @property()
  public second?: 'numeric' | '2-digit';

  /** The format for displaying the time. */
  @property({ attribute: 'time-zone-name' })
  public timeZoneName?: 'short' | 'long';

  /** The time zone to express the time in. */
  @property({ attribute: 'time-zone' })
  public timeZone?: string;

  /** The format for displaying the hour. */
  @property({ attribute: 'hour-format' })
  public hourFormat: 'auto' | '12' | '24' = 'auto';

  // `lang` is declared reactive, as in Shoelace, so a language change re-renders the date.
  @property()
  public override lang = '';

  // Documented divergence: Shoelace's base element only restores the initial value of REFLECTED properties, and none of these
  // are reflected there. Here a removed `hour-format` attribute restores 'auto' (upstream it becomes null, which renders
  // 24-hour time), and a removed `date` attribute restores the current date/time (upstream: the epoch). Removed format
  // attributes (null) are treated as unset instead of reaching Intl, where null throws a RangeError.
  protected override willUpdate(changed: Map<PropertyKey, unknown>): void {
    super.willUpdate(changed);
    if (changed.has('hourFormat') && this.hourFormat == null) this.hourFormat = 'auto';
    if (changed.has('date') && this.date == null) this.date = new Date();
  }

  protected override render() {
    const date = new Date(this.date);
    const hour12 = this.hourFormat === 'auto' ? undefined : this.hourFormat === '12';

    // Check for an invalid date
    if (isNaN(date.getMilliseconds())) {
      return undefined;
    }

    return html`
      <time datetime=${date.toISOString()}>
        ${this.localize.date(date, {
          weekday: this.weekday ?? undefined,
          era: this.era ?? undefined,
          year: this.year ?? undefined,
          month: this.month ?? undefined,
          day: this.day ?? undefined,
          hour: this.hour ?? undefined,
          minute: this.minute ?? undefined,
          second: this.second ?? undefined,
          timeZoneName: this.timeZoneName ?? undefined,
          timeZone: this.timeZone ?? undefined,
          hour12,
        })}
      </time>
    `;
  }
}

export default VelcroFormatDate;
