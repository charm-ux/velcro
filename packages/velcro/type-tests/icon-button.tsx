// Type-level check of <sl-icon-button>'s Shoelace 2.20.1 property types (`name`, `library`, `src`, `href`, `download` and
// `label` strings, `target` with its four values and `disabled`), its methods, that `dir` accepts any string as Shoelace
// declares it (`dir: string`), and that the React wrapper takes the same props and the `onSlFocus` and `onSlBlur` handlers.
// Compiled (never run) by `tsc -p tsconfig.react.json` as the last step of the library build.
import { createElement, createRef } from 'react';
import type { VelcroIconButton as VelcroIconButtonClass } from '../dist/components/icon-button/icon-button.js';
import { VelcroIconButton, type VelcroIconButtonElement, type VelcroIconButtonProps } from '../dist/react/index.js';

declare const element: VelcroIconButtonClass;
declare const direction: string;

element.name = 'gear';
element.name = undefined;
element.library = 'default';
element.src = 'icon.svg';
element.href = 'https://example.com';
element.target = '_blank';
element.download = 'file.txt';
element.label = 'Settings';
element.disabled = true;
const label: string = element.label;
const disabled: boolean = element.disabled;
const name: string | undefined = element.name;
void [label, disabled, name];

// @ts-expect-error target is '_blank', '_parent', '_self' or '_top'
element.target = 'blank';
// @ts-expect-error disabled is a boolean
element.disabled = 'yes';

element.click();
element.focus({ preventScroll: true });
element.blur();

element.dir = direction;
const read: string = element.dir;
void read;

const ref = createRef<VelcroIconButtonElement>();
const props: VelcroIconButtonProps = { name: 'gear', label: 'Settings', href: 'https://example.com', target: '_self', disabled: false };
createElement(VelcroIconButton, { ...props, ref, onSlFocus: event => void event.target.label, onSlBlur: event => void event.target.label });
// @ts-expect-error target is '_blank', '_parent', '_self' or '_top'
createElement(VelcroIconButton, { target: 'blank' });
