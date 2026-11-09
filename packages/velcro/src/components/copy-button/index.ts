import { defineVelcroComponent } from '../../utilities/registration.js';
import { VelcroIcon } from '../icon/class.js';
import { VelcroPopup } from '../popup/class.js';
import { VelcroTooltip } from '../tooltip/class.js';
import { VelcroCopyButton } from './class.js';

export * from './class.js';

// Registers the exported class itself as <sl-copy-button> through the native registry. Core's shared prefix and scope are
// not touched. The template renders an <sl-tooltip> (which renders an <sl-popup>) and the default feedback icons are
// <sl-icon>, so Velcro's tooltip, popup and icon are registered too (Shoelace's copy button lists the icon and the tooltip
// as dependencies in the same way, and the tooltip its popup). Every tag is registered as Shoelace's `define` registers it:
// a tag that is already defined is left alone (with Shoelace's console warning when the versions differ), and if the
// platform refuses the class itself, an anonymous subclass is defined instead.
defineVelcroComponent(VelcroCopyButton);
defineVelcroComponent(VelcroIcon);
defineVelcroComponent(VelcroTooltip);
defineVelcroComponent(VelcroPopup);
