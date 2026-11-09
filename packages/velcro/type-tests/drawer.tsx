// Type-level check of <sl-drawer>'s Shoelace 2.20.1 property types (`open`, `label`, `placement`, `contained`, `noHeader`
// and the `modal` focus trap), that `dir` accepts any string as Shoelace declares it (`dir: string`), and that the React
// wrapper takes the same props and the `onSlShow`, `onSlAfterShow`, `onSlHide`, `onSlAfterHide`, `onSlInitialFocus` and
// `onSlRequestClose` handlers. Compiled (never run) by `tsc -p tsconfig.react.json` as the last step of the library build.
import { createElement, createRef } from 'react';
import type { VelcroDrawer as VelcroDrawerClass } from '../dist/components/drawer/drawer.js';
import { VelcroDrawer, type VelcroDrawerElement, type VelcroDrawerProps } from '../dist/react/index.js';

declare const element: VelcroDrawerClass;
declare const direction: string;

element.open = true;
element.label = 'Drawer';
element.placement = 'start';
element.contained = true;
element.noHeader = true;
const open: boolean = element.open;
const label: string = element.label;
const placement: 'top' | 'end' | 'bottom' | 'start' = element.placement;
const contained: boolean = element.contained;
const noHeader: boolean = element.noHeader;
void [open, label, placement, contained, noHeader];

// @ts-expect-error open is a boolean
element.open = 'yes';
// @ts-expect-error label is a string
element.label = 1;
// @ts-expect-error placement is one of top, end, bottom and start
element.placement = 'left';
// @ts-expect-error contained is a boolean
element.contained = 'yes';
// @ts-expect-error noHeader is a boolean
element.noHeader = 'yes';

element.modal.activateExternal();
element.modal.deactivateExternal();
const active: boolean = element.modal.isActive();
void active;

element.dir = direction;
const read: string = element.dir;
void read;

const shown: Promise<void> | Promise<undefined> = element.show();
const hidden: Promise<void> | Promise<undefined> = element.hide();
void [shown, hidden];

const ref = createRef<VelcroDrawerElement>();
const props: VelcroDrawerProps = { label: 'Drawer', open: true, placement: 'top', contained: false, noHeader: false };
createElement(VelcroDrawer, {
  ...props,
  ref,
  onSlShow: event => void event.target.open,
  onSlAfterShow: event => void event.target.label,
  onSlHide: event => void event.target.placement,
  onSlAfterHide: event => void event.target.contained,
  onSlInitialFocus: event => event.preventDefault(),
  onSlRequestClose: event => {
    const source: 'close-button' | 'keyboard' | 'overlay' = event.detail.source;
    if (source === 'overlay') event.preventDefault();
  },
});
// @ts-expect-error open is a boolean
createElement(VelcroDrawer, { open: 'yes' });
// @ts-expect-error placement is one of top, end, bottom and start
createElement(VelcroDrawer, { placement: 'left' });
