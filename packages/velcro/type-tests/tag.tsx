// Type-level check of <sl-tag>'s Shoelace 2.20.1 property types (`variant` with its six values, `size` with its three, `pill`
// and `removable`), that `dir` accepts any string as Shoelace declares it (`dir: string`), and that the React wrapper takes the
// same props and the `onSlRemove` handler.
// Compiled (never run) by `tsc -p tsconfig.react.json` as the last step of the library build.
import { createElement, createRef } from 'react';
import type { VelcroTag as VelcroTagClass } from '../dist/components/tag/tag.js';
import { VelcroTag, type VelcroTagElement, type VelcroTagProps } from '../dist/react/index.js';

declare const element: VelcroTagClass;
declare const direction: string;

element.variant = 'primary';
element.variant = 'text';
element.size = 'large';
element.pill = true;
element.removable = true;
const variant: 'primary' | 'success' | 'neutral' | 'warning' | 'danger' | 'text' = element.variant;
const size: 'small' | 'medium' | 'large' = element.size;
const pill: boolean = element.pill;
const removable: boolean = element.removable;
void [variant, size, pill, removable];

// @ts-expect-error variant is one of six values
element.variant = 'info';
// @ts-expect-error size is small, medium or large
element.size = 'huge';
// @ts-expect-error pill is a boolean
element.pill = 'yes';

element.dir = direction;
const read: string = element.dir;
void read;

const ref = createRef<VelcroTagElement>();
const props: VelcroTagProps = { variant: 'success', size: 'small', pill: true, removable: true };
createElement(VelcroTag, { ...props, ref, onSlRemove: event => void event.target.variant });
// @ts-expect-error variant is one of six values
createElement(VelcroTag, { variant: 'info' });
