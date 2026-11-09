import { defineVelcroComponent } from '../../utilities/registration.js';
import { VelcroIcon } from '../icon/class.js';
import { VelcroIconButton } from '../icon-button/class.js';
import { VelcroPopup } from '../popup/class.js';
import { VelcroTag } from '../tag/class.js';
import { VelcroSelect } from './class.js';

export * from './class.js';

// Registers the exported class itself as <sl-select> through the native registry. Core's shared prefix and scope are not
// touched. The select renders an <sl-popup>, <sl-tag>s (whose remove button is an <sl-icon-button>) and <sl-icon>s, so
// Velcro's popup, tag, icon button and icon are registered too (Shoelace's select lists the icon, popup and tag as
// dependencies in the same way, and the tag its icon button). As in Shoelace, <sl-option> is not a dependency of the
// select; register it with `../option/index.js`. Every tag is registered as Shoelace's `define` registers it: a tag that
// is already defined is left alone (with Shoelace's console warning when the versions differ), and if the platform
// refuses the class itself, an anonymous subclass is defined instead.
defineVelcroComponent(VelcroSelect);
defineVelcroComponent(VelcroPopup);
defineVelcroComponent(VelcroTag);
defineVelcroComponent(VelcroIconButton);
defineVelcroComponent(VelcroIcon);
