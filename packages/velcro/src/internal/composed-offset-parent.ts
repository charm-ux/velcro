// The offset-parent lookup below is adapted from composed-offset-position 0.0.6 (`offsetParent`, with its
// `flatTreeParent` walk), Copyright (c) 2023 composed-offset-position contributors, MIT License, and uses
// `isContainingBlock` adapted from @floating-ui/utils 0.2.12 (`dom`), Copyright (c) 2021-present Floating UI
// contributors, MIT License. See THIRD_PARTY_NOTICES.md. Shoelace 2.20.1's popup uses that package so that the
// `absolute` strategy finds the offset parent across shadow roots, where the native `offsetParent` is retargeted
// (shoelace#1135). Velcro has no dependency on either package; the functions are copied with type annotations added.

const willChangeRe = /transform|translate|scale|rotate|perspective|filter/;
const containRe = /paint|layout|strict|content/;
const isNotNone = (value: string | undefined) => !!value && value !== 'none';
let isWebKitValue: boolean | undefined;

function isWebKit(): boolean {
  if (isWebKitValue == null) {
    isWebKitValue = typeof CSS !== 'undefined' && CSS.supports && CSS.supports('-webkit-backdrop-filter', 'none');
  }
  return isWebKitValue;
}

/** Whether the computed style makes the element a containing block (from @floating-ui/utils). */
function isContainingBlock(css: CSSStyleDeclaration): boolean {
  return (
    isNotNone(css.transform) ||
    isNotNone(css.translate) ||
    isNotNone(css.scale) ||
    isNotNone(css.rotate) ||
    isNotNone(css.perspective) ||
    (!isWebKit() && (isNotNone(css.backdropFilter) || isNotNone(css.filter))) ||
    willChangeRe.test(css.willChange || '') ||
    containRe.test(css.contain || '')
  );
}

function flatTreeParent(element: Node): Node | null {
  if ((element as Element).assignedSlot) {
    return (element as Element).assignedSlot;
  }
  if (element.parentNode instanceof ShadowRoot) {
    return element.parentNode.host;
  }
  return element.parentNode;
}

/** The offset parent as the flat tree sees it, the way `offsetParent` behaved before it was retargeted. */
export function composedOffsetParent(element: Element): Element | null {
  // Do an initial walk to check for display:none ancestors.
  for (let ancestor: Node | null = element; ancestor; ancestor = flatTreeParent(ancestor)) {
    if (!(ancestor instanceof Element)) {
      continue;
    }
    if (getComputedStyle(ancestor).display === 'none') {
      return null;
    }
  }
  for (let ancestor = flatTreeParent(element); ancestor; ancestor = flatTreeParent(ancestor)) {
    if (!(ancestor instanceof Element)) {
      continue;
    }
    const style = getComputedStyle(ancestor);
    // Display:contents nodes aren't in the layout tree, so they should be skipped.
    if (style.display === 'contents') {
      continue;
    }
    if (style.position !== 'static' || isContainingBlock(style)) {
      return ancestor;
    }
    if (ancestor.tagName === 'BODY') {
      return ancestor;
    }
  }
  return null;
}
