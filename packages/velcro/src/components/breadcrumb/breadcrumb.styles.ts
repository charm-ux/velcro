// Adapted from Shoelace v2.20.1 (src/components/breadcrumb/breadcrumb.styles.ts and the shared
// src/styles/component.styles.ts it is composed with), Copyright (c) 2020 A Beautiful Site, LLC, MIT License. See
// THIRD_PARTY_NOTICES.md. The two files are concatenated and every rule is unchanged: the shared component styles first,
// then the breadcrumb's own. They replace core's base and breadcrumb styles for this component: core adds a
// `:host([hidden]) { display: none !important }` rule and a `display: block` host that Shoelace does not have, and styles
// a different structure. As in Shoelace, the host has no display rule of its own, so it is an inline box.
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

  .breadcrumb {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
  }
`;
