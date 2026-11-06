import { defineVelcroComponent } from '../../utilities/registration.js';
import { VelcroTabPanel } from './class.js';

export * from './class.js';

// Registers the exported class itself as <sl-tab-panel> through the native registry. Core's shared prefix and scope are not touched.
defineVelcroComponent(VelcroTabPanel);
