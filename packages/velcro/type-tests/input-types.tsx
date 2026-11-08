// Type-level checks that <sl-input> keeps Shoelace 2.20.1's real types for `min` and `max` (number | string) and `step`
// (number | 'any'), where the core input declares `number` for all three (see src/components/input/core-typing.ts), and
// for `type`, on the element class and the generated React props; and pins the one property that cannot:
// `autocorrect` reads as `any` (lib.dom's HTMLElement declares it `boolean`, so an `'off' | 'on'` property would make
// the class stop being an HTMLElement) but accepts only Shoelace's `'off' | 'on'` when assigned. Compiled (never run) by
// `tsc -p tsconfig.react.json` as the last step of the library build.
import type { VelcroInput } from '../dist/components/input/input.js';
import type { VelcroInputProps } from '../dist/react/VelcroInput.js';

type IsAny<T> = 0 extends 1 & T ? true : false;
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Bound = number | string;
type Step = number | 'any';
type InputType = 'date' | 'datetime-local' | 'email' | 'number' | 'password' | 'search' | 'tel' | 'text' | 'time' | 'url';

// The element class: not `any`, and exactly Shoelace's types.
const classNotAny: [false, false, false, false] = [
  false as IsAny<VelcroInput['min']>,
  false as IsAny<VelcroInput['max']>,
  false as IsAny<VelcroInput['step']>,
  false as IsAny<VelcroInput['type']>,
];
const classExact: [true, true, true, true] = [
  true as Equal<VelcroInput['min'], Bound>,
  true as Equal<VelcroInput['max'], Bound>,
  true as Equal<VelcroInput['step'], Step>,
  true as Equal<VelcroInput['type'], InputType>,
];
void classNotAny;
void classExact;

declare const element: VelcroInput;
element.min = 1;
element.min = '2026-01-01';
element.max = 10;
element.max = '2026-12-31';
element.step = 5;
element.step = 'any';
element.type = 'email';
element.autocorrect = 'on';
element.autocorrect = 'off';
const min: Bound = element.min;
const step: Step = element.step;
void min;
void step;

// Wrong values are compile errors, as they are with Shoelace's declarations.
// @ts-expect-error not a number or a string
element.min = true;
// @ts-expect-error not a number or a string
element.max = { not: 'a bound' };
// @ts-expect-error only a number or 'any'
element.step = 'large';
// @ts-expect-error 'range' is a core type, not a Shoelace one
element.type = 'range';
// @ts-expect-error not an input type
element.type = 'checkbox';
// @ts-expect-error not 'off' | 'on'
element.autocorrect = 'maybe';
// @ts-expect-error not 'off' | 'on' (lib.dom's HTMLElement says boolean, Shoelace says 'off' | 'on')
element.autocorrect = true;

// The known limit, pinned: `autocorrect` reads as `any`. If this stops being `any`, update the docs page and the changeset.
const autocorrectReadsAsAny: true = true as IsAny<VelcroInput['autocorrect']>;
void autocorrectReadsAsAny;

// The generated React props follow the element's property types.
const propsNotAny: [false, false, false] = [
  false as IsAny<VelcroInputProps['min']>,
  false as IsAny<VelcroInputProps['max']>,
  false as IsAny<VelcroInputProps['step']>,
];
const propsExact: [true, true, true, true] = [
  true as Equal<VelcroInputProps['min'], Bound | undefined>,
  true as Equal<VelcroInputProps['max'], Bound | undefined>,
  true as Equal<VelcroInputProps['step'], Step | undefined>,
  true as Equal<VelcroInputProps['type'], InputType | undefined>,
];
void propsNotAny;
void propsExact;

// `autocorrect` follows the element's read type, so the React prop accepts any value.
const autocorrectPropIsAny: true = true as IsAny<VelcroInputProps['autocorrect']>;
void autocorrectPropIsAny;

const goodProps: VelcroInputProps = { min: '1', max: 3, step: 'any', type: 'number', autocorrect: 'off' };
void goodProps;
// @ts-expect-error not a number or 'any'
const badStep: VelcroInputProps = { step: 'large' };
// @ts-expect-error not a Shoelace input type
const badType: VelcroInputProps = { type: 'range' };
void badStep;
void badType;

// The class is still an HTMLElement for TypeScript (the generated JSX types require it).
const asHtmlElement: HTMLElement = element;
void asHtmlElement;
