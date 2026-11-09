// This file was written for Velcro. No Shoelace source is included.
// Typing layer for sl-select. Shoelace declares `value: string | string[]` and `size: 'small' | 'medium' | 'large'`, and
// the Velcro select declares exactly those types. TypeScript only lets a subclass declare a property type that is
// assignable to the inherited one, and the core select declares `value` as `string` (inherited from core's form control
// base) and `size` as `number` (the native <select> size).
// `CoreSelectTyping` is the core select with those two declarations loosened to `any`, so the Velcro class can redeclare
// each one with Shoelace's own type. `size` is a `declare` field and emits no code; `value` is an accessor in core, which
// a field cannot override, so it is redeclared as an accessor that forwards to core's. The loosened types never reach a
// consumer because the class redeclares both. This module is not exported from the package (neither `class.ts` nor
// `index.ts` re-exports it).
import { CoreSelect } from '@charm-ux/core/dist/components/select/select.js';

export class CoreSelectTyping extends CoreSelect {
  // `@ignore` keeps the loosened declarations out of the Custom Elements Manifest, which takes the types from the class.
  /** @ignore */
  declare size: any;

  /** @ignore */
  public override get value(): any {
    return super.value;
  }
  /** @ignore */
  public override set value(value: any) {
    super.value = value;
  }
}
