import { defineVelcroComponent } from '../../utilities/registration.js';
import VelcroBadge from './badge.js';

export * from './badge.js';

// Registers the exported class itself as <sl-badge> through the native registry. Core's shared prefix and scope are not touched.
defineVelcroComponent(VelcroBadge);
