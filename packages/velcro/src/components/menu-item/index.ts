import { defineVelcroComponent } from '../../utilities/registration.js';
import { VelcroIcon } from '../icon/class.js';
import { VelcroPopup } from '../popup/class.js';
import { VelcroSpinner } from '../spinner/class.js';
import { VelcroMenuItem } from './class.js';

export * from './class.js';

// Registers the exported class itself as <sl-menu-item> through the native registry. Core's shared prefix and scope are
// not touched. The item renders an <sl-icon> (the check mark and the submenu chevron), an <sl-popup> (a submenu) and an
// <sl-spinner> (the loading state), so Velcro's icon, popup and spinner are registered too (Shoelace's menu item lists
// them as dependencies in the same way). Every tag is registered as Shoelace's `define` registers it: a tag that is
// already defined is left alone (with Shoelace's console warning when the versions differ), and if the platform refuses
// the class itself, an anonymous subclass is defined instead. As in Shoelace, <sl-menu> is not registered here: import it
// from `./menu` (or the package root).
defineVelcroComponent(VelcroMenuItem);
defineVelcroComponent(VelcroIcon);
defineVelcroComponent(VelcroPopup);
defineVelcroComponent(VelcroSpinner);
