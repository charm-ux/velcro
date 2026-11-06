// Type-level checks for <sl-include> against Shoelace 2.20.1's SlInclude: `dir` accepts any string as Shoelace declares
// it (`dir: string`), the React wrapper takes Shoelace's props and events, and the request helper keeps its signature.
// Compiled (never run) by `tsc -p tsconfig.react.json` as the last step of the library build.
import { createElement, createRef } from 'react';
import type { VelcroInclude as VelcroIncludeClass } from '../dist/components/include/include.js';
import { requestInclude } from '../dist/components/include/request.js';
import { VelcroInclude, type VelcroIncludeElement, type VelcroIncludeProps } from '../dist/react/index.js';

declare const element: VelcroIncludeClass;
declare const direction: string;

// A direction from configuration or another element is a plain string.
element.dir = direction;
element.dir = 'rtl';
const read: string = element.dir;
void read;

// @ts-expect-error a number is not a direction
element.dir = 1;

// Every Shoelace attribute/property with Shoelace's value types, and the sl-load and sl-error events.
const ref = createRef<VelcroIncludeElement>();
const shoelaceProps: VelcroIncludeProps = {
  src: '/fragment.html',
  mode: 'same-origin',
  allowScripts: true,
  onSlLoad: event => event.target.handleSrcChange(),
  onSlError: event => console.log(event.detail.status),
};
createElement(VelcroInclude, { ...shoelaceProps, ref });
const refTarget: VelcroIncludeElement | null = ref.current;
void refTarget;

// Values outside Shoelace's `mode` union are rejected.
// @ts-expect-error -- not a fetch mode Shoelace accepts
const badMode: VelcroIncludeProps = { mode: 'navigate' };
void badMode;

// The request helper: (src, mode?) => Promise<{ ok, status, html }>.
const file: Promise<{ ok: boolean; status: number; html: string }> = requestInclude('/fragment.html', 'no-cors');
void file;
