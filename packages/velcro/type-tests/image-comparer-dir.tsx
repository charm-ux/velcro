// Type-level check of <sl-image-comparer>'s Shoelace 2.20.1 property types (`position`, the `base` and `handle` queries),
// that `dir` accepts any string as Shoelace declares it (`dir: string`), and that the React wrapper takes the same props
// and handler. Compiled (never run) by `tsc -p tsconfig.react.json` as the last step of the library build.
import { createElement, createRef } from 'react';
import type { VelcroImageComparer as VelcroImageComparerClass } from '../dist/components/image-comparer/image-comparer.js';
import {
  VelcroImageComparer,
  type VelcroImageComparerElement,
  type VelcroImageComparerProps,
} from '../dist/react/index.js';

declare const comparer: VelcroImageComparerClass;
declare const direction: string;

// A direction from configuration or another element is a plain string.
comparer.dir = direction;
comparer.dir = 'rtl';
const read: string = comparer.dir;
void read;

// @ts-expect-error a number is not a direction
comparer.dir = 1;

comparer.position = 25;
comparer.lang = 'en';
const base: HTMLElement = comparer.base;
const handle: HTMLElement = comparer.handle;
void [base, handle];
comparer.handlePositionChange();
// @ts-expect-error the position is a number
comparer.position = '25';

const ref = createRef<VelcroImageComparerElement>();
const props: VelcroImageComparerProps = {
  position: 25,
  onSlChange: event => void event.target.position,
};
createElement(VelcroImageComparer, { ...props, ref });
