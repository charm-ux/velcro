import { defineVelcroComponent } from '../../utilities/registration.js';
import { VelcroMenuLabel } from './class.js';

export * from './class.js';

// Registers the exported class itself as <sl-menu-label> through the native registry. Core's shared prefix and scope are not touched.
defineVelcroComponent(VelcroMenuLabel);
