import { defineVelcroComponent } from '../../utilities/registration.js';
import { VelcroQrCode } from './class.js';

export * from './class.js';

// Registers the exported class itself as <sl-qr-code> through the native registry. Core's shared prefix and scope are not
// touched. Like Shoelace's QR code it has no dependencies: it renders no other sl-* element. A tag that is already defined
// is left alone (with Shoelace's console warning when the versions differ), and if the platform refuses the class itself,
// an anonymous subclass is defined instead.
defineVelcroComponent(VelcroQrCode);
