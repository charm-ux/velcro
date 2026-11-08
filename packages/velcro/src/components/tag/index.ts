import { defineVelcroComponent } from '../../utilities/registration.js';
import { VelcroIcon } from '../icon/class.js';
import { VelcroIconButton } from '../icon-button/class.js';
import { VelcroTag } from './class.js';

export * from './class.js';

// Registers the exported class itself as <sl-tag> through the native registry. Core's shared prefix and scope are not touched.
// The remove button is an <sl-icon-button>, which draws an <sl-icon>, so Velcro's icon button and icon are registered too
// (Shoelace's tag lists the icon button as a dependency in the same way, and the icon button its icon). All calls are
// idempotent and fail loudly if a different constructor owns the tag.
defineVelcroComponent(VelcroTag);
defineVelcroComponent(VelcroIconButton);
defineVelcroComponent(VelcroIcon);
