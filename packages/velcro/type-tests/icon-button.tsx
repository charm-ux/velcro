// Type-level check of <sl-icon-button>'s Shoelace 2.20.1 property types (`name`, `library`, `src`, `href`, `download` and
// `label` strings, `target` with its four values and `disabled`), its methods, that `dir` accepts any string as Shoelace
// declares it (`dir: string`), that `button` keeps Shoelace's `HTMLButtonElement | HTMLLinkElement` type, and that the React wrapper
// takes the same props and the `onSlFocus` and `onSlBlur` handlers.
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

// Upstream quirk, kept on purpose: Shoelace 2.20.1 types `button` as `HTMLButtonElement | HTMLLinkElement` (the `<link>` element's
// type), although a link renders an `<a>`. The union must stay exactly that, so it is pinned both ways: equal to Shoelace's union,
// and not assignable to the union a correct type would give.
type Exactly<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
const buttonTypeIsShoelaces: Exactly<typeof element.button, HTMLButtonElement | HTMLLinkElement> = true;
void buttonTypeIsShoelaces;
// @ts-expect-error not corrected to the anchor type; the quirk is preserved
const corrected: HTMLButtonElement | HTMLAnchorElement = element.button;
void corrected;

const ref = createRef<VelcroIconButtonElement>();
const props: VelcroIconButtonProps = { name: 'gear', label: 'Settings', href: 'https://example.com', target: '_self', disabled: false };
createElement(VelcroIconButton, { ...props, ref, onSlFocus: event => void event.target.label, onSlBlur: event => void event.target.label });
// @ts-expect-error target is '_blank', '_parent', '_self' or '_top'
createElement(VelcroIconButton, { target: 'blank' });
