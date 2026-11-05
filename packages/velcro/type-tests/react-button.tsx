// Type-level check of the generated React wrapper for <sl-button> against Shoelace 2.20.1's SlButton React API.
// Compiled (never run) by `tsc -p tsconfig.react.json` as the last step of the library build.
import { createElement, createRef } from 'react';
import { VelcroButton, type VelcroButtonElement, type VelcroButtonProps } from '../dist/react/index.js';

const ref = createRef<VelcroButtonElement>();
const onSlFocus = (event: { target: VelcroButtonElement }) => event.target.focus();

// Every Shoelace attribute/property Velcro implements, with Shoelace's value types, and the sl-blur/sl-focus events.
const shoelaceProps: VelcroButtonProps = {
  variant: 'primary',
  size: 'large',
  caret: true,
  disabled: false,
  loading: true,
  outline: true,
  pill: true,
  circle: false,
  type: 'submit',
  name: 'action',
  value: 'save',
  href: 'https://example.com/',
  target: '_blank',
  download: 'file.txt',
  title: 'Save',
  onSlBlur: event => event.target.blur(),
  onSlFocus,
  onClick: () => undefined,
  children: 'Save',
};
createElement(VelcroButton, { ...shoelaceProps, ref });

// Values outside Shoelace's unions are rejected.
// @ts-expect-error -- not a Shoelace button variant
const badVariant: VelcroButtonProps = { variant: 'brand' };
// @ts-expect-error -- not a Shoelace button size
const badSize: VelcroButtonProps = { size: 'huge' };

// Shoelace API that Velcro does not implement yet (see docs/api-parity.md); remove each line when it is implemented.
// @ts-expect-error -- sl-invalid is not implemented
const noInvalid: VelcroButtonProps = { onSlInvalid: () => undefined };
// @ts-expect-error -- rel is not implemented
const noRel: VelcroButtonProps = { rel: 'noopener' };
// @ts-expect-error -- form attributes are not implemented
const noForm: VelcroButtonProps = { form: 'checkout' };

export { badSize, badVariant, noForm, noInvalid, noRel };
