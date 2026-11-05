import { defineVelcroComponent } from '../../utilities/registration.js';
import { VelcroFormatDate } from './class.js';

export * from './class.js';

// Registers the exported class itself as <sl-format-date> through the native registry. Core's shared prefix and scope are not touched.
defineVelcroComponent(VelcroFormatDate);
