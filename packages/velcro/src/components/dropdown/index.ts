import { defineVelcroComponent } from '../../utilities/registration.js';
import { VelcroPopup } from '../popup/class.js';
import { VelcroDropdown } from './class.js';

export * from './class.js';

// Registers the exported class itself as <sl-dropdown> through the native registry. Core's shared prefix and scope are
// not touched. The dropdown renders an <sl-popup> around its trigger and panel, so Velcro's popup is registered too
// (Shoelace's dropdown lists it as a dependency in the same way). Every tag is registered as Shoelace's `define`
// registers it: a tag that is already defined is left alone (with Shoelace's console warning when the versions differ),
// and if the platform refuses the class itself, an anonymous subclass is defined instead. As in Shoelace, the trigger
// (<sl-button>) and the menu (<sl-menu>, <sl-menu-item>) are not registered here: import them from their own entries (or
// the package root).
defineVelcroComponent(VelcroDropdown);
defineVelcroComponent(VelcroPopup);
