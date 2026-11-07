import { defineVelcroComponent } from '../../utilities/registration.js';
import { VelcroAnimation } from './class.js';

export * from './class.js';

// Registers the exported class itself as <sl-animation> through the native registry. Core's shared prefix and scope are not touched.
defineVelcroComponent(VelcroAnimation);
