import { defineVelcroComponent } from '../../utilities/registration.js';
import { VelcroMenuItem } from './class.js';

export * from './class.js';

// Registers the exported class itself as <sl-menu-item> through the native registry. Core's shared prefix and scope are not
// touched. The item renders an <sl-icon> (the check mark and the submenu chevron), an <sl-popup> (a submenu) and an
// <sl-spinner> (the loading state). As in Shoelace, this module registers only the item: its constructor defines those
// three dependencies (see `VelcroMenuItem`), leaving a tag that another constructor already owns alone and defining an
// anonymous subclass when the platform refuses the class itself, so importing this entry never fails because of them.
// Also as in Shoelace, <sl-menu> is not registered here: import it from `./menu` (or the package root). The call is
// idempotent and fails loudly if a different constructor owns <sl-menu-item> itself.
defineVelcroComponent(VelcroMenuItem);
