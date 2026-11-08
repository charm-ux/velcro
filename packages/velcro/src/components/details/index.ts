import { defineVelcroComponent } from '../../utilities/registration.js';
import { VelcroIcon } from '../icon/class.js';
import { VelcroDetails } from './class.js';

export * from './class.js';

// Registers the exported class itself as <sl-details> through the native registry. Core's shared prefix and scope are not
// touched. The default expand and collapse icons are <sl-icon> elements, so Velcro's icon is registered too. Both calls are
// idempotent and fail loudly if a different constructor owns the tag. Unlike the constructor's dependency definition (which
// leaves another owner of sl-icon in place, as Shoelace's does), this registration of sl-icon is strict, as in the other
// registering entries; making them all follow Shoelace's dependency handling is a shared change.
defineVelcroComponent(VelcroDetails);
defineVelcroComponent(VelcroIcon);
