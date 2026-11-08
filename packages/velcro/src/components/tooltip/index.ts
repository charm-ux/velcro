import { defineVelcroComponent } from '../../utilities/registration.js';
import { VelcroPopup } from '../popup/class.js';
import { VelcroTooltip } from './class.js';

export * from './class.js';

// Registers the exported class itself as <sl-tooltip> through the native registry. Core's shared prefix and scope are
// not touched. The tooltip renders an <sl-popup>, so Velcro's popup is registered too (Shoelace's tooltip lists it as a
// dependency in the same way). Both calls are idempotent and fail loudly if a different constructor owns the tag.
defineVelcroComponent(VelcroTooltip);
defineVelcroComponent(VelcroPopup);
