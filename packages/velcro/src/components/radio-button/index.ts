import { defineVelcroComponent } from '../../utilities/registration.js';
import { VelcroRadioButton } from './class.js';

export * from './class.js';

// Registers the exported class itself as <sl-radio-button> through the native registry. Core's shared prefix and scope
// are not touched. The radio button renders no other element. The call is idempotent and fails loudly if a different
// constructor owns the tag.
defineVelcroComponent(VelcroRadioButton);
