// Type-level check of <sl-rating>'s Shoelace 2.20.1 property types (`value`, `max`, `precision`, `readonly`, `disabled`,
// `label` and `getSymbol`), that `dir` accepts any string as Shoelace declares it (`dir: string`), that `sl-hover` gives
// its typed `phase` and `value`, and that the React wrapper takes the same props and handlers.
// Compiled (never run) by `tsc -p tsconfig.react.json` as the last step of the library build.
import { createElement, createRef } from 'react';
import type { VelcroRating as VelcroRatingClass } from '../dist/components/rating/rating.js';
import { VelcroRating, type VelcroRatingElement, type VelcroRatingProps } from '../dist/react/index.js';

declare const rating: VelcroRatingClass;
declare const direction: string;

// A direction from configuration or another element is a plain string.
rating.dir = direction;
rating.dir = 'rtl';
const read: string = rating.dir;
void read;

// @ts-expect-error a number is not a direction
rating.dir = 1;

rating.value = 2.5;
rating.max = 10;
rating.precision = 0.5;
rating.readonly = true;
rating.disabled = false;
rating.label = 'Rating';
rating.getSymbol = value => `<sl-icon name="${value > 2 ? 'star-fill' : 'star'}"></sl-icon>`;
const base: HTMLElement = rating.rating;
void base;
rating.focus({ preventScroll: true });
rating.blur();
// @ts-expect-error the value is a number
rating.value = '3';
// @ts-expect-error getSymbol returns a string of trusted HTML
rating.getSymbol = () => 1;

const ref = createRef<VelcroRatingElement>();
const props: VelcroRatingProps = {
  label: 'Rating',
  value: 3,
  max: 5,
  precision: 0.5,
  readonly: false,
  disabled: false,
  getSymbol: () => '<sl-icon name="heart-fill"></sl-icon>',
  onSlChange: event => void event.target.value,
  onSlHover: event => {
    const phase: 'start' | 'move' | 'end' = event.detail.phase;
    const value: number = event.detail.value;
    void [phase, value];
  },
};
createElement(VelcroRating, { ...props, ref });
