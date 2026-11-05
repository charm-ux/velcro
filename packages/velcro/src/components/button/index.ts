import { defineVelcroComponent } from '../../utilities/registration.js';
import { VelcroSpinner } from '../spinner/class.js';
import { VelcroButton } from './class.js';

export * from './class.js';

// Registers the exported class itself as <sl-button> through the native registry. Core's shared prefix and scope are not touched.
// The loading state renders an <sl-spinner>, so Velcro's spinner is registered too (Shoelace's button lists it as a
// dependency in the same way). Both calls are idempotent and fail loudly if a different constructor owns the tag.
defineVelcroComponent(VelcroButton);
defineVelcroComponent(VelcroSpinner);
