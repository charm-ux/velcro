import { defineVelcroComponent } from '../../utilities/registration.js';
import { VelcroSwitch } from './class.js';

export * from './class.js';

// Registers the exported class itself as <sl-switch> through the native registry. Core's shared prefix and scope are
// not touched: the class resolves core's scope lookups through Velcro's local scope resolver. The tag is registered as
// Shoelace's `define` registers it: if it is already defined it is left alone (with Shoelace's console warning when the
// versions differ), and if the platform refuses the class itself, an anonymous subclass is defined instead.
defineVelcroComponent(VelcroSwitch);
