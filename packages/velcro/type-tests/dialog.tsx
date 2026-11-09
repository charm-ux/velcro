// Type-level check of <sl-dialog>'s Shoelace 2.20.1 property types (`open`, `label`, `noHeader` and the `modal` focus
// trap), that `dir` accepts any string as Shoelace declares it (`dir: string`), and that the React wrapper takes the same
// props and the `onSlShow`, `onSlAfterShow`, `onSlHide`, `onSlAfterHide`, `onSlInitialFocus` and `onSlRequestClose`
// handlers. Compiled (never run) by `tsc -p tsconfig.react.json` as the last step of the library build.
import { createElement, createRef } from 'react';
import type { VelcroDialog as VelcroDialogClass } from '../dist/components/dialog/dialog.js';
import { VelcroDialog, type VelcroDialogElement, type VelcroDialogProps } from '../dist/react/index.js';

declare const element: VelcroDialogClass;
declare const direction: string;

element.open = true;
element.label = 'Dialog';
element.noHeader = true;
const open: boolean = element.open;
const label: string = element.label;
const noHeader: boolean = element.noHeader;
void [open, label, noHeader];

// @ts-expect-error open is a boolean
element.open = 'yes';
// @ts-expect-error label is a string
element.label = 1;
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

const ref = createRef<VelcroDialogElement>();
const props: VelcroDialogProps = { label: 'Dialog', open: true, noHeader: false };
createElement(VelcroDialog, {
  ...props,
  ref,
  onSlShow: event => void event.target.open,
  onSlAfterShow: event => void event.target.label,
  onSlHide: event => void event.target.noHeader,
  onSlAfterHide: event => void event.target.open,
  onSlInitialFocus: event => event.preventDefault(),
  onSlRequestClose: event => {
    const source: 'close-button' | 'keyboard' | 'overlay' = event.detail.source;
    if (source === 'overlay') event.preventDefault();
  },
});
// @ts-expect-error open is a boolean
createElement(VelcroDialog, { open: 'yes' });
