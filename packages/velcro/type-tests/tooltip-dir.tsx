// Type-level check that <sl-tooltip>'s `dir` accepts any string, as Shoelace 2.20.1 declares it (`dir: string`).
// Compiled (never run) by `tsc -p tsconfig.react.json` as the last step of the library build.
import type { VelcroTooltip } from '../dist/components/tooltip/tooltip.js';

declare const element: VelcroTooltip;
declare const direction: string;

// A direction from configuration or another element is a plain string.
element.dir = direction;
element.dir = 'rtl';
const read: string = element.dir;
void read;

// @ts-expect-error a number is not a direction
element.dir = 1;
