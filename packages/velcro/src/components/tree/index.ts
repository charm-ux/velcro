import { defineVelcroComponent } from '../../utilities/registration.js';
import { VelcroTree } from './class.js';

export * from './class.js';

// Registers the exported class itself as <sl-tree> through the native registry. Core's shared prefix and scope are not touched.
// As in Shoelace, <sl-tree-item> is not registered here: a tree works with whatever <sl-tree-item> elements are in it (it finds
// them by tag name), so import `../tree-item/index.js` (or the package root) for the items. The tag is registered as
// Shoelace's `define` registers it: a tag that is already defined is left alone (with Shoelace's console warning when the
// versions differ), and if the platform refuses the class itself, an anonymous subclass is defined instead.
defineVelcroComponent(VelcroTree);
