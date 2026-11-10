// Type-level check of <sl-carousel>'s `sl-slide-change` event as Shoelace 2.20.1 types it: the exported `SlSlideChangeEvent`
// (`CustomEvent<{ index: number; slide: SlCarouselItem }>`), the `GlobalEventHandlersEventMap` entry that types
// `addEventListener('sl-slide-change', ...)` on any element, and the generated React wrapper's `onSlSlideChange`.
// Compiled (never run) by `tsc -p tsconfig.react.json` as the last step of the library build.
import { createElement } from 'react';
import type { SlSlideChangeEvent as FromRoot } from '../dist/index.js';
import type { SlSlideChangeEvent, VelcroCarousel as VelcroCarouselClass } from '../dist/components/carousel/class.js';
import type { VelcroCarouselItem } from '../dist/components/carousel-item/carousel-item.js';
import { VelcroCarousel, type VelcroCarouselProps } from '../dist/react/index.js';

declare const carousel: VelcroCarouselClass;
declare const fromRoot: FromRoot;

// The type is exported from the carousel entry and from the package root, and is the same type.
const same: SlSlideChangeEvent = fromRoot;
void same;

// A native listener on the carousel, on any other element and on the document infers the detail.
carousel.addEventListener('sl-slide-change', event => {
  const index: number = event.detail.index;
  const slide: VelcroCarouselItem = event.detail.slide;
  const typed: SlSlideChangeEvent = event;
  void [index, slide, typed];
  // @ts-expect-error the index is a number, not a string
  const wrong: string = event.detail.index;
  void wrong;
});
document.addEventListener('sl-slide-change', event => void event.detail.slide.localName);
document.body.addEventListener('sl-slide-change', (event: SlSlideChangeEvent) => void event.detail.index);

// The generated React wrapper types the same detail.
const props: VelcroCarouselProps = {
  onSlSlideChange: event => {
    const slide: VelcroCarouselItem = event.detail.slide;
    void slide;
    // @ts-expect-error the index is a number, not a string
    const wrong: string = event.detail.index;
    void wrong;
  },
};
createElement(VelcroCarousel, props);
