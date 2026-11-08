// Portions of the API documentation wording in this file and the rendered structure (one slot carrying the `base`
// part and the `menu-label` class) are adapted from Shoelace v2.20.1 (src/components/menu-label/menu-label.component.ts),
// Copyright (c) 2020 A Beautiful Site, LLC, MIT License. See THIRD_PARTY_NOTICES.md. No Shoelace source file or
// runtime is included.
import { html } from 'lit';
import { property } from 'lit/decorators.js';
import { CharmElement } from '@charm-ux/core/dist/base/charm-element/charm-element.js';
import styles from './menu-label.styles.js';

/**
 * Menu labels are used to describe a group of menu items. API modelled on Shoelace's `sl-menu-label`. There is no core
 * counterpart, so it extends the core base element.
 *
 * Velcro extension inherited from the core base element and kept: the non-bubbling `ready` event, emitted on the first
 * update. Shoelace's menu label has no events.
 *
 * @tag sl-menu-label
 * @status prototype
 *
 * @slot - The menu label's content.
 *
 * @csspart base - The component's base wrapper.
 */
export class VelcroMenuLabel extends CharmElement {
  public static override baseName = 'menu-label';

  // The core base styles are replaced by Shoelace's own (see the styles file). Core's add a `:host([hidden]) { display: none
  // !important }` rule that Shoelace does not have, which would change what the `hidden` attribute does here.
  public static override styles = [styles];

  private velcroDir?: string;

  // `dir` and `lang` are declared as Shoelace's base element declares them: reactive, not reflected and without an
  // initial value (undefined). Core's `dir` would return the computed direction instead.
  // Types: Shoelace declares `dir: string`. The setter accepts any string, as Shoelace's does. The getter must keep
  // core's declared type, because TypeScript does not let a subclass widen an inherited property's read type; at
  // runtime it returns whatever was set.
  /**
   * The element's text direction, as set by the `dir` attribute or property and returned as set. Not reflected. Any
   * string can be assigned; the declared read type stays core's `'ltr' | 'rtl' | 'auto'`.
   */
  @property()
  public override get dir(): 'ltr' | 'rtl' | 'auto' {
    return this.velcroDir as 'ltr' | 'rtl' | 'auto';
  }
  public override set dir(value: string) {
    this.velcroDir = value;
  }

  /** The element's language, as set by the `lang` attribute or property. Not reflected. */
  @property()
  public override lang!: string;

  protected override render() {
    return html` <slot part="base" class="menu-label"></slot> `;
  }
}

export default VelcroMenuLabel;
