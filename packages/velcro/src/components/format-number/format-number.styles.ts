// Shoelace v2.20.1 (src/components/format-number/) has no styles file of its own and does not import its shared component
// styles, so its host is the default inline custom element with the browser's initial `content-box` sizing. This file is
// written for Velcro: it keeps the host inline (so core's `display` cannot change it) and resets the `box-sizing: border-box`
// that the core base styles add, to match upstream. No Shoelace source is included.
import { css } from 'lit';

export default css`
  :host {
    display: inline;
    box-sizing: content-box;
  }
`;
