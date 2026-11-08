// This file was written for Velcro. No Shoelace source is included.
// Typing layer for sl-input. Shoelace declares `min` and `max` as `number | string` and `step` as `number | 'any'`, and the
// Velcro input declares exactly those types. TypeScript only lets a subclass declare a property type that is assignable
// to the inherited one, and the core input declares all three as `number`.
// `CoreInputTyping` is the core input with those three declarations loosened to `any`, so the Velcro class can redeclare
// each one with Shoelace's own type. The `declare` fields emit no code, and the loosened types never reach a consumer
// because the class redeclares all three. This module is not exported from the package (neither `class.ts` nor
// `index.ts` re-exports it).
//
// `autocorrect` cannot be handled this way: lib.dom's HTMLElement declares `autocorrect: boolean`, and a class whose
// `autocorrect` is `'off' | 'on'` is not an HTMLElement for TypeScript. See the class.
import { CoreInput } from '@charm-ux/core/dist/components/input/input.js';

export class CoreInputTyping extends CoreInput {
  // `@ignore` keeps the loosened declarations out of the Custom Elements Manifest, which takes the types from the class.
  /** @ignore */
  declare min: any;
  /** @ignore */
  declare max: any;
  /** @ignore */
  declare step: any;
}
