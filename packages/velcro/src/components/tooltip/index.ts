import { defineVelcroComponent } from '../../utilities/registration.js';
import { VelcroPopup } from '../popup/class.js';
import { VelcroTooltip } from './class.js';

export * from './class.js';

// Registers the exported class itself as <sl-tooltip> through the native registry. Core's shared prefix and scope are
// not touched. The tooltip renders an <sl-popup>, so Velcro's popup is registered too (Shoelace's tooltip lists it as a
// dependency in the same way). Every tag is registered as Shoelace's `define` registers it: a tag that is already
// defined is left alone (with Shoelace's console warning when the versions differ), and if the platform refuses the
// class itself, an anonymous subclass is defined instead.
defineVelcroComponent(VelcroTooltip);
defineVelcroComponent(VelcroPopup);
