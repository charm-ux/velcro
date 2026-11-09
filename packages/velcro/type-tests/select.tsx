// Type-level check of <sl-select>'s and <sl-option>'s Shoelace 2.20.1 property types (the select's `value` as a string or an
// array of strings, `size` with its three values, `placement` with its two, `getTag` taking an option, and the option's
// `value` and `disabled`), that `dir` accepts any string as Shoelace declares it (`dir: string`), and that the React wrappers
// take the same props and the `onSlChange` handler.
// Compiled (never run) by `tsc -p tsconfig.react.json` as the last step of the library build.
import { createElement, createRef } from 'react';
import type { VelcroOption as VelcroOptionClass } from '../dist/components/option/option.js';
import type { VelcroSelect as VelcroSelectClass } from '../dist/components/select/select.js';
import { VelcroOption, VelcroSelect, type VelcroSelectElement, type VelcroSelectProps } from '../dist/react/index.js';

declare const element: VelcroSelectClass;
declare const option: VelcroOptionClass;
declare const direction: string;

element.value = 'option-1';
element.value = ['option-1', 'option-2'];
element.defaultValue = ['option-1'];
element.size = 'large';
element.placement = 'top';
element.maxOptionsVisible = 0;
element.getTag = (tagged, index) => `${tagged.getTextLabel()} ${index}`;
const value: string | string[] = element.value;
const size: 'small' | 'medium' | 'large' = element.size;
const placement: 'top' | 'bottom' = element.placement;
const open: boolean = element.open;
const shown: Promise<unknown> = element.show();
void [value, size, placement, open, shown];

option.value = 'x';
option.disabled = true;
const label: string = option.getTextLabel();
void label;

// @ts-expect-error size is small, medium or large (not core's numeric size)
element.size = 3;
// @ts-expect-error placement is top or bottom
element.placement = 'left';
// @ts-expect-error the value is a string or an array of strings
element.value = 42;

element.dir = direction;
option.dir = direction;
const read: string = element.dir;
void read;

const ref = createRef<VelcroSelectElement>();
const props: VelcroSelectProps = { label: 'Pick', size: 'small', multiple: true, clearable: true, placement: 'top' };
createElement(VelcroSelect, { ...props, ref, onSlChange: event => void event.target.value });
createElement(VelcroOption, { value: 'a', disabled: true });
// @ts-expect-error size is small, medium or large
createElement(VelcroSelect, { size: 'huge' });
