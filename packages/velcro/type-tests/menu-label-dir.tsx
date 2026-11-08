// Type-level check that <sl-menu-label>'s `dir` accepts any string, as Shoelace 2.20.1 declares it (`dir: string`),
// and that the React wrapper takes Shoelace's (empty) props plus the usual element props.
// Compiled (never run) by `tsc -p tsconfig.react.json` as the last step of the library build.
import { createElement, createRef } from 'react';
import type { VelcroMenuLabel as VelcroMenuLabelClass } from '../dist/components/menu-label/menu-label.js';
import { VelcroMenuLabel, type VelcroMenuLabelElement, type VelcroMenuLabelProps } from '../dist/react/index.js';

declare const element: VelcroMenuLabelClass;
declare const direction: string;

// A direction from configuration or another element is a plain string.
element.dir = direction;
element.dir = 'rtl';
const read: string = element.dir;
void read;

// @ts-expect-error a number is not a direction
element.dir = 1;

// Shoelace's menu label has no attributes or events of its own: only the inherited dir and lang.
const ref = createRef<VelcroMenuLabelElement>();
const props: VelcroMenuLabelProps = { lang: 'en', className: 'group-label' };
createElement(VelcroMenuLabel, { ...props, ref }, 'Fruits');
