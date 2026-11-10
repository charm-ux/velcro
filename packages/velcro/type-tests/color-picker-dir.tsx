// Type-level check of <sl-color-picker>'s Shoelace 2.20.1 property types (`value`, `format`, `size`, `swatches`, the
// boolean options and the form members), its public methods, that `dir` accepts any string as Shoelace declares it
// (`dir: string`), and that the React wrapper takes the same props and handlers.
// Compiled (never run) by `tsc -p tsconfig.react.json` as the last step of the library build.
import { createElement, createRef } from 'react';
import type { VelcroColorPicker as VelcroColorPickerClass } from '../dist/components/color-picker/color-picker.js';
import { VelcroColorPicker, type VelcroColorPickerElement, type VelcroColorPickerProps } from '../dist/react/index.js';

declare const picker: VelcroColorPickerClass;
declare const direction: string;

// A direction from configuration or another element is a plain string.
picker.dir = direction;
picker.dir = 'rtl';
const read: string = picker.dir;
void read;

// @ts-expect-error a number is not a direction
picker.dir = 1;

picker.value = '#4a90e2';
picker.defaultValue = '#000000';
picker.format = 'hsv';
picker.size = 'large';
picker.swatches = '#fff; #000';
picker.swatches = ['#fff', '#000'];
picker.inline = true;
picker.opacity = true;
picker.uppercase = true;
picker.noFormatToggle = true;
picker.hoist = true;
picker.disabled = false;
picker.required = true;
picker.name = 'color';
picker.form = 'form-id';
picker.label = 'Select a color';
const hexa: string = picker.getFormattedValue('hexa');
const valid: boolean = picker.checkValidity() && picker.reportValidity() && picker.validity.valid;
const form: HTMLFormElement | null = picker.getForm();
const message: string = picker.validationMessage;
void [hexa, valid, form, message];
picker.setCustomValidity('');
picker.focus({ preventScroll: true });
picker.blur();
// @ts-expect-error the format is hex, rgb, hsl or hsv
picker.format = 'cmyk';
// @ts-expect-error getFormattedValue takes a known format
picker.getFormattedValue('lab');

const ref = createRef<VelcroColorPickerElement>();
const props: VelcroColorPickerProps = {
  label: 'Select a color',
  value: '#4a90e2',
  format: 'rgb',
  size: 'small',
  swatches: ['#fff'],
  inline: false,
  opacity: true,
  onSlChange: event => void event.target.value,
  onSlInput: event => void event.target.value,
  onSlFocus: () => undefined,
  onSlBlur: () => undefined,
  onSlInvalid: () => undefined,
};
createElement(VelcroColorPicker, { ...props, ref });
