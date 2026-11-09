// Adapted from Shoelace v2.20.1 (`scrollIntoView` from src/internal/scroll.ts and `getOffset` from src/internal/offset.ts),
// Copyright (c) 2020 A Beautiful Site, LLC, MIT License. See THIRD_PARTY_NOTICES.md. Only the two helpers the tab group
// and the select use are taken; the logic is unchanged. Internal: not part of the package exports.

/**
 * Returns an element's offset relative to its parent. Similar to element.offsetTop and element.offsetLeft, except the
 * parent doesn't have to be positioned relative or absolute.
 */
export function getOffset(element: HTMLElement, parent: HTMLElement) {
  return {
    top: Math.round(element.getBoundingClientRect().top - parent.getBoundingClientRect().top),
    left: Math.round(element.getBoundingClientRect().left - parent.getBoundingClientRect().left),
  };
}

/** Scrolls an element into view of its container. If the element is already in view, nothing will happen. */
export function scrollIntoView(
  element: HTMLElement,
  container: HTMLElement,
  direction: 'horizontal' | 'vertical' | 'both' = 'vertical',
  behavior: 'smooth' | 'auto' = 'smooth'
) {
  const offset = getOffset(element, container);
  const offsetTop = offset.top + container.scrollTop;
  const offsetLeft = offset.left + container.scrollLeft;
  const minX = container.scrollLeft;
  const maxX = container.scrollLeft + container.offsetWidth;
  const minY = container.scrollTop;
  const maxY = container.scrollTop + container.offsetHeight;

  if (direction === 'horizontal' || direction === 'both') {
    if (offsetLeft < minX) {
      container.scrollTo({ left: offsetLeft, behavior });
    } else if (offsetLeft + element.clientWidth > maxX) {
      container.scrollTo({ left: offsetLeft - container.offsetWidth + element.clientWidth, behavior });
    }
  }

  if (direction === 'vertical' || direction === 'both') {
    if (offsetTop < minY) {
      container.scrollTo({ top: offsetTop, behavior });
    } else if (offsetTop + element.clientHeight > maxY) {
      container.scrollTo({ top: offsetTop - container.offsetHeight + element.clientHeight, behavior });
    }
  }
}
