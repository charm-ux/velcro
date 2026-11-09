// Adapted from Shoelace v2.20.1 (src/internal/slot.ts, `HasSlotController` and `getTextContent`), Copyright (c) 2020
// A Beautiful Site, LLC, MIT License. See THIRD_PARTY_NOTICES.md. Changes: TypeScript member accessibility and comments
// only; the default-slot rule and `getTextContent` are unchanged.
//
// Core's controller of the same name differs in its default-slot rule: it ignores any element with a
// `visually-hidden` class and compares a lowercase `visually-hidden` substring with the uppercase tag name, so it counts
// `<sl-visually-hidden>` as content. Components whose rendered classes depend on the default slot use this one.
import type { ReactiveController, ReactiveControllerHost } from 'lit';

/** Tracks whether the host has content in the given slots (`[default]` for the default slot), as Shoelace does. */
export class HasSlotController implements ReactiveController {
  public host: ReactiveControllerHost & Element;
  public slotNames: string[] = [];

  public constructor(host: ReactiveControllerHost & Element, ...slotNames: string[]) {
    (this.host = host).addController(this);
    this.slotNames = slotNames;
  }

  // Non-blank text, or an element without a slot attribute other than <sl-visually-hidden>, which is not rendered.
  private hasDefaultSlot() {
    return [...this.host.childNodes].some(node => {
      if (node.nodeType === node.TEXT_NODE && node.textContent!.trim() !== '') {
        return true;
      }

      if (node.nodeType === node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        const tagName = el.tagName.toLowerCase();

        if (tagName === 'sl-visually-hidden') {
          return false;
        }

        if (!el.hasAttribute('slot')) {
          return true;
        }
      }

      return false;
    });
  }

  private hasNamedSlot(name: string) {
    return this.host.querySelector(`:scope > [slot="${name}"]`) !== null;
  }

  /** Whether the slot has content. */
  public test(slotName: string) {
    return slotName === '[default]' ? this.hasDefaultSlot() : this.hasNamedSlot(slotName);
  }

  public hostConnected() {
    this.host.shadowRoot!.addEventListener('slotchange', this.handleSlotChange);
  }

  public hostDisconnected() {
    this.host.shadowRoot!.removeEventListener('slotchange', this.handleSlotChange);
  }

  private handleSlotChange = (event: Event) => {
    const slot = event.target as HTMLSlotElement;

    if ((this.slotNames.includes('[default]') && !slot.name) || (slot.name && this.slotNames.includes(slot.name))) {
      this.host.requestUpdate();
    }
  };
}

/**
 * Given a slot, this function iterates over all of its assigned text nodes and returns the concatenated text as a
 * string. This is useful because we can't use slot.textContent as an alternative.
 */
export function getTextContent(slot: HTMLSlotElement | undefined | null): string {
  if (!slot) {
    return '';
  }
  const nodes = slot.assignedNodes({ flatten: true });
  let text = '';

  [...nodes].forEach(node => {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent;
    }
  });

  return text;
}
