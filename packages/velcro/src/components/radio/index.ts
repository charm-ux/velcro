import { defineVelcroComponent } from '../../utilities/registration.js';
import { VelcroIcon } from '../icon/class.js';
import { VelcroRadio } from './class.js';

export * from './class.js';

// Registers the exported class itself as <sl-radio> through the native registry. Core's shared prefix and scope are not
// touched: the class resolves core's scope lookups through Velcro's local scope resolver. A checked radio renders an
// <sl-icon>, so Velcro's icon is registered too (Shoelace's radio lists it as a dependency in the same way). Both calls
// are idempotent and fail loudly if a different constructor owns the tag.
defineVelcroComponent(VelcroRadio);
defineVelcroComponent(VelcroIcon);
