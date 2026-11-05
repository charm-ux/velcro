// Adapted from Shoelace v2.20.1 (src/components/divider/divider.styles.ts), Copyright (c) 2020 A Beautiful Site, LLC,
// MIT License. See THIRD_PARTY_NOTICES.md. Changes: resets for the layout rules that the core divider styles put on
// the host (`width`, `flex`, `padding`, `min-height`, text alignment) so that only the Shoelace box model applies.
import { css } from 'lit';

// The tokens (--sl-panel-border-color, --sl-panel-border-width, --sl-spacing-medium) come from the page's theme; load
// `@charm-ux/velcro/themes/light.css`.
export default css`
  :host {
    --color: var(--sl-panel-border-color);
    --width: var(--sl-panel-border-width);
    --spacing: var(--sl-spacing-medium);

    /* Neutralize core divider host rules. */
    width: auto;
    min-height: 0;
    align-items: normal;
    flex-direction: row;
    text-align: inherit;
    line-height: inherit;
    position: static;
  }

  /* Same selectors as the core rules for properties that are not part of this element's contract. */
  :host([orientation='vertical']),
  :host([inset]),
  :host([orientation='vertical'][inset]) {
    min-height: 0;
    flex-direction: row;
    padding: 0;
  }

  :host(:not([vertical])) {
    display: block;
    border-top: solid var(--width) var(--color);
    margin: var(--spacing) 0;
  }

  :host([vertical]) {
    display: inline-block;
    height: 100%;
    border-left: solid var(--width) var(--color);
    margin: 0 var(--spacing);
  }
`;
