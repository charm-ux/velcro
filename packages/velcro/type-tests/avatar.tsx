// Type-level check of <sl-avatar>'s Shoelace 2.20.1 property types (`image`, `label`, `initials` and `loading`,
// and `shape` with its three values), that `dir` accepts any string as Shoelace declares it (`dir: string`), and that the
// React wrapper takes the same props and the `onSlError` handler.
// Compiled (never run) by `tsc -p tsconfig.react.json` as the last step of the library build.
import { createElement, createRef } from 'react';
import type { VelcroAvatar as VelcroAvatarClass } from '../dist/components/avatar/avatar.js';
import { VelcroAvatar, type VelcroAvatarElement, type VelcroAvatarProps } from '../dist/react/index.js';

declare const element: VelcroAvatarClass;
declare const direction: string;

element.image = 'avatar.png';
element.label = 'User avatar';
element.initials = 'SL';
element.loading = 'lazy';
element.shape = 'rounded';
const strings: string[] = [element.image, element.label, element.initials];
void strings;

// @ts-expect-error loading is 'eager' or 'lazy'
element.loading = 'auto';
// @ts-expect-error shape is 'circle', 'square' or 'rounded'
element.shape = 'oval';

element.dir = direction;
const read: string = element.dir;
void read;

const ref = createRef<VelcroAvatarElement>();
const props: VelcroAvatarProps = { image: 'avatar.png', label: 'User avatar', initials: 'SL', loading: 'eager', shape: 'square' };
createElement(VelcroAvatar, { ...props, ref, onSlError: event => void event.target.image });
// @ts-expect-error shape is 'circle', 'square' or 'rounded'
createElement(VelcroAvatar, { shape: 'oval' });
