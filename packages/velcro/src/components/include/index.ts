import { defineVelcroComponent } from '../../utilities/registration.js';
import { VelcroInclude } from './class.js';

export * from './class.js';

// Registers the exported class itself as <sl-include> through the native registry. Core's shared prefix and scope are not touched.
defineVelcroComponent(VelcroInclude);
