// Adapted from Shoelace v2.20.1 (src/components/qr-code/qr-code.styles.ts and the shared src/styles/component.styles.ts
// it is composed with), Copyright (c) 2020 A Beautiful Site, LLC, MIT License. See THIRD_PARTY_NOTICES.md. The two files
// are concatenated and every rule is unchanged: the shared component styles first, then the QR code's own. They replace
// core's base styles for this component (core adds a `:host([hidden]) { display: none !important }` rule that Shoelace's
// QR code does not have).
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
    display: inline-block;
  }
`;
