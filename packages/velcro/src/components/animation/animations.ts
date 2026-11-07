// Adapted from Shoelace v2.20.1 (src/components/animation/animations.ts), Copyright (c) 2020 A Beautiful Site, LLC,
// MIT License. See THIRD_PARTY_NOTICES.md. Velcro changes: the presets are imported from Velcro's own copy of
// @shoelace-style/animations 1.2.0 (`./presets/presets.ts`) instead of the package, and type annotations are added. The
// namespace import keeps the package's runtime shape: a module namespace object whose keys are sorted, with `easings`
// as one of them.
import * as animations from './presets/presets.js';

export { animations };

/** Gets a list of all supported animation names. */
export function getAnimationNames(): string[] {
  return Object.entries(animations)
    .filter(([name]) => name !== 'easings')
    .map(([name]) => name);
}

/** Gets a list of all supported easing function names. */
export function getEasingNames(): string[] {
  return Object.entries(animations.easings).map(([name]) => name);
}
