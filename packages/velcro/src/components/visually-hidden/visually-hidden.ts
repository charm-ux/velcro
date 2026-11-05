// Portions of the API documentation wording in this file and the rendered structure (a default slot only) are adapted
// from Shoelace v2.20.1 (src/components/visually-hidden/visually-hidden.component.ts), Copyright (c) 2020 A Beautiful Site,
// LLC, MIT License. See THIRD_PARTY_NOTICES.md. No Shoelace source file or runtime is included.
import { html } from 'lit';
import { CharmElement } from '@charm-ux/core/dist/base/index.js';
import styles from './visually-hidden.styles.js';

/**
 * The visually hidden utility makes content accessible to assistive devices without displaying it on the screen.
 * API modelled on Shoelace's `sl-visually-hidden`. There is no core counterpart, so it extends the core base element.
 *
 * @tag sl-visually-hidden
 * @status prototype
 *
 * @slot - The content to be visually hidden.
 */
export class VelcroVisuallyHidden extends CharmElement {
  public static override baseName = 'visually-hidden';

  public static override styles = [...CharmElement.styles, styles];

  protected override render() {
    return html` <slot></slot> `;
  }
}

export default VelcroVisuallyHidden;
