import { defineVelcroComponent } from '../../utilities/registration.js';
import { VelcroSwitch } from './class.js';

export * from './class.js';

// Registers the exported class itself as <sl-switch> through the native registry. Core's shared prefix and scope are not
// touched: the class resolves core's scope lookups through Velcro's local scope resolver. Idempotent; fails loudly if a
// different constructor owns the tag.
defineVelcroComponent(VelcroSwitch);
