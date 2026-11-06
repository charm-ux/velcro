// Adapted from Shoelace v2.20.1 (src/components/icon/icon.styles.ts and the shared src/styles/component.styles.ts it is
// composed with), Copyright (c) 2020 A Beautiful Site, LLC, MIT License. See THIRD_PARTY_NOTICES.md. No changes to the
// declarations. They replace core's base and icon styles for this component.
//
// Upstream quirk: the icon's `display: inline-block` is author CSS, so it beats the browser's own `[hidden]` rule, and
// `<sl-icon hidden>` stays visible. The shared `[hidden]` rule only applies inside the shadow root.
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
    width: 1em;
    height: 1em;
    box-sizing: content-box !important;
  }

  svg {
    display: block;
    height: 100%;
    width: 100%;
  }
`;
