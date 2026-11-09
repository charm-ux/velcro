// Type-level check of <sl-range>'s Shoelace 2.20.1 property types (`value`, `min`, `max`, `step`, `name`, `label`,
// `helpText`, `disabled`, `tooltip`, `tooltipFormatter` and `form`), that `dir` accepts any string as Shoelace declares it
// (`dir: string`), that the validation members have the types of the native control they delegate to, and that the React wrapper takes
// the same props and handlers. Compiled (never run) by `tsc -p tsconfig.react.json` as the last step of the library build.
import { createElement, createRef } from 'react';
import type { VelcroRange as VelcroRangeClass } from '../dist/components/range/range.js';
import { VelcroRange, type VelcroRangeElement, type VelcroRangeProps } from '../dist/react/index.js';

declare const range: VelcroRangeClass;
declare const direction: string;

// A direction from configuration or another element is a plain string.
range.dir = direction;
range.dir = 'rtl';
const read: string = range.dir;
void read;

// @ts-expect-error a number is not a direction
range.dir = 1;

range.value = 25;
range.min = -10;
range.max = 10;
range.step = 0.5;
range.name = 'volume';
range.label = 'Volume';
range.helpText = 'Controls the volume.';
range.disabled = true;
range.tooltip = 'bottom';
range.tooltipFormatter = value => `${value}%`;
range.form = 'settings';
range.defaultValue = 5;
const input: HTMLInputElement = range.input;
const output: HTMLOutputElement | null = range.output;
void [input, output];
range.focus({ preventScroll: true });
range.blur();
range.stepUp();
range.stepDown();
const valid: boolean = range.checkValidity() && range.reportValidity();
const state: ValidityState = range.validity;
const message: string = range.validationMessage;
const form: HTMLFormElement | null = range.getForm();
void [valid, state, message, form];
// @ts-expect-error the value is a number
range.value = '3';
// @ts-expect-error the tooltip is top, bottom or none
range.tooltip = 'left';
// @ts-expect-error the formatter returns a string
range.tooltipFormatter = () => 1;

const ref = createRef<VelcroRangeElement>();
const props: VelcroRangeProps = {
  label: 'Volume',
  helpText: 'Controls the volume.',
  value: 3,
  min: 0,
  max: 10,
  step: 1,
  disabled: false,
  tooltip: 'none',
  tooltipFormatter: value => `Total - ${value}%`,
  onSlChange: event => void event.target.value,
  onSlInput: event => void event.target.value,
};
createElement(VelcroRange, { ...props, ref });
