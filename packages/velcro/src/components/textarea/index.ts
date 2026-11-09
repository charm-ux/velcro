import { defineVelcroComponent } from '../../utilities/registration.js';
import { VelcroTextarea } from './class.js';

export * from './class.js';

// Registers the exported class itself as <sl-textarea> through the native registry. Core's shared prefix and scope are
// not touched. The tag follows Shoelace's name (core's text area is called `text-area`) through the class's `baseName`.
// The tag is registered as Shoelace's `define` registers it: if it is already defined it is left alone (with Shoelace's
// console warning when the versions differ), and if the platform refuses the class itself, an anonymous subclass is
// defined instead.
defineVelcroComponent(VelcroTextarea);
