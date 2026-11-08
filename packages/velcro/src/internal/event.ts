// Adapted from Shoelace v2.20.1 (src/internal/event.ts), Copyright (c) 2020 A Beautiful Site, LLC, MIT License.
// See THIRD_PARTY_NOTICES.md. No change to the behavior. Internal; not a package export.

/** Waits for a specific event to be emitted from an element. Ignores events that bubble up from child elements. */
export function waitForEvent(el: HTMLElement, eventName: string) {
  return new Promise<void>(resolve => {
    function done(event: Event) {
      if (event.target === el) {
        el.removeEventListener(eventName, done);
        resolve();
      }
    }

    el.addEventListener(eventName, done);
  });
}
