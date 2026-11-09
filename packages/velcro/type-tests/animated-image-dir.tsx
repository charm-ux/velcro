// Type-level check of <sl-animated-image>'s Shoelace 2.20.1 property types (`src`, `alt` and `play`, with the public
// `animatedImage`, `frozenFrame` and `isLoaded` fields and the two watch handlers), that `dir` accepts any string as
// Shoelace declares it (`dir: string`), and that the React wrapper takes the same props and the `onSlLoad` and `onSlError`
// handlers.
// Compiled (never run) by `tsc -p tsconfig.react.json` as the last step of the library build.
import { createElement, createRef } from 'react';
import type { VelcroAnimatedImage as VelcroAnimatedImageClass } from '../dist/components/animated-image/animated-image.js';
import { VelcroAnimatedImage, type VelcroAnimatedImageElement, type VelcroAnimatedImageProps } from '../dist/react/index.js';

declare const image: VelcroAnimatedImageClass;
declare const direction: string;

// A direction from configuration or another element is a plain string.
image.dir = direction;
image.dir = 'rtl';
const read: string = image.dir;
void read;

// @ts-expect-error a number is not a direction
image.dir = 1;

image.src = 'animation.gif';
image.alt = 'A moving block';
image.play = true;
const frame: string = image.frozenFrame;
const loaded: boolean = image.isLoaded;
const animated: HTMLImageElement = image.animatedImage;
void [frame, loaded, animated];
image.handlePlayChange();
image.handleSrcChange();
// @ts-expect-error play is a boolean
image.play = 'yes';
// @ts-expect-error the source is a string
image.src = 1;

const ref = createRef<VelcroAnimatedImageElement>();
const props: VelcroAnimatedImageProps = {
  src: 'animation.gif',
  alt: 'A moving block',
  play: true,
  onSlLoad: event => void event.type,
  onSlError: event => void event.type,
};
createElement(VelcroAnimatedImage, { ...props, ref });
