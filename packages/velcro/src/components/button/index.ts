import { defineVelcroComponent } from '../../utilities/registration.js';
import { VelcroSpinner } from '../spinner/class.js';
import { VelcroButton } from './class.js';

export * from './class.js';

// Registers the exported class itself as <sl-button> through the native registry. Core's shared prefix and scope are
// not touched. The loading state renders an <sl-spinner>, so Velcro's spinner is registered too (Shoelace's button
// lists it as a dependency in the same way). Every tag is registered as Shoelace's `define` registers it: a tag that is
// already defined is left alone (with Shoelace's console warning when the versions differ), and if the platform refuses
// the class itself, an anonymous subclass is defined instead.
defineVelcroComponent(VelcroButton);
defineVelcroComponent(VelcroSpinner);
