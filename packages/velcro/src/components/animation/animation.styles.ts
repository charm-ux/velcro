// Adapted from Shoelace v2.20.1 (src/components/animation/animation.styles.ts and the shared src/styles/component.styles.ts
// it is composed with), Copyright (c) 2020 A Beautiful Site, LLC, MIT License. See THIRD_PARTY_NOTICES.md. No changes to
// the declarations. They replace core's base styles for this component, because core adds a
// `:host([hidden]) { display: none !important }` rule that Shoelace does not have.
import { css } from 'lit';

export default css`
  :host {
    box-sizing: border-box;
  }

  :host *,
  :host *::before,
  :host *::after {
    box-sizing: inherit;
  }

  [hidden] {
    display: none !important;
  }

  :host {
    display: contents;
  }
`;
