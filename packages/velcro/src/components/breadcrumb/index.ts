import { defineVelcroComponent } from '../../utilities/registration.js';
import { VelcroIcon } from '../icon/class.js';
import { VelcroBreadcrumb } from './class.js';

export * from './class.js';

// Registers the exported class itself as <sl-breadcrumb> through the native registry. Core's shared prefix and scope are
// not touched. The default separator is an <sl-icon>, so Velcro's icon is registered too (Shoelace's breadcrumb lists it
// as a dependency in the same way). As in Shoelace, <sl-breadcrumb-item> is not registered here: import it from
// `./breadcrumb-item` (or the package root). Every tag is registered as Shoelace's `define` registers it: a tag that is
// already defined is left alone (with Shoelace's console warning when the versions differ), and if the platform refuses
// the class itself, an anonymous subclass is defined instead.
defineVelcroComponent(VelcroBreadcrumb);
defineVelcroComponent(VelcroIcon);
