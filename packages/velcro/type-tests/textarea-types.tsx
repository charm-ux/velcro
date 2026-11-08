// Type-level checks that <sl-textarea> keeps Shoelace 2.20.1's real types for `resize` ('none' | 'vertical' | 'auto') and
// `autocomplete` (string), where the core text area declares incompatible ones (see src/components/textarea/core-typing.ts), on
// the element class and the generated React props; and pins the one property that cannot: `autocorrect` reads as `any`
// (lib.dom's HTMLElement declares it `boolean`, so a `string` property would make the class stop being an HTMLElement)
// but accepts only a string when assigned. Compiled (never run) by `tsc -p tsconfig.react.json` as the last step of the
// library build.
import type { VelcroTextarea } from '../dist/components/textarea/textarea.js';
import type { VelcroTextareaProps } from '../dist/react/VelcroTextarea.js';

type IsAny<T> = 0 extends 1 & T ? true : false;
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Resize = 'none' | 'vertical' | 'auto';

// The element class: not `any`, and exactly Shoelace's types.
const classNotAny: [false, false] = [
  false as IsAny<VelcroTextarea['resize']>,
  false as IsAny<VelcroTextarea['autocomplete']>,
];
const classExact: [true, true] = [
  true as Equal<VelcroTextarea['resize'], Resize>,
  true as Equal<VelcroTextarea['autocomplete'], string>,
];
void classNotAny;
void classExact;

declare const element: VelcroTextarea;
element.resize = 'auto';
element.resize = 'none';
element.autocomplete = 'off';
element.autocorrect = 'on';
const resize: Resize = element.resize;
const autocomplete: string = element.autocomplete;
void resize;
void autocomplete;

// Wrong values are compile errors, as they are with Shoelace's declarations.
// @ts-expect-error 'horizontal' is a core value, not a Shoelace one
element.resize = 'horizontal';
// @ts-expect-error 'both' is a core value, not a Shoelace one
element.resize = 'both';
// @ts-expect-error not a string
element.autocomplete = 123;
// @ts-expect-error not a string
element.autocorrect = { not: 'a string' };
// @ts-expect-error not a string (lib.dom's HTMLElement says boolean, Shoelace says string)
element.autocorrect = true;

// The known limit, pinned: `autocorrect` reads as `any`. If this stops being `any`, update the docs page and the changeset.
const autocorrectReadsAsAny: true = true as IsAny<VelcroTextarea['autocorrect']>;
void autocorrectReadsAsAny;

// The generated React props follow the element's property types: real types for resize and autocomplete.
const propsNotAny: [false, false] = [
  false as IsAny<VelcroTextareaProps['resize']>,
  false as IsAny<VelcroTextareaProps['autocomplete']>,
];
const propsExact: [true, true] = [
  true as Equal<VelcroTextareaProps['resize'], Resize | undefined>,
  true as Equal<VelcroTextareaProps['autocomplete'], string | undefined>,
];
void propsNotAny;
void propsExact;

const goodProps: VelcroTextareaProps = { resize: 'auto', autocomplete: 'off', autocorrect: 'off' };
void goodProps;
// @ts-expect-error not a Shoelace resize value
const badResize: VelcroTextareaProps = { resize: 'horizontal' };
// @ts-expect-error not a string
const badAutocomplete: VelcroTextareaProps = { autocomplete: 1 };
void badResize;
void badAutocomplete;

// The class is still an HTMLElement for TypeScript (the generated JSX types require it).
const asHtmlElement: HTMLElement = element;
void asHtmlElement;
