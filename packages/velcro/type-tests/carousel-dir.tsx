// Type-level check that <sl-carousel>'s and <sl-carousel-item>'s `dir` accept any string, as Shoelace 2.20.1 declares it
// (`dir: string`), and that the carousel's methods and properties have Shoelace's types.
// Compiled (never run) by `tsc -p tsconfig.react.json` as the last step of the library build.
import type { VelcroCarousel } from '../dist/components/carousel/carousel.js';
import type { VelcroCarouselItem } from '../dist/components/carousel-item/carousel-item.js';

declare const carousel: VelcroCarousel;
declare const item: VelcroCarouselItem;
declare const direction: string;

// A direction from configuration or another element is a plain string.
carousel.dir = direction;
item.dir = direction;
carousel.dir = 'rtl';
const read: string = carousel.dir;
void read;

// @ts-expect-error a number is not a direction
carousel.dir = 1;
// @ts-expect-error a number is not a direction
item.dir = 1;

// Shoelace's methods take an optional scroll behavior; the active slide is a number.
carousel.next();
carousel.previous('auto');
carousel.goToSlide(2, 'instant');
const active: number = carousel.activeSlide;
void active;
// @ts-expect-error a slide is addressed by index
carousel.goToSlide('2');
// @ts-expect-error the orientation is horizontal or vertical
carousel.orientation = 'diagonal';
