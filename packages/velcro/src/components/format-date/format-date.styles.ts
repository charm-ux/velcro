// Shoelace v2.20.1 (src/components/format-date/) has no styles file of its own; the host is the default inline custom
// element with the base `box-sizing` rule from its element base. This file makes that explicit (Velcro structure), and
// so that core's `display` of a host cannot change it. No Shoelace source is included.
import { css } from 'lit';

export default css`
  :host {
    display: inline;
  }
`;
