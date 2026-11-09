// Adapted from Shoelace v2.20.1 (src/internal/offset.ts), Copyright (c) 2020 A Beautiful Site, LLC, MIT License.
// See THIRD_PARTY_NOTICES.md. No change to the behavior. Internal; not a package export.

/**
 * Returns an element's offset relative to its parent. Similar to element.offsetTop and element.offsetLeft, except the
 * parent doesn't have to be positioned relative or absolute.
 *
 * NOTE: This was created to work around what appears to be a bug in Chrome where a slotted element's offsetParent seems
 * to ignore elements inside the surrounding shadow DOM: https://bugs.chromium.org/p/chromium/issues/detail?id=920069
 */
export function getOffset(element: HTMLElement, parent: HTMLElement) {
  return {
    top: Math.round(element.getBoundingClientRect().top - parent.getBoundingClientRect().top),
    left: Math.round(element.getBoundingClientRect().left - parent.getBoundingClientRect().left)
  };
}
