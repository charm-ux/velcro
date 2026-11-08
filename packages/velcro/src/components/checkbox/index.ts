import { defineVelcroComponent } from '../../utilities/registration.js';
import { VelcroIcon } from '../icon/class.js';
import { VelcroCheckbox } from './class.js';

export * from './class.js';

// Registers the exported class itself as <sl-checkbox> through the native registry. Core's shared prefix and scope are
// not touched. The checked and indeterminate icons are <sl-icon> elements, so Velcro's icon is registered too
// (Shoelace's checkbox lists it as a dependency in the same way). Every tag is registered as Shoelace's `define`
// registers it: a tag that is already defined is left alone (with Shoelace's console warning when the versions differ),
// and if the platform refuses the class itself, an anonymous subclass is defined instead.
defineVelcroComponent(VelcroCheckbox);
defineVelcroComponent(VelcroIcon);
