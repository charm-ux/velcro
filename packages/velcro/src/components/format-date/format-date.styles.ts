// Shoelace v2.20.1 (src/components/format-date/) has no styles at all: its host is the default inline custom element and
// it does not use the shared component stylesheet that sets `box-sizing`. In Velcro the `border-box` rule comes from the core
// CharmElement base styles, a small difference that has no visible effect on unpadded inline text. This file only pins
// `display: inline` so that core's `display` of a host cannot change it. No Shoelace source is included.
import { css } from 'lit';

export default css`
  :host {
    display: inline;
  }
`;
