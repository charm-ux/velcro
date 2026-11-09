import { defineVelcroComponent } from '../../utilities/registration.js';
import { VelcroIcon } from '../icon/class.js';
import { VelcroIconButton } from '../icon-button/class.js';
import { VelcroTab } from './class.js';

export * from './class.js';

// Registers the exported class itself as <sl-tab> through the native registry. Core's shared prefix and scope are not
// touched. The close button is an <sl-icon-button>, which draws an <sl-icon>, so Velcro's icon button and icon are
// registered too (Shoelace's tab lists the icon button as a dependency in the same way, and the icon button its icon).
// Every tag is registered as Shoelace's `define` registers it: a tag that is already defined is left alone (with
// Shoelace's console warning when the versions differ), and if the platform refuses the class itself, an anonymous
// subclass is defined instead.
defineVelcroComponent(VelcroTab);
defineVelcroComponent(VelcroIconButton);
defineVelcroComponent(VelcroIcon);
