// Type-level check of <sl-qr-code>'s Shoelace 2.20.1 property types (`value`, `label`, `size`, `fill`, `background`,
// `radius` and `errorCorrection`, with the public `canvas` field and `generate()` method), that `dir` accepts any string as
// Shoelace declares it (`dir: string`), and that the React wrapper takes the same props.
// Compiled (never run) by `tsc -p tsconfig.react.json` as the last step of the library build.
import { createElement, createRef } from 'react';
import type { VelcroQrCode as VelcroQrCodeClass } from '../dist/components/qr-code/qr-code.js';
import { VelcroQrCode, type VelcroQrCodeElement, type VelcroQrCodeProps } from '../dist/react/index.js';

declare const code: VelcroQrCodeClass;
declare const direction: string;

// A direction from configuration or another element is a plain string.
code.dir = direction;
code.dir = 'rtl';
const read: string = code.dir;
void read;

// @ts-expect-error a number is not a direction
code.dir = 1;

code.value = 'https://example.com/';
code.label = 'Visit the site';
code.size = 64;
code.fill = 'deeppink';
code.background = 'transparent';
code.radius = 0.5;
code.errorCorrection = 'L';
const canvas: HTMLElement = code.canvas;
void canvas;
code.generate();
// @ts-expect-error the size is a number
code.size = '64';
// @ts-expect-error the error correction level is one of L, M, Q and H
code.errorCorrection = 'X';
// @ts-expect-error the radius is a number
code.radius = 'round';

const ref = createRef<VelcroQrCodeElement>();
const props: VelcroQrCodeProps = {
  value: 'https://example.com/',
  label: 'Visit the site',
  size: 64,
  fill: 'black',
  background: 'white',
  radius: 0,
  errorCorrection: 'H',
};
createElement(VelcroQrCode, { ...props, ref });
