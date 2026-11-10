import { defineVelcroComponent } from '../../utilities/registration.js';
import { VelcroButtonGroup } from '../button-group/class.js';
import { VelcroButton } from '../button/class.js';
import { VelcroDropdown } from '../dropdown/class.js';
import { VelcroIcon } from '../icon/class.js';
import { VelcroInput } from '../input/class.js';
import { VelcroPopup } from '../popup/class.js';
import { VelcroVisuallyHidden } from '../visually-hidden/class.js';
import { VelcroColorPicker } from './class.js';

export * from './class.js';

// Registers the exported class itself as <sl-color-picker> through the native registry. Core's shared prefix and scope
// are not touched. The color picker renders a dropdown (with its popup), an input, buttons in a button group, an icon and
// visually hidden text, so those Velcro elements are registered too (Shoelace's color picker lists them as dependencies
// in the same way). Every tag is registered as Shoelace's `define` registers it: a tag that is already defined is left
// alone (with Shoelace's console warning when the versions differ), and if the platform refuses the class itself, an
// anonymous subclass is defined instead.
defineVelcroComponent(VelcroColorPicker);
defineVelcroComponent(VelcroButtonGroup);
defineVelcroComponent(VelcroButton);
defineVelcroComponent(VelcroDropdown);
defineVelcroComponent(VelcroPopup);
defineVelcroComponent(VelcroIcon);
defineVelcroComponent(VelcroInput);
defineVelcroComponent(VelcroVisuallyHidden);
