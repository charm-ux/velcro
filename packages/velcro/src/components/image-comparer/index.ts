import { defineVelcroComponent } from '../../utilities/registration.js';
import { VelcroIcon } from '../icon/class.js';
import { VelcroImageComparer } from './class.js';

export * from './class.js';

// Registers the exported class itself as <sl-image-comparer> through the native registry. Core's shared prefix and scope
// are not touched. The default handle icon is an <sl-icon>, so Velcro's icon is registered too (Shoelace's manifest lists
// it as the image comparer's dependency). Every tag is registered as Shoelace's `define` registers it: a tag that is
// already defined is left alone (with Shoelace's console warning when the versions differ), and if the platform refuses
// the class itself, an anonymous subclass is defined instead.
defineVelcroComponent(VelcroImageComparer);
defineVelcroComponent(VelcroIcon);
