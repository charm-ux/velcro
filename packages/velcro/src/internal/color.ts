// Written for Velcro; includes no Shoelace source.
//
// The color model for `sl-color-picker`. Shoelace 2.20.1's color picker parses and formats every color with
// `new TinyColor(string)` from `@ctrl/tinycolor` and reads only `isValid`, `toHsl()`, `toHsv()`, `toRgb()`,
// `toHexString()` and `toHex8String()`. This module re-exports that class from the same library, `@ctrl/tinycolor`
// 4.1.0, the version Shoelace 2.20.1 resolves (MIT licensed; see THIRD_PARTY_NOTICES.md), so Velcro parses and formats
// colors exactly as Shoelace does. The color picker imports only from here, so the library stays behind this one file.
import type { HSLA, HSVA, Numberify, RGBA } from '@ctrl/tinycolor';

export { TinyColor } from '@ctrl/tinycolor';

/** RGB channels 0-255 (rounded) and alpha 0-1, as `TinyColor.toRgb()` returns them. */
export type RgbaColor = Numberify<RGBA>;

/** Hue 0-360, saturation and lightness 0-1, alpha 0-1, as `TinyColor.toHsl()` returns them. */
export type HslaColor = Numberify<HSLA>;

/** Hue 0-360, saturation and value 0-1, alpha 0-1, as `TinyColor.toHsv()` returns them. */
export type HsvaColor = Numberify<HSVA>;
