// Adapted from Shoelace v2.20.1 (src/internal/active-elements.ts), Copyright (c) 2020 A Beautiful Site, LLC, MIT
// License. See THIRD_PARTY_NOTICES.md. No change to the behavior. Internal; not a package export.

/**
 * Use a generator so we can iterate and possibly break early.
 * @example
 *   // to operate like a regular array. This kinda nullifies generator benefits, but worth knowing if you need the whole array.
 *   const allActiveElements = [...activeElements()]
 *
 *   // Early return
 *   for (const activeElement of activeElements()) {
 *     if (<cond>) {
 *       break; // Break the loop, dont need to iterate over the whole array or store an array in memory!
 *     }
 *   }
 */
export function* activeElements(activeElement: Element | null = document.activeElement): Generator<Element> {
  if (activeElement === null || activeElement === undefined) return;

  yield activeElement;

  if ('shadowRoot' in activeElement && activeElement.shadowRoot && activeElement.shadowRoot.mode !== 'closed') {
    yield* activeElements(activeElement.shadowRoot.activeElement);
  }
}

export function getDeepestActiveElement() {
  return [...activeElements()].pop();
}
