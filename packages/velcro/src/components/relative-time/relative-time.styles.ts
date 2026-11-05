// Shoelace v2.20.1 (src/components/relative-time/) has no styles file of its own; the host is the default inline custom
// element and its element base adds no `box-sizing` rule. This file makes that explicit (Velcro structure), so that
// core's host rules cannot change it. No Shoelace source is included. See THIRD_PARTY_NOTICES.md.
import { css } from 'lit';

export default css`
  :host {
    display: inline;
    box-sizing: content-box;
  }
`;
