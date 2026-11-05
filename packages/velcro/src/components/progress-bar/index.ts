import { defineVelcroComponent } from '../../utilities/registration.js';
import { VelcroProgressBar } from './class.js';

export * from './class.js';

// Registers the exported class itself as <sl-progress-bar> through the native registry. Core's shared prefix and scope are not touched.
defineVelcroComponent(VelcroProgressBar);
