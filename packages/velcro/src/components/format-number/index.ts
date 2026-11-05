import { defineVelcroComponent } from '../../utilities/registration.js';
import { VelcroFormatNumber } from './class.js';

export * from './class.js';

// Registers the exported class itself as <sl-format-number> through the native registry. Core's shared prefix and scope are not touched.
defineVelcroComponent(VelcroFormatNumber);
