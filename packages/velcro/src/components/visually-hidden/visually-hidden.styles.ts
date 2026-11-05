// Adapted from Shoelace v2.20.1 (src/components/visually-hidden/visually-hidden.styles.ts), Copyright (c) 2020
// A Beautiful Site, LLC, MIT License. See THIRD_PARTY_NOTICES.md. No changes to the declarations.
import { css } from 'lit';

export default css`
  :host(:not(:focus-within)) {
    position: absolute !important;
    width: 1px !important;
    height: 1px !important;
    clip: rect(0 0 0 0) !important;
    clip-path: inset(50%) !important;
    border: none !important;
    overflow: hidden !important;
    white-space: nowrap !important;
    padding: 0 !important;
  }
`;
