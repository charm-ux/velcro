import { defineVelcroComponent } from '../../utilities/registration.js';
import { VelcroRelativeTime } from './class.js';

export * from './class.js';

// Registers the exported class itself as <sl-relative-time> through the native registry. Core's shared prefix and scope are not touched.
defineVelcroComponent(VelcroRelativeTime);
