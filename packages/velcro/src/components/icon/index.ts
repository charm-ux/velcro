import { defineVelcroComponent } from '../../utilities/registration.js';
import { VelcroIcon } from './class.js';

export * from './class.js';

// Registers the exported class itself as <sl-icon> through the native registry. Core's shared prefix and scope are not touched.
defineVelcroComponent(VelcroIcon);
