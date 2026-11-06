import { defineVelcroComponent } from '../../utilities/registration.js';
import { VelcroPopup } from './class.js';

export * from './class.js';

// Registers the exported class itself as <sl-popup> through the native registry. Core's shared prefix and scope are not touched.
defineVelcroComponent(VelcroPopup);
