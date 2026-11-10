// Adapted from Shoelace v2.20.1 (src/components/qr-code/qr-code.component.ts, the `@watch` timing of src/internal/watch.ts
// and the `dir` and `lang` declarations in src/internal/shoelace-element.ts), Copyright (c) 2020 A Beautiful Site, LLC, MIT
// License. See THIRD_PARTY_NOTICES.md. The API documentation wording, the rendered structure (a `base` canvas with
// `role="img"` and the label or value as its accessible name), the public `value`, `label`, `size`, `fill`, `background`,
// `radius` and `errorCorrection` properties, the public `canvas` query and `generate()` method, and the drawing call
// (qr-creator, at twice the size, with the same options) follow Shoelace. The QR code itself is drawn by the qr-creator
// package (MIT, a runtime dependency, imported as Shoelace imports it). Velcro changes: built on the @charm-ux/core base
// element (core has no QR code). Shoelace's behavior is matched exactly, including its quirks; each one is marked
// "Upstream quirk" below and listed on the docs page.
import { html, type PropertyValues } from 'lit';
import { property, query } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { CharmElement } from '@charm-ux/core/dist/base/charm-element/charm-element.js';
import QrCreator from 'qr-creator';
import styles from './qr-code.styles.js';

// The properties Shoelace's `@watch` decorator on `generate()` observes, in its order.
const WATCHED = ['background', 'errorCorrection', 'fill', 'radius', 'size', 'value'] as const;

// Built on the @charm-ux/core base element: @charm-ux/core has no QR code component to extend. The only core extension
// that remains is the non-bubbling `ready` event on first update.
/**
 * Generates a [QR code](https://www.qrcode.com/) and renders it using the
 * [Canvas API](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API). API modelled on Shoelace's `sl-qr-code`.
 *
 * Velcro extension inherited from the core base element and kept: the non-bubbling `ready` event, emitted on the first
 * update (after the code is drawn).
 *
 * @tag sl-qr-code
 * @status prototype
 *
 * @csspart base - The component's base wrapper.
 */
export class VelcroQrCode extends CharmElement {
  public static override baseName = 'qr-code';

  // Core's base styles are replaced by Shoelace's own (see the styles file).
  public static override styles = [styles];

  private velcroDir?: string;

  // `dir` and `lang` are declared as Shoelace's base element declares them: reactive, not reflected and without an
  // initial value (undefined). Core's `dir` would return the computed direction instead.
  // Types: Shoelace declares `dir: string`. The setter accepts any string, as Shoelace's does. The getter must keep
  // core's declared type, because TypeScript does not let a subclass widen an inherited property's read type; at
  // runtime it returns whatever was set.
  /**
   * The element's text direction, as set by the `dir` attribute or property and returned as set. Not reflected. Any
   * string can be assigned; the declared read type stays core's `'ltr' | 'rtl' | 'auto'`.
   */
  @property()
  public override get dir(): 'ltr' | 'rtl' | 'auto' {
    return this.velcroDir as 'ltr' | 'rtl' | 'auto';
  }
  public override set dir(value: string) {
    this.velcroDir = value;
  }

  /** The element's language, as set by the `lang` attribute or property. Not reflected. */
  @property()
  public override lang!: string;

  // Shoelace's public `@query('canvas')` field: the canvas the code is drawn on.
  @query('canvas')
  public canvas!: HTMLElement;

  /** The QR code's value. */
  @property()
  public value = '';

  /** The label for assistive devices to announce. If unspecified, the value will be used instead. */
  @property()
  public label = '';

  /** The size of the QR code, in pixels. */
  @property({ type: Number })
  public size = 128;

  /** The fill color. This can be any valid CSS color, but not a CSS custom property. */
  @property()
  public fill = 'black';

  /** The background color. This can be any valid CSS color or `transparent`. It cannot be a CSS custom property. */
  @property()
  public background = 'white';

  /** The edge radius of each module. Must be between 0 and 0.5. */
  @property({ type: Number })
  public radius = 0;

  /** The level of error correction to use. [Learn more](https://www.qrcode.com/en/about/error_correction.html) */
  @property({ attribute: 'error-correction' })
  public errorCorrection: 'L' | 'M' | 'Q' | 'H' = 'H';

  // Draws the code once the canvas exists. Core's `ready` event (a Velcro extension) follows, so a listener sees the drawn code.
  protected override firstUpdated() {
    this.generate();
    super.firstUpdated();
  }

  // Shoelace's `@watch` decorator runs `generate()` in `update()`, before the render, once for EACH watched property that
  // changed to a different value. Upstream quirk: several of them changed in the same update draw the code several times.
  protected override update(changed: PropertyValues<this>) {
    for (const key of WATCHED) {
      if (changed.has(key) && changed.get(key) !== this[key]) this.generate();
    }
    super.update(changed);
  }

  /** Draws the QR code on the canvas. Called whenever a property that affects the drawing changes. */
  public generate() {
    if (!this.hasUpdated) {
      return;
    }

    // qr-creator's types describe a CommonJS module under NodeNext resolution; bundlers load its ES module build, whose
    // default export is the class. Shoelace makes the same cast.
    (QrCreator as unknown as typeof QrCreator.default).render(
      {
        text: this.value,
        radius: this.radius,
        ecLevel: this.errorCorrection,
        fill: this.fill,
        background: this.background,
        // We draw the canvas larger and scale its container down to avoid blurring on high-density displays
        size: this.size * 2,
      },
      this.canvas
    );
  }

  protected override render() {
    return html`
      <canvas
        part="base"
        class="qr-code"
        role="img"
        aria-label=${this.label?.length > 0 ? this.label : this.value}
        style=${styleMap({
          width: `${this.size}px`,
          height: `${this.size}px`,
        })}
      ></canvas>
    `;
  }
}

export default VelcroQrCode;
