// Adapted from Shoelace v2.20.1 (src/internal/math.ts), Copyright (c) 2020 A Beautiful Site, LLC, MIT License.
// See THIRD_PARTY_NOTICES.md. No change to the behavior.

/** Ensures a number stays within a minimum and maximum value. */
export function clamp(value: number, min: number, max: number) {
  const noNegativeZero = (n: number) => (Object.is(n, -0) ? 0 : n);

  if (value < min) {
    return noNegativeZero(min);
  }

  if (value > max) {
    return noNegativeZero(max);
  }

  return noNegativeZero(value);
}
