import { defineVelcroComponent } from '../../utilities/registration.js';
import { VelcroBreadcrumbItem } from './class.js';

export * from './class.js';

// Registers the exported class itself as <sl-breadcrumb-item> through the native registry. Core's shared prefix and scope
// are not touched. As in Shoelace, the item has no dependencies and <sl-breadcrumb> is not registered here: import it from
// `./breadcrumb` (or the package root). The tag is registered as Shoelace's `define` registers it: a tag that is already
// defined is left alone (with Shoelace's console warning when the versions differ), and if the platform refuses the class
// itself, an anonymous subclass is defined instead.
defineVelcroComponent(VelcroBreadcrumbItem);
