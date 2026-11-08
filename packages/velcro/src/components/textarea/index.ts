import { defineVelcroComponent } from '../../utilities/registration.js';
import { VelcroTextarea } from './class.js';

export * from './class.js';

// Registers the exported class itself as <sl-textarea> through the native registry. Core's shared prefix and scope are not
// touched. The tag follows Shoelace's name (core's text area is called `text-area`) through the class's `baseName`.
// Idempotent; fails loudly if a different constructor owns the tag.
defineVelcroComponent(VelcroTextarea);
