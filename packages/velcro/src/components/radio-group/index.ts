import { defineVelcroComponent } from '../../utilities/registration.js';
import { VelcroButtonGroup } from '../button-group/class.js';
import { VelcroRadioGroup } from './class.js';

export * from './class.js';

// Registers the exported class itself as <sl-radio-group> through the native registry. Core's shared prefix and scope
// are not touched: the class resolves core's scope lookups through Velcro's local scope resolver. A group of radio
// buttons renders an <sl-button-group>, so Velcro's button group is registered too (Shoelace's radio group lists it as a
// dependency in the same way). The radios are registered by their own entries, as in Shoelace. Both calls are
// idempotent and fail loudly if a different constructor owns the tag.
defineVelcroComponent(VelcroRadioGroup);
defineVelcroComponent(VelcroButtonGroup);
