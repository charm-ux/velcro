// Type-level check that <sl-menu>'s and <sl-menu-item>'s `dir` accept any string, as Shoelace 2.20.1 declares it (`dir: string`),
// that the menu's `sl-select` event gives the typed menu item, and that the React wrappers take Shoelace's props.
// Compiled (never run) by `tsc -p tsconfig.react.json` as the last step of the library build.
import { createElement, createRef } from 'react';
import type { VelcroMenu as VelcroMenuClass } from '../dist/components/menu/menu.js';
import type { VelcroMenuItem as VelcroMenuItemClass } from '../dist/components/menu-item/menu-item.js';
import { VelcroMenu, VelcroMenuItem, type VelcroMenuElement, type VelcroMenuItemElement, type VelcroMenuItemProps, type VelcroMenuProps } from '../dist/react/index.js';

declare const menu: VelcroMenuClass;
declare const item: VelcroMenuItemClass;
declare const direction: string;

// A direction from configuration or another element is a plain string.
menu.dir = direction;
item.dir = direction;
menu.dir = 'rtl';
const read: string = menu.dir;
void read;

// @ts-expect-error a number is not a direction
menu.dir = 1;

// The item's own properties are Shoelace's.
item.type = 'checkbox';
item.checked = true;
item.value = 'x';
item.loading = false;
item.disabled = false;
// @ts-expect-error only 'normal' and 'checkbox' are item types
item.type = 'radio';

// onSlSelect receives an event whose detail is the selected menu item (Shoelace's SlSelectEvent), with the menu as target.
const onSlSelect: VelcroMenuProps['onSlSelect'] = event => {
  const selected: VelcroMenuItemClass = event.detail.item;
  const value: string = selected.value;
  const target: VelcroMenuElement = event.target;
  void [value, target];
};
const menuRef = createRef<VelcroMenuElement>();
const itemRef = createRef<VelcroMenuItemElement>();
const itemProps: VelcroMenuItemProps = { type: 'checkbox', checked: true, value: 'autosave', disabled: false, loading: false };
createElement(VelcroMenu, { ref: menuRef, style: { maxWidth: '200px' }, onSlSelect }, createElement(VelcroMenuItem, { ...itemProps, ref: itemRef }, 'Autosave'));
