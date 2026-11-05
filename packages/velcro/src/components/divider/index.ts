import { defineVelcroComponent } from '../../utilities/registration.js';
import VelcroDivider from './divider.js';

export * from './divider.js';

// Registers the exported class itself as <sl-divider> through the native registry. Core's shared prefix and scope are not touched.
defineVelcroComponent(VelcroDivider);
