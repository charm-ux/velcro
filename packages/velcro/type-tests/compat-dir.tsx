// Regression checks for components whose direction setters retain the narrower existing union.
// Compiled, never run, with the other consumer declaration checks.
import type { VelcroPopup } from '../dist/components/popup/popup.js';
import type { VelcroSwitch } from '../dist/components/switch/switch.js';

declare const popup: VelcroPopup;
declare const control: VelcroSwitch;

popup.dir = 'rtl';
control.dir = 'auto';

// @ts-expect-error popup does not accept an arbitrary direction string
popup.dir = 'sideways';
// @ts-expect-error switch does not accept an arbitrary direction string
control.dir = 'sideways';
