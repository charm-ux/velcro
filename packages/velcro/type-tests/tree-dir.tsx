// Type-level check of <sl-tree>'s and <sl-tree-item>'s Shoelace 2.20.1 property types (the tree's `selection` with its three
// values, the item's `expanded`, `selected`, `disabled` and `lazy` and `getChildrenItems()`), that `dir` accepts any string
// as Shoelace declares it (`dir: string`), that the tree's `sl-selection-change` event gives the typed tree items, and that
// the React wrappers take the same props and handlers.
// Compiled (never run) by `tsc -p tsconfig.react.json` as the last step of the library build.
import { createElement, createRef } from 'react';
import type { VelcroTree as VelcroTreeClass } from '../dist/components/tree/tree.js';
import type { VelcroTreeItem as VelcroTreeItemClass } from '../dist/components/tree-item/tree-item.js';
import { VelcroTree, VelcroTreeItem, type VelcroTreeElement, type VelcroTreeItemElement, type VelcroTreeItemProps, type VelcroTreeProps } from '../dist/react/index.js';

declare const tree: VelcroTreeClass;
declare const item: VelcroTreeItemClass;
declare const direction: string;

// A direction from configuration or another element is a plain string.
tree.dir = direction;
item.dir = direction;
tree.dir = 'rtl';
const read: string = tree.dir;
void read;

// @ts-expect-error a number is not a direction
tree.dir = 1;

tree.selection = 'multiple';
tree.selection = 'leaf';
const selection: 'single' | 'multiple' | 'leaf' = tree.selection;
void selection;
// @ts-expect-error only single, multiple and leaf are selection modes
tree.selection = 'none';

item.expanded = true;
item.selected = true;
item.disabled = false;
item.lazy = true;
const children: VelcroTreeItemClass[] = item.getChildrenItems({ includeDisabled: false });
void children;
// @ts-expect-error expanded is a boolean
item.expanded = 'yes';

// onSlSelectionChange receives an event whose detail lists the selected tree items (Shoelace's SlSelectionChangeEvent), with the tree as target.
const onSlSelectionChange: VelcroTreeProps['onSlSelectionChange'] = event => {
  const selected: VelcroTreeItemClass[] = event.detail.selection;
  const target: VelcroTreeElement = event.target;
  void [selected, target];
};
const treeRef = createRef<VelcroTreeElement>();
const itemRef = createRef<VelcroTreeItemElement>();
const itemProps: VelcroTreeItemProps = { expanded: true, selected: false, disabled: false, lazy: false };
createElement(VelcroTree, { ref: treeRef, selection: 'multiple', onSlSelectionChange }, createElement(VelcroTreeItem, { ...itemProps, ref: itemRef }, 'Item'));
