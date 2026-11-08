import { defineVelcroComponent } from '../../utilities/registration.js';
import { VelcroIcon } from '../icon/class.js';
import { VelcroDetails } from './class.js';

export * from './class.js';

// Registers the exported class itself as <sl-details> through the native registry. Core's shared prefix and scope are not
// touched. The default expand and collapse icons are <sl-icon> elements, so Velcro's icon is registered too (Shoelace's
// details lists it as a dependency in the same way). Both calls are idempotent and fail loudly if a different constructor
// owns the tag.
defineVelcroComponent(VelcroDetails);
defineVelcroComponent(VelcroIcon);
