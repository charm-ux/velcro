// Portions of the API documentation wording and the formatting algorithm (decimal prefixes, three significant digits,
// `Intl.NumberFormat` unit style) in this file are adapted from Shoelace v2.20.1
// (src/components/format-bytes/format-bytes.component.ts), Copyright (c) 2020 A Beautiful Site, LLC, MIT License.
// See THIRD_PARTY_NOTICES.md. No Shoelace source file or runtime is included.
import { property } from 'lit/decorators.js';
import { CharmElement } from '@charm-ux/core/dist/base/charm-element/charm-element.js';
import { LocalizeController } from '../../internal/localize.js';
import styles from './format-bytes.styles.js';

/**
 * Formats a number as a human readable bytes value. API modelled on Shoelace's `sl-format-bytes`.
 *
 * @tag sl-format-bytes
 * @status prototype
 */
export class VelcroFormatBytes extends CharmElement {
  public static override baseName = 'format-bytes';
  public static override styles = [...CharmElement.styles, styles];

  private readonly localize = new LocalizeController(this);

  /** The number to format in bytes. */
  @property({ type: Number })
  public value = 0;

  /** The type of unit to display. */
  @property()
  public unit: 'byte' | 'bit' = 'byte';

  /** Determines how to display the result, e.g. "100 bytes", "100 b", or "100b". */
  @property()
  public display: 'long' | 'short' | 'narrow' = 'short';

  // Documented divergence: Shoelace's base element only restores the initial value of REFLECTED properties, and these three
  // are not reflected there. Here a removed attribute (the property becomes null) restores the default instead of leaving null.
  protected override willUpdate(changed: Map<PropertyKey, unknown>): void {
    super.willUpdate(changed);
    if (changed.has('value') && this.value == null) this.value = 0;
    if (changed.has('unit') && this.unit == null) this.unit = 'byte';
    if (changed.has('display') && this.display == null) this.display = 'short';
  }

  // `lang` is declared reactive, as in Shoelace, so a language change re-renders the number. Like Shoelace it has no initial value (undefined).
  @property()
  public override lang!: string;

  protected override render() {
    if (isNaN(this.value)) return '';

    const bitPrefixes = ['', 'kilo', 'mega', 'giga', 'tera']; // petabit isn't a supported unit
    const bytePrefixes = ['', 'kilo', 'mega', 'giga', 'tera', 'peta'];
    const prefix = this.unit === 'bit' ? bitPrefixes : bytePrefixes;
    const index = Math.max(0, Math.min(Math.floor(Math.log10(this.value) / 3), prefix.length - 1));
    const unit = prefix[index] + this.unit;
    const valueToFormat = parseFloat((this.value / Math.pow(1000, index)).toPrecision(3));

    return this.localize.number(valueToFormat, { style: 'unit', unit, unitDisplay: this.display });
  }
}

export default VelcroFormatBytes;
