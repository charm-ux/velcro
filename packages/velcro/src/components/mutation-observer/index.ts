import { defineVelcroComponent } from '../../utilities/registration.js';
import { VelcroMutationObserver } from './class.js';

export * from './class.js';

// Registers the exported class itself as <sl-mutation-observer> through the native registry. Core's shared prefix and scope are not touched.
defineVelcroComponent(VelcroMutationObserver);
