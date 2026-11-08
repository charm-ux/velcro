import { defineVelcroComponent } from '../../utilities/registration.js';
import { VelcroIcon } from '../icon/class.js';
import { VelcroCheckbox } from './class.js';

export * from './class.js';

// Registers the exported class itself as <sl-checkbox> through the native registry. Core's shared prefix and scope are
// not touched. The checked and indeterminate icons are <sl-icon> elements, so Velcro's icon is registered too (Shoelace's
// checkbox lists it as a dependency in the same way). Both calls are idempotent and fail loudly if a different
// constructor owns the tag.
defineVelcroComponent(VelcroCheckbox);
defineVelcroComponent(VelcroIcon);
