import { defineVelcroComponent } from '../../utilities/registration.js';
import { VelcroResizeObserver } from './class.js';

export * from './class.js';

// Registers the exported class itself as <sl-resize-observer> through the native registry. Core's shared prefix and scope are not touched.
defineVelcroComponent(VelcroResizeObserver);
