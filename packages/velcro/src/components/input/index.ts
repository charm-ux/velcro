import { defineVelcroComponent } from '../../utilities/registration.js';
import { VelcroIcon } from '../icon/class.js';
import { VelcroInput } from './class.js';

export * from './class.js';

// Registers the exported class itself as <sl-input> through the native registry. Core's shared prefix and scope are not
// touched. The clear and password toggle buttons render an <sl-icon>, so Velcro's icon is registered too (Shoelace's input
// lists it as a dependency in the same way). Both calls are idempotent and fail loudly if a different constructor owns the tag.
defineVelcroComponent(VelcroInput);
defineVelcroComponent(VelcroIcon);
