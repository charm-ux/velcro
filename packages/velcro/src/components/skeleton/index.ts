import { defineVelcroComponent } from '../../utilities/registration.js';
import { VelcroSkeleton } from './class.js';

export * from './class.js';

// Registers the exported class itself as <sl-skeleton> through the native registry. Core's shared prefix and scope are not touched.
defineVelcroComponent(VelcroSkeleton);
