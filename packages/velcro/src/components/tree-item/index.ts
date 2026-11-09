import { defineVelcroComponent } from '../../utilities/registration.js';
import { VelcroCheckbox } from '../checkbox/class.js';
import { VelcroIcon } from '../icon/class.js';
import { VelcroSpinner } from '../spinner/class.js';
import { VelcroTreeItem } from './class.js';

export * from './class.js';

// Registers the exported class itself as <sl-tree-item> through the native registry. Core's shared prefix and scope are
// not touched. The item renders an <sl-checkbox> (multiple selection), an <sl-icon> (its expand and collapse icon, and the
// checkbox's check mark) and an <sl-spinner> (loading), so Velcro's checkbox, icon and spinner are registered too
// (Shoelace's tree item lists the same three as dependencies). As in Shoelace, <sl-tree> is a separate component: its entry
// does not register the items, and this entry does not register the tree. Every tag is registered as Shoelace's `define`
// registers it: a tag that is already defined is left alone (with Shoelace's console warning when the versions differ), and
// if the platform refuses the class itself, an anonymous subclass is defined instead.
defineVelcroComponent(VelcroTreeItem);
defineVelcroComponent(VelcroCheckbox);
defineVelcroComponent(VelcroIcon);
defineVelcroComponent(VelcroSpinner);
