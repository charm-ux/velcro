import { defineVelcroComponent } from '../../utilities/registration.js';
import { VelcroProgressRing } from './class.js';

export * from './class.js';

// Registers the exported class itself as <sl-progress-ring> through the native registry. Core's shared prefix and scope are not touched.
defineVelcroComponent(VelcroProgressRing);
