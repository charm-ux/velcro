// Portions of the API documentation wording, the unit thresholds, the rendered structure (a `time` element with a
// `datetime` attribute) and the sync scheduling in this file are adapted from Shoelace v2.20.1
// (src/components/relative-time/relative-time.component.ts), Copyright (c) 2020 A Beautiful Site, LLC, MIT License.
// See THIRD_PARTY_NOTICES.md. No Shoelace source file or runtime is included.
import { html } from 'lit';
import { property } from 'lit/decorators.js';
import { CharmElement } from '@charm-ux/core/dist/base/charm-element/charm-element.js';
import { LocalizeController } from '../../utilities/localize.js';
import styles from './relative-time.styles.js';

interface UnitConfig {
  max: number;
  value: number;
  unit: Intl.RelativeTimeFormatUnit;
}

const availableUnits: UnitConfig[] = [
  { max: 2760000, value: 60000, unit: 'minute' }, // max 46 minutes
  { max: 72000000, value: 3600000, unit: 'hour' }, // max 20 hours
  { max: 518400000, value: 86400000, unit: 'day' }, // max 6 days
  { max: 2419200000, value: 604800000, unit: 'week' }, // max 28 days
  { max: 28512000000, value: 2592000000, unit: 'month' }, // max 11 months
  { max: Infinity, value: 31536000000, unit: 'year' },
];

/**
 * Outputs a localized time phrase relative to the current date and time. API modelled on Shoelace's `sl-relative-time`.
 *
 * @tag sl-relative-time
 * @status prototype
 */
export class VelcroRelativeTime extends CharmElement {
  public static override baseName = 'relative-time';
  public static override styles = [...CharmElement.styles, styles];

  private readonly localize = new LocalizeController(this);
  private updateTimeout?: number;

  /**
   * The date from which to calculate time from. If not set, the current date and time will be used. When passing a
   * string, it's strongly recommended to use the ISO 8601 format to ensure timezones are handled correctly. To convert
   * a date to this format in JavaScript, use `date.toISOString()`.
   */
  @property()
  public date: Date | string = new Date();

  /** The formatting style to use. */
  @property()
  public format: 'long' | 'short' | 'narrow' = 'long';

  /**
   * When `auto`, values such as "yesterday" and "tomorrow" will be shown when possible. When `always`, values such as
   * "1 day ago" and "in 1 day" will be shown.
   */
  @property()
  public numeric: 'always' | 'auto' = 'auto';

  /** Keep the displayed value up to date as time passes. */
  @property({ type: Boolean })
  public sync = false;

  // `lang` is declared reactive, as in Shoelace, so a language change re-renders the text. Like Shoelace it is undefined by default.
  @property()
  public override lang!: string;

  // Documented divergence: Shoelace's base element only restores the initial value of REFLECTED properties, and none of
  // these are reflected there. Here a removed `date`, `format` or `numeric` attribute (the property becomes null) restores
  // the default instead of leaving null (which would make Intl.RelativeTimeFormat throw).
  protected override willUpdate(changed: Map<PropertyKey, unknown>): void {
    super.willUpdate(changed);
    if (changed.has('date') && this.date == null) this.date = new Date();
    if (changed.has('format') && this.format == null) this.format = 'long';
    if (changed.has('numeric') && this.numeric == null) this.numeric = 'auto';
  }

  public override connectedCallback(): void {
    super.connectedCallback();
    // Divergence: Shoelace stops its sync timer on disconnect and never restarts it; here a reconnected element resumes syncing.
    if (this.sync && this.hasUpdated) this.requestUpdate();
  }

  public override disconnectedCallback(): void {
    super.disconnectedCallback();
    clearTimeout(this.updateTimeout);
  }

  protected override render() {
    const now = new Date();
    const then = new Date(this.date);

    clearTimeout(this.updateTimeout);

    // Check for an invalid date
    if (isNaN(then.getMilliseconds())) return '';

    const diff = then.getTime() - now.getTime();
    const { unit, value } = availableUnits.find(singleUnit => Math.abs(diff) < singleUnit.max)!;
    const isoTime = then.toISOString();
    const relativeTime = this.localize.relativeTime(Math.round(diff / value), unit, {
      numeric: this.numeric,
      style: this.format,
    });

    // If sync is enabled, update as time passes
    if (this.sync) {
      let nextInterval: number;

      if (unit === 'minute') {
        nextInterval = getTimeUntilNextUnit('second');
      } else if (unit === 'hour') {
        nextInterval = getTimeUntilNextUnit('minute');
      } else if (unit === 'day') {
        nextInterval = getTimeUntilNextUnit('hour');
      } else {
        // Cap updates at once per day; setTimeout has a limit on the value it can accept.
        nextInterval = getTimeUntilNextUnit('day');
      }

      this.updateTimeout = window.setTimeout(() => this.requestUpdate(), nextInterval);
    }

    return html` <time datetime=${isoTime}>${relativeTime}</time> `;
  }
}

// Calculates the number of milliseconds until the next respective unit changes, so all components update at the same time.
function getTimeUntilNextUnit(unit: 'second' | 'minute' | 'hour' | 'day') {
  const units = { second: 1000, minute: 60000, hour: 3600000, day: 86400000 };
  const value = units[unit];
  return value - (Date.now() % value);
}

export default VelcroRelativeTime;
