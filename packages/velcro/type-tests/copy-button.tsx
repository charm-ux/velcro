// Type-level check of <sl-copy-button>'s Shoelace 2.20.1 property types (`value`, `from`, `disabled`, the three labels,
// `feedbackDuration` as a number, `tooltipPlacement` with its four values and `hoist`), that `dir` accepts any string as Shoelace
// declares it (`dir: string`), and that the React wrapper takes the same props and the `onSlCopy` and `onSlError` handlers.
// Compiled (never run) by `tsc -p tsconfig.react.json` as the last step of the library build.
import { createElement, createRef } from 'react';
import type { VelcroCopyButton as VelcroCopyButtonClass } from '../dist/components/copy-button/copy-button.js';
import { VelcroCopyButton, type VelcroCopyButtonElement, type VelcroCopyButtonProps } from '../dist/react/index.js';

declare const element: VelcroCopyButtonClass;
declare const direction: string;

element.value = 'text';
element.from = 'my-input.value';
element.disabled = true;
element.copyLabel = 'Copy';
element.successLabel = 'Copied';
element.errorLabel = 'Error';
element.feedbackDuration = 250;
element.tooltipPlacement = 'left';
element.hoist = true;
const placement: 'top' | 'right' | 'bottom' | 'left' = element.tooltipPlacement;
const duration: number = element.feedbackDuration;
const status: 'rest' | 'success' | 'error' = element.status;
const copying: boolean = element.isCopying;
void [placement, duration, status, copying];

// @ts-expect-error tooltipPlacement is one of four values
element.tooltipPlacement = 'center';
// @ts-expect-error feedbackDuration is a number
element.feedbackDuration = '250';
// @ts-expect-error disabled is a boolean
element.disabled = 'yes';

element.dir = direction;
const read: string = element.dir;
void read;

const ref = createRef<VelcroCopyButtonElement>();
const props: VelcroCopyButtonProps = { value: 'text', from: 'source', disabled: false, copyLabel: 'Copy', feedbackDuration: 250, tooltipPlacement: 'bottom', hoist: true };
createElement(VelcroCopyButton, { ...props, ref, onSlCopy: event => void event.target.value, onSlError: event => void event.target.value });
// @ts-expect-error tooltipPlacement is one of four values
createElement(VelcroCopyButton, { tooltipPlacement: 'center' });
