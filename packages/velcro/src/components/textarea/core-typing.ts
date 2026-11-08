// This file was written for Velcro. No Shoelace source is included.
// Typing layer for sl-textarea. Shoelace declares `resize: 'none' | 'vertical' | 'auto'` and `autocomplete: string`, and
// the Velcro textarea declares exactly those types. TypeScript only lets a subclass declare a property type that is
// assignable to the inherited one, and the core text area's declarations are not compatible:
//   - `resize` is 'none' | 'horizontal' | 'vertical' | 'both' (no 'auto');
//   - `autocomplete` is 'off' | 'on'.
// `CoreTextAreaTyping` is the core text area with those two declarations loosened to `any`, so the Velcro class can
// redeclare each one with Shoelace's own type. The `declare` fields emit no code, and the loosened types never reach a
// consumer because the class redeclares both. This module is not exported from the package (neither `class.ts` nor `index.ts` re-exports it).
//
// `autocorrect` cannot be handled this way: Shoelace types it `string`, but lib.dom's HTMLElement declares
// `autocorrect: boolean`, and a class whose `autocorrect` is `string` is not an HTMLElement for TypeScript. That breaks
// the generated JSX types (`T extends HTMLElement`) and every API that takes an HTMLElement. See the class.
import { CoreTextArea } from '@charm-ux/core/dist/components/text-area/text-area.js';

export class CoreTextAreaTyping extends CoreTextArea {
  // `@ignore` keeps the loosened declarations out of the Custom Elements Manifest, which takes the types from the class.
  /** @ignore */
  declare resize: any;
  /** @ignore */
  declare autocomplete: any;
}
