import { defineVelcroComponent } from '../../utilities/registration.js';
import { VelcroVisuallyHidden } from './class.js';

export * from './class.js';

// Registers the exported class itself as <sl-visually-hidden> through the native registry. Core's shared prefix and scope are not touched.
defineVelcroComponent(VelcroVisuallyHidden);
