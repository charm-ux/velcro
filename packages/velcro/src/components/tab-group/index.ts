import { defineVelcroComponent } from '../../utilities/registration.js';
import { VelcroIcon } from '../icon/class.js';
import { VelcroIconButton } from '../icon-button/class.js';
import { VelcroResizeObserver } from '../resize-observer/class.js';
import { VelcroTabGroup } from './class.js';

export * from './class.js';

// Registers the exported class itself as <sl-tab-group> through the native registry. Core's shared prefix and scope are
// not touched. The scroll buttons are <sl-icon-button> elements, which draw an <sl-icon>, and the tabs are measured
// through an <sl-resize-observer>, so Velcro's icon button, icon and resize observer are registered too (Shoelace's tab
// group lists the icon button and resize observer as dependencies in the same way). As in Shoelace, <sl-tab> and
// <sl-tab-panel> are not registered here: import them from `./tab` and `./tab-panel` (or the package root). Every tag
// is registered as Shoelace's `define` registers it: a tag that is already defined is left alone (with Shoelace's
// console warning when the versions differ), and if the platform refuses the class itself, an anonymous subclass is
// defined instead.
defineVelcroComponent(VelcroTabGroup);
defineVelcroComponent(VelcroIconButton);
defineVelcroComponent(VelcroIcon);
defineVelcroComponent(VelcroResizeObserver);
