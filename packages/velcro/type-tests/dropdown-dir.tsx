// Type-level check that <sl-dropdown>'s `dir` accepts any string, as Shoelace 2.20.1 declares it (`dir: string`), that its
// properties have Shoelace's types, and that the React wrapper takes Shoelace's props and events.
// Compiled (never run) by `tsc -p tsconfig.react.json` as the last step of the library build.
import { createElement, createRef } from 'react';
import type { VelcroDropdown as VelcroDropdownClass } from '../dist/components/dropdown/dropdown.js';
import { VelcroDropdown, type VelcroDropdownElement, type VelcroDropdownProps } from '../dist/react/index.js';

declare const dropdown: VelcroDropdownClass;
declare const direction: string;

// A direction from configuration or another element is a plain string.
dropdown.dir = direction;
dropdown.dir = 'rtl';
const read: string = dropdown.dir;
void read;

// @ts-expect-error a number is not a direction
dropdown.dir = 1;

// The properties are Shoelace's.
dropdown.open = true;
dropdown.placement = 'top-end';
dropdown.disabled = false;
dropdown.stayOpenOnSelect = true;
dropdown.containingElement = document.body;
dropdown.distance = 4;
dropdown.skidding = 4;
dropdown.hoist = true;
dropdown.sync = 'both';
dropdown.sync = undefined;
// @ts-expect-error only the twelve placements exist
dropdown.placement = 'middle';
// @ts-expect-error only width, height and both are sync modes
dropdown.sync = 'depth';

// show() and hide() resolve to nothing when already in that state, else with the event.
const shown: Promise<unknown> = dropdown.show();
const hidden: Promise<unknown> = dropdown.hide();
dropdown.reposition();
void [shown, hidden];

// The wrapper takes the properties and the four events.
const onSlShow: VelcroDropdownProps['onSlShow'] = event => {
  const target: VelcroDropdownElement = event.target;
  void target;
};
const ref = createRef<VelcroDropdownElement>();
createElement(VelcroDropdown, { ref, open: true, placement: 'top-start', distance: 30, skidding: 30, hoist: true, stayOpenOnSelect: true, onSlShow, onSlAfterShow: () => {}, onSlHide: () => {}, onSlAfterHide: () => {} });
