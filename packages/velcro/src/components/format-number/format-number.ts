// Portions of the API documentation wording and the formatting options mapping in this file are adapted from Shoelace
// v2.20.1 (src/components/format-number/format-number.component.ts), Copyright (c) 2020 A Beautiful Site, LLC, MIT License.
// See THIRD_PARTY_NOTICES.md. No Shoelace source file or runtime is included.
import { property } from 'lit/decorators.js';
import { CharmElement } from '@charm-ux/core/dist/base/charm-element/charm-element.js';
import { LocalizeController } from '../../internal/localize.js';
import styles from './format-number.styles.js';

/**
 * Formats a number using the specified locale and options. API modelled on Shoelace's `sl-format-number`.
 *
 * @tag sl-format-number
 * @status prototype
 */
export class VelcroFormatNumber extends CharmElement {
  public static override baseName = 'format-number';
  public static override styles = [...CharmElement.styles, styles];

  private readonly localize = new LocalizeController(this);

  /** The number to format. */
  @property({ type: Number })
  public value = 0;

  /** The formatting style to use. */
  @property()
  public type: 'currency' | 'decimal' | 'percent' = 'decimal';

  /** Turns off grouping separators. */
  @property({ attribute: 'no-grouping', type: Boolean })
  public noGrouping = false;

  /** The [ISO 4217](https://en.wikipedia.org/wiki/ISO_4217) currency code to use when formatting. */
  @property()
  public currency = 'USD';

  /** How to display the currency. */
  @property({ attribute: 'currency-display' })
  public currencyDisplay: 'symbol' | 'narrowSymbol' | 'code' | 'name' = 'symbol';

  /** The minimum number of integer digits to use. Possible values are 1-21. */
  @property({ attribute: 'minimum-integer-digits', type: Number })
  public minimumIntegerDigits?: number;

  /** The minimum number of fraction digits to use. Possible values are 0-20. */
  @property({ attribute: 'minimum-fraction-digits', type: Number })
  public minimumFractionDigits?: number;

  /** The maximum number of fraction digits to use. Possible values are 0-20. */
  @property({ attribute: 'maximum-fraction-digits', type: Number })
  public maximumFractionDigits?: number;

  /** The minimum number of significant digits to use. Possible values are 1-21. */
  @property({ attribute: 'minimum-significant-digits', type: Number })
  public minimumSignificantDigits?: number;

  /** The maximum number of significant digits to use. Possible values are 1-21. */
  @property({ attribute: 'maximum-significant-digits', type: Number })
  public maximumSignificantDigits?: number;

  // `lang` is declared reactive, as in Shoelace, so a language change re-renders the number. Like Shoelace it has no initial value (undefined).
  @property()
  public override lang!: string;

  // Documented divergence: Shoelace's base element only restores the initial value of REFLECTED properties, and none of these
  // are reflected there. Here a removed attribute (the property becomes null) restores the default (or unset, for the digit
  // options) instead of leaving null, which Intl.NumberFormat would read as 0 for the digit options.
  protected override willUpdate(changed: Map<PropertyKey, unknown>): void {
    super.willUpdate(changed);
    if (changed.has('value') && this.value == null) this.value = 0;
    if (changed.has('type') && this.type == null) this.type = 'decimal';
    if (changed.has('currency') && this.currency == null) this.currency = 'USD';
    if (changed.has('currencyDisplay') && this.currencyDisplay == null) this.currencyDisplay = 'symbol';
    for (const key of [
      'minimumIntegerDigits',
      'minimumFractionDigits',
      'maximumFractionDigits',
      'minimumSignificantDigits',
      'maximumSignificantDigits',
    ] as const) {
      if (changed.has(key) && this[key] === null) this[key] = undefined;
    }
  }

  protected override render() {
    if (isNaN(this.value)) return '';

    return this.localize.number(this.value, {
      style: this.type,
      currency: this.currency,
      currencyDisplay: this.currencyDisplay,
      useGrouping: !this.noGrouping,
      minimumIntegerDigits: this.minimumIntegerDigits,
      minimumFractionDigits: this.minimumFractionDigits,
      maximumFractionDigits: this.maximumFractionDigits,
      minimumSignificantDigits: this.minimumSignificantDigits,
      maximumSignificantDigits: this.maximumSignificantDigits,
    });
  }
}

export default VelcroFormatNumber;
