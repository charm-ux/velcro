// Type-level check that <sl-textarea>'s `dir` accepts any string, as Shoelace 2.20.1 declares it (`dir: string`), and that
// the properties whose source type is `any` (resize, autocomplete, autocorrect) take Shoelace's value types.
// Compiled (never run) by `tsc -p tsconfig.react.json` as the last step of the library build.
import type { VelcroTextarea } from '../dist/components/textarea/textarea.js';

declare const element: VelcroTextarea;
declare const direction: string;

// A direction from configuration or another element is a plain string.
element.dir = direction;
element.dir = 'rtl';
const read: string = element.dir;
void read;

// @ts-expect-error a number is not a direction
element.dir = 1;

// Shoelace's own value types for the three properties typed `any`.
element.resize = 'auto';
element.autocomplete = 'off';
element.autocorrect = 'on';
const resize: 'none' | 'vertical' | 'auto' = element.resize;
void resize;
