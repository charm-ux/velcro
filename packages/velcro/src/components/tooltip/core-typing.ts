// This file was written for Velcro. No Shoelace source is included.
// Typing layer for sl-tooltip. Shoelace declares `placement` with its twelve physical placements ('top', 'right-start',
// 'left-end' and so on) and `popup: SlPopup`, and the Velcro tooltip declares exactly those types. TypeScript only lets a
// subclass declare a property type that is assignable to the inherited one, and the core tooltip's declarations are not
// compatible:
//   - `placement` is core's popup placement ('top', 'start', 'end-top' and so on: no 'right' or 'left');
//   - `popup` is core's popup class, whose private members make it incompatible with Velcro's popup.
// `CoreTooltipTyping` is the core tooltip with those two declarations loosened to `any`, so the Velcro class can
// redeclare each one with Shoelace's own type. The `popup` field is a `declare` field and emits no code; the `placement`
// accessor pair only forwards to core's, and the Velcro class overrides it again. The loosened types never reach a
// consumer because the class redeclares both. This module is not exported from the package (neither `class.ts` nor
// `index.ts` re-exports it).
import { CoreTooltip } from '@charm-ux/core/dist/components/tooltip/tooltip.js';

export class CoreTooltipTyping extends CoreTooltip {
  // `@ignore` keeps the loosened declarations out of the Custom Elements Manifest, which takes the types from the class.
  /** @ignore */
  declare popup: any;

  /** @ignore */
  public override get placement(): any {
    return super.placement;
  }
  /** @ignore */
  public override set placement(value: any) {
    super.placement = value;
  }
}
