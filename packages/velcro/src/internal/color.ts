// Written for Velcro; includes no Shoelace source.
//
// The color model adapter for `sl-color-picker`. Shoelace 2.20.1's color picker parses and formats every color with
// `new TinyColor(string)` from `@ctrl/tinycolor` and reads only `isValid`, `toHsl()`, `toHsv()`, `toRgb()`,
// `toHexString()` and `toHex8String()`. This module exposes exactly that surface and nothing else, so the color picker
// imports only from here and the source of the implementation can change in this one file.
//
// INTERIM implementation, pending a decision on the color library: an original implementation of the documented
// TinyColor semantics the color picker relies on (string input only): the permissive `rgb[a]` / `hsl[a]` / `hsv[a]` and
// 3/4/6/8-digit hex syntaxes, `transparent`, CSS color names, 0-1 percentages and alpha bounding, channel values kept
// unrounded until output. CSS color names are resolved by the browser's canvas color parser for now.

/** RGB channels 0-255 (unrounded in `toRgb()` only where TinyColor leaves them unrounded) and alpha 0-1. */
export interface RgbaColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

/** Hue 0-360, saturation and lightness 0-1, alpha 0-1. */
export interface HslaColor {
  h: number;
  s: number;
  l: number;
  a: number;
}

/** Hue 0-360, saturation and value 0-1, alpha 0-1. */
export interface HsvaColor {
  h: number;
  s: number;
  v: number;
  a: number;
}

type Unit = string | number;

interface ParsedInput {
  r?: Unit;
  g?: Unit;
  b?: Unit;
  h?: Unit;
  s?: Unit;
  l?: Unit;
  v?: Unit;
  a?: Unit;
}

const INTEGER = '[-\\+]?\\d+%?';
const DECIMAL = '[-\\+]?\\d*\\.\\d+%?';
const UNIT = `(?:${DECIMAL})|(?:${INTEGER})`;
const THREE = `[\\s|\\(]+(${UNIT})[,|\\s]+(${UNIT})[,|\\s]+(${UNIT})\\s*\\)?`;
const FOUR = `[\\s|\\(]+(${UNIT})[,|\\s]+(${UNIT})[,|\\s]+(${UNIT})[,|\\s]+(${UNIT})\\s*\\)?`;
const unitPattern = new RegExp(UNIT);
const functional: [string, RegExp, string[]][] = [
  ['rgb', new RegExp(`rgb${THREE}`), ['r', 'g', 'b']],
  ['rgba', new RegExp(`rgba${FOUR}`), ['r', 'g', 'b', 'a']],
  ['hsl', new RegExp(`hsl${THREE}`), ['h', 's', 'l']],
  ['hsla', new RegExp(`hsla${FOUR}`), ['h', 's', 'l', 'a']],
  ['hsv', new RegExp(`hsv${THREE}`), ['h', 's', 'v']],
  ['hsva', new RegExp(`hsva${FOUR}`), ['h', 's', 'v', 'a']],
];
const hex8 = /^#?([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/;
const hex6 = /^#?([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/;
const hex4 = /^#?([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])$/;
const hex3 = /^#?([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])$/;

function isUnit(value: Unit | undefined) {
  return value !== undefined && unitPattern.test(String(value));
}

// Resolves a CSS color keyword to `#rrggbb`, or null when the browser does not know it.
function namedColor(name: string): string | null {
  if (!/^[a-z]+$/.test(name) || typeof document === 'undefined') return null;
  const context = document.createElement('canvas').getContext('2d');
  if (!context) return null;
  context.fillStyle = '#000001';
  context.fillStyle = name;
  const first = String(context.fillStyle);
  context.fillStyle = '#000002';
  context.fillStyle = name;
  const second = String(context.fillStyle);
  return first === second && /^#[0-9a-f]{6}$/.test(first) ? first : null;
}

