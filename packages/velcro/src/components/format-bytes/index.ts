import { defineVelcroComponent } from '../../utilities/registration.js';
import { VelcroFormatBytes } from './class.js';

export * from './class.js';

// Registers the exported class itself as <sl-format-bytes> through the native registry. Core's shared prefix and scope are not touched.
defineVelcroComponent(VelcroFormatBytes);
