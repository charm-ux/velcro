// Type-level check of <sl-details>'s Shoelace 2.20.1 property types (`open`, `disabled` and `summary`), that `dir` accepts
// any string as Shoelace declares it (`dir: string`), and that the React wrapper takes the same props and the `onSlShow`,
// `onSlAfterShow`, `onSlHide` and `onSlAfterHide` handlers.
// Compiled (never run) by `tsc -p tsconfig.react.json` as the last step of the library build.
import { createElement, createRef } from 'react';
import type { VelcroDetails as VelcroDetailsClass } from '../dist/components/details/details.js';
import { VelcroDetails, type VelcroDetailsElement, type VelcroDetailsProps } from '../dist/react/index.js';

declare const element: VelcroDetailsClass;
declare const direction: string;

element.open = true;
element.disabled = true;
element.summary = 'Toggle Me';
const open: boolean = element.open;
const disabled: boolean = element.disabled;
const summary: string = element.summary;
void [open, disabled, summary];

// @ts-expect-error open is a boolean
element.open = 'yes';
// @ts-expect-error disabled is a boolean
element.disabled = 'yes';
// @ts-expect-error summary is a string
element.summary = 1;

element.dir = direction;
const read: string = element.dir;
void read;

const shown: Promise<void> | Promise<undefined> = element.show();
const hidden: Promise<void> | Promise<undefined> = element.hide();
void [shown, hidden];

const ref = createRef<VelcroDetailsElement>();
const props: VelcroDetailsProps = { summary: 'Toggle Me', open: true, disabled: false };
createElement(VelcroDetails, {
  ...props,
  ref,
  onSlShow: event => void event.target.open,
  onSlAfterShow: event => void event.target.summary,
  onSlHide: event => void event.target.disabled,
  onSlAfterHide: event => void event.target.open,
});
// @ts-expect-error open is a boolean
createElement(VelcroDetails, { open: 'yes' });
