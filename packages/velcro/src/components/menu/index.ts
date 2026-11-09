import { defineVelcroComponent } from '../../utilities/registration.js';
import { VelcroMenu } from './class.js';

export * from './class.js';

// Registers the exported class itself as <sl-menu> through the native registry. Core's shared prefix and scope are not touched.
// As in Shoelace, <sl-menu-item>, <sl-menu-label> and <sl-divider> are not registered here: a menu works with whatever
// elements are slotted into it (its items are the elements whose tag is <sl-menu-item> or whose role is a menu item role),
// so import `./menu-item` (or the package root) for the items. The tag is registered as Shoelace's `define` registers it:
// a tag that is already defined is left alone (with Shoelace's console warning when the versions differ), and if the
// platform refuses the class itself, an anonymous subclass is defined instead.
defineVelcroComponent(VelcroMenu);
