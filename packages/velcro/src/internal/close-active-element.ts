// Adapted from Shoelace v2.20.1 (src/internal/closeActiveElement.ts), Copyright (c) 2020 A Beautiful Site, LLC, MIT
// License. See THIRD_PARTY_NOTICES.md. No change to the behavior. Shared by the alert and the dialog. Internal; not a
// package export.

/**
 * Calls the blur method on the current active element if it is a child of the provided element.
 * Needed for fixing a11y errors in console.
 * @see https://github.com/shoelace-style/shoelace/issues/2283
 * @param elm The element to check
 */
export const blurActiveElement = (elm: HTMLElement) => {
  const { activeElement } = document;
  if (activeElement && elm.contains(activeElement)) {
    (document.activeElement as HTMLElement)?.blur();
  }
};