function parseString(input: string): ParsedInput | null {
  let color = input.trim().toLowerCase();
  if (color.length === 0) return null;
  if (color === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
  const named = namedColor(color);
  if (named) color = named;

  for (const [, pattern, keys] of functional) {
    const match = pattern.exec(color);
    if (match) {
      const result: Record<string, string> = {};
      keys.forEach((key, index) => (result[key] = match[index + 1]));
      return result as ParsedInput;
    }
  }

  const byte = (hex: string) => parseInt(hex, 16);
  let match = hex8.exec(color);
  if (match) return { r: byte(match[1]), g: byte(match[2]), b: byte(match[3]), a: byte(match[4]) / 255 };
  match = hex6.exec(color);
  if (match) return { r: byte(match[1]), g: byte(match[2]), b: byte(match[3]) };
  match = hex4.exec(color);
  if (match) {
    return {
      r: byte(match[1] + match[1]),
      g: byte(match[2] + match[2]),
      b: byte(match[3] + match[3]),
      a: byte(match[4] + match[4]) / 255,
    };
  }
  match = hex3.exec(color);
  if (match) return { r: byte(match[1] + match[1]), g: byte(match[2] + match[2]), b: byte(match[3] + match[3]) };
  return null;
}

// Maps a value in [0, max] (or a percentage of max) to [0, 1]; "1.0" counts as 100%. A hue (max 360) is not clamped
// but wrapped (400 is 40, -30 is 330), and a percentage hue is not a number, as in TinyColor.
function unit(value: Unit, max: number) {
  let input: Unit = value;
  if (typeof input === 'string' && input.includes('.') && parseFloat(input) === 1) input = '100%';
  const percent = typeof input === 'string' && input.includes('%');
  let n = max === 360 ? Number(input) : Math.min(max, Math.max(0, parseFloat(String(input))));
  if (percent) n = parseInt(String(n * max), 10) / 100;
  if (Math.abs(n - max) < 0.000001) return 1;
  if (max === 360) {
    return (n < 0 ? (n % max) + max : n % max) / max;
  }
  return (n % max) / max;
}

// A bare number up to 1 is read as a fraction of 100%.
function percentage(value: Unit): Unit {
  return Number(value) <= 1 ? `${Number(value) * 100}%` : value;
}

function alphaOf(value: Unit | undefined) {
  const a = parseFloat(String(value));
  return Number.isNaN(a) || a < 0 || a > 1 ? 1 : a;
}

function hsvToRgb(h: Unit, s: Unit, v: Unit) {
  const hue = unit(h, 360) * 6;
  const sat = unit(s, 100);
  const val = unit(v, 100);
  const i = Math.floor(hue);
  const f = hue - i;
  const p = val * (1 - sat);
  const q = val * (1 - f * sat);
  const t = val * (1 - (1 - f) * sat);
  const sector = i % 6;
  return {
    r: [val, q, p, p, t, val][sector] * 255,
    g: [t, val, val, q, p, p][sector] * 255,
    b: [p, p, t, val, val, q][sector] * 255,
  };
}

function hueChannel(p: number, q: number, t: number) {
  let x = t;
  if (x < 0) x += 1;
  if (x > 1) x -= 1;
  if (x < 1 / 6) return p + (q - p) * (6 * x);
  if (x < 1 / 2) return q;
  if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
  return p;
}

function hslToRgb(h: Unit, s: Unit, l: Unit) {
  const hue = unit(h, 360);
  const sat = unit(s, 100);
  const light = unit(l, 100);
  if (sat === 0) return { r: light * 255, g: light * 255, b: light * 255 };
  const q = light < 0.5 ? light * (1 + sat) : light + sat - light * sat;
  const p = 2 * light - q;
  return {
    r: hueChannel(p, q, hue + 1 / 3) * 255,
    g: hueChannel(p, q, hue) * 255,
    b: hueChannel(p, q, hue - 1 / 3) * 255,
  };
}

function hueOf(r: number, g: number, b: number, max: number, d: number) {
  if (d === 0) return 0;
  let h = 0;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return h / 6;
}

function hex2(n: number) {
  const hex = Math.round(n).toString(16);
  return hex.length === 1 ? `0${hex}` : hex;
}

/**
 * The subset of `@ctrl/tinycolor`'s `TinyColor` that Shoelace's color picker uses: construct from a string, then read
 * `isValid` and the five conversions.
 */
export class TinyColor {
  /** Whether the input string was understood. An invalid color reads as opaque black. */
  public readonly isValid: boolean;
  private readonly r: number;
  private readonly g: number;
  private readonly b: number;
  private readonly a: number;

  public constructor(color = '') {
    const parsed = parseString(String(color));
    let rgb = { r: 0, g: 0, b: 0 };
    let ok = false;
    if (parsed) {
      if (isUnit(parsed.r) && isUnit(parsed.g) && isUnit(parsed.b)) {
        rgb = { r: unit(parsed.r!, 255) * 255, g: unit(parsed.g!, 255) * 255, b: unit(parsed.b!, 255) * 255 };
        ok = true;
      } else if (isUnit(parsed.h) && isUnit(parsed.s) && isUnit(parsed.v)) {
        rgb = hsvToRgb(parsed.h!, percentage(parsed.s!), percentage(parsed.v!));
        ok = true;
      } else if (isUnit(parsed.h) && isUnit(parsed.s) && isUnit(parsed.l)) {
        rgb = hslToRgb(parsed.h!, percentage(parsed.s!), percentage(parsed.l!));
        ok = true;
      }
    }
    const clampChannel = (n: number) => {
      const c = Math.min(255, Math.max(n, 0));
      return c < 1 ? Math.round(c) : c;
    };
    this.r = clampChannel(rgb.r);
    this.g = clampChannel(rgb.g);
    this.b = clampChannel(rgb.b);
    this.a = alphaOf(parsed && parsed.a !== undefined ? parsed.a : 1);
    this.isValid = ok;
  }

  /** Hue 0-360, saturation and lightness 0-1, alpha 0-1. */
  public toHsl(): HslaColor {
    const r = unit(this.r, 255);
    const g = unit(this.g, 255);
    const b = unit(this.b, 255);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    const d = max - min;
    const s = d === 0 ? 0 : l > 0.5 ? d / (2 - max - min) : d / (max + min);
    return { h: hueOf(r, g, b, max, d) * 360, s, l, a: this.a };
  }

  /** Hue 0-360, saturation and value 0-1, alpha 0-1. */
  public toHsv(): HsvaColor {
    const r = unit(this.r, 255);
    const g = unit(this.g, 255);
    const b = unit(this.b, 255);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;
    return { h: hueOf(r, g, b, max, d) * 360, s: max === 0 ? 0 : d / max, v: max, a: this.a };
  }

  /** Rounded RGB channels 0-255 and alpha 0-1. */
  public toRgb(): RgbaColor {
    return { r: Math.round(this.r), g: Math.round(this.g), b: Math.round(this.b), a: this.a };
  }

  /** `#rrggbb`, lowercase. */
  public toHexString() {
    return `#${hex2(this.r)}${hex2(this.g)}${hex2(this.b)}`;
  }

  /** `#rrggbbaa`, lowercase. */
  public toHex8String() {
    return `${this.toHexString()}${hex2(this.a * 255)}`;
  }
}
