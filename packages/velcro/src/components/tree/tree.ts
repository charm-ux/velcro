// Adapted from Shoelace v2.20.1 (src/components/tree/tree.component.ts, the `watch` decorator in src/internal/watch.ts and
// the localization controller in src/utilities/localize.ts), Copyright (c) 2020 A Beautiful Site, LLC, MIT License. See
// THIRD_PARTY_NOTICES.md. The API documentation wording, the rendered structure (a base wrapper with the default slot and
// the two hidden icon slots), the `role`, `tabindex` and `aria-multiselectable` attributes the tree sets on itself, the
// selection modes, the click, mouse down and keyboard handling, the roving tabindex, the expand and collapse icon cloning,
// the checkbox synchronization for multiple selection and the `sl-selection-change` event follow Shoelace. Velcro changes:
// built on the @charm-ux/core base element (core has no tree) and the `@watch` handler runs from `update()`. Shoelace's
// behavior is matched exactly, including its quirks; each one is marked "Upstream quirk" below and listed on the docs page.
import { html, type PropertyValues } from 'lit';
import { property, query } from 'lit/decorators.js';
import { CharmElement } from '@charm-ux/core/dist/base/charm-element/charm-element.js';
import { documentDir } from '../../internal/localize.js';
import { clamp } from '../../internal/math.js';
import { LocalizeController } from '../../utilities/localize.js';
import { VelcroTreeItem } from '../tree-item/class.js';
import styles from './tree.styles.js';

function syncCheckboxes(changedTreeItem: VelcroTreeItem, initialSync = false) {
  function syncParentItem(treeItem: VelcroTreeItem) {
    const children = treeItem.getChildrenItems({ includeDisabled: false });

    if (children.length) {
      const allChecked = children.every(item => item.selected);
      const allUnchecked = children.every(item => !item.selected && !item.indeterminate);

      treeItem.selected = allChecked;
      treeItem.indeterminate = !allChecked && !allUnchecked;
    }
  }

  function syncAncestors(treeItem: VelcroTreeItem) {
    const parentItem = treeItem.parentElement as VelcroTreeItem | null;

    if (parentItem && VelcroTreeItem.isTreeItem(parentItem)) {
      syncParentItem(parentItem);
      syncAncestors(parentItem);
    }
  }

  function syncDescendants(treeItem: VelcroTreeItem) {
    for (const childItem of treeItem.getChildrenItems()) {
      childItem.selected = initialSync ? treeItem.selected || childItem.selected : !childItem.disabled && treeItem.selected;

      syncDescendants(childItem);
    }

    if (initialSync) {
      syncParentItem(treeItem);
    }
  }

  syncDescendants(changedTreeItem);
  syncAncestors(changedTreeItem);
}

/**
 * Trees allow you to display a hierarchical list of selectable [tree items](/components/tree-item). Items with children
 * can be expanded and collapsed as desired by the user.
 *
 * Built on the @charm-ux/core base element: core has no tree. The only core extension is the non-bubbling `ready` event
 * on first update. Shoelace's tree renders no other element and has no dependencies, so registering the tree registers
 * nothing else: `<sl-tree-item>` has its own entry.
 *
 * @tag sl-tree
 * @status prototype
 *
 * @event {{ selection: SlTreeItem[] }} sl-selection-change - Emitted when a tree item is selected or deselected.
 *
 * @slot - The default slot.
 * @slot expand-icon - The icon to show when the tree item is expanded. Works best with `<sl-icon>`.
 * @slot collapse-icon - The icon to show when the tree item is collapsed. Works best with `<sl-icon>`.
 *
 * @csspart base - The component's base wrapper.
 *
 * @cssproperty [--indent-size=var(--sl-spacing-medium)] - The size of the indentation for nested items.
 * @cssproperty [--indent-guide-color=var(--sl-color-neutral-200)] - The color of the indentation line.
 * @cssproperty [--indent-guide-offset=0] - The amount of vertical spacing to leave between the top and bottom of the
 *  indentation line's starting position.
 * @cssproperty [--indent-guide-style=solid] - The style of the indentation line, e.g. solid, dotted, dashed.
 * @cssproperty [--indent-guide-width=0] - The width of the indentation line.
 */
export class VelcroTree extends CharmElement {
  public static override baseName = 'tree';

  // Core's base styles are replaced by Shoelace's own (see the styles file).
  public static override styles = [styles];

  private velcroDir?: string;

  // As in Shoelace: the controller re-renders the tree when the document's language or direction changes. The direction
  // itself is resolved by direction(), as Shoelace's controller resolves it.
  private readonly localize = new LocalizeController(this);

  /** @internal Shoelace's public but undocumented `defaultSlot`: the default slot. */
  @query('slot:not([name])')
  public defaultSlot!: HTMLSlotElement;

  /** @internal Shoelace's public but undocumented `expandedIconSlot`: the `expand-icon` slot. */
  @query('slot[name=expand-icon]')
  public expandedIconSlot!: HTMLSlotElement;

  /** @internal Shoelace's public but undocumented `collapsedIconSlot`: the `collapse-icon` slot. */
  @query('slot[name=collapse-icon]')
  public collapsedIconSlot!: HTMLSlotElement;

  // `dir` and `lang` are declared as Shoelace's base element declares them: reactive, not reflected and without an
  // initial value (undefined). Core's `dir` would return the computed direction instead.
  // Types: Shoelace declares `dir: string`. The setter accepts any string, as Shoelace's does. The getter must keep
  // core's declared type, because TypeScript does not let a subclass widen an inherited property's read type; at
  // runtime it returns whatever was set.
  /**
   * The element's text direction, as set by the `dir` attribute or property and returned as set. Not reflected. Any
   * string can be assigned; the declared read type stays core's `'ltr' | 'rtl' | 'auto'`.
   */
  @property()
  public override get dir(): 'ltr' | 'rtl' | 'auto' {
    return this.velcroDir as 'ltr' | 'rtl' | 'auto';
  }
  public override set dir(value: string) {
    this.velcroDir = value;
  }

  /** The element's language, as set by the `lang` attribute or property. Not reflected. */
  @property()
  public override lang!: string;

  /**
   * The selection behavior of the tree. Single selection allows only one node to be selected at a time. Multiple
   * displays checkboxes and allows more than one node to be selected. Leaf allows only leaf nodes to be selected.
   */
  @property()
  public selection: 'single' | 'multiple' | 'leaf' = 'single';

  //
  // A collection of all the items in the tree, in the order they appear. The collection is live, meaning it is
  // automatically updated when the underlying document is changed.
  //
  private lastFocusedItem?: VelcroTreeItem | null;

  private mutationObserver?: MutationObserver;

  private clickTarget: VelcroTreeItem | null = null;

  public constructor() {
    super();
    this.addEventListener('focusin', this.handleFocusIn);
    this.addEventListener('focusout', this.handleFocusOut);
    this.addEventListener('sl-lazy-change', this.handleSlotChange);
  }

  // Upstream quirk: Shoelace's `connectedCallback` is async. `role` and `tabindex` are set at once, but the mutation
  // observer is created only after the first update completes (and a tree that is removed before that still gets one).
  public override async connectedCallback() {
    super.connectedCallback();

    this.setAttribute('role', 'tree');
    this.setAttribute('tabindex', '0');

    await this.updateComplete;

    this.mutationObserver = new MutationObserver(this.handleTreeChanged);
    this.mutationObserver.observe(this, { childList: true, subtree: true });
  }

  public override disconnectedCallback() {
    super.disconnectedCallback();
    this.mutationObserver?.disconnect();
  }

  // The direction the keyboard handling uses, as Shoelace's localization controller resolves it: the host's `dir`
  // property (set directly or through the attribute), else the controller's document-direction snapshot (`<html dir>` as
  // of the last observer callback or translation registration, not a live read; else `ltr`), lower-cased. Velcro's shared
  // controller reads the host's `dir` attribute instead (core's `dir` getter returns the computed direction), which would
  // miss a direction set only through the property; this component's `dir` returns what was set, by attribute or property.
  private direction() {
    return `${this.velcroDir || documentDir()}`.toLowerCase();
  }

  // Generates a clone of the expand icon element to use for each tree item
  private getExpandButtonIcon(status: 'expand' | 'collapse') {
    const slot = status === 'expand' ? this.expandedIconSlot : this.collapsedIconSlot;
    const icon = slot.assignedElements({ flatten: true })[0] as HTMLElement;

    // Clone it, remove ids, and slot it
    if (icon) {
      const clone = icon.cloneNode(true) as HTMLElement;
      [clone, ...clone.querySelectorAll('[id]')].forEach(el => el.removeAttribute('id'));
      clone.setAttribute('data-default', '');
      clone.slot = `${status}-icon`;

      return clone;
    }

    return null;
  }

  // Initializes new items by setting the `selectable` property and the expanded/collapsed icons if any
  private initTreeItem = (item: VelcroTreeItem) => {
    item.selectable = this.selection === 'multiple';

    (['expand', 'collapse'] as const)
      .filter(status => !!this.querySelector(`[slot="${status}-icon"]`))
      .forEach(status => {
        const existingIcon = item.querySelector(`[slot="${status}-icon"]`);

        const expandButtonIcon = this.getExpandButtonIcon(status);

        if (!expandButtonIcon) return;

        if (existingIcon === null) {
          // No separator exists, add one
          item.append(expandButtonIcon);
        } else if (existingIcon.hasAttribute('data-default')) {
          // A default separator exists, replace it
          existingIcon.replaceWith(expandButtonIcon);
        } else {
          // The user provided a custom icon, leave it alone
        }
      });
  };

  private handleTreeChanged = (mutations: MutationRecord[]) => {
    for (const mutation of mutations) {
      const addedNodes = [...mutation.addedNodes].filter(VelcroTreeItem.isTreeItem) as VelcroTreeItem[];
      const removedNodes = [...mutation.removedNodes].filter(VelcroTreeItem.isTreeItem) as VelcroTreeItem[];

      addedNodes.forEach(this.initTreeItem);

      if (this.lastFocusedItem && removedNodes.includes(this.lastFocusedItem)) {
        this.lastFocusedItem = null;
      }
    }
  };

  private selectItem(selectedItem: VelcroTreeItem) {
    const previousSelection = [...this.selectedItems];

    if (this.selection === 'multiple') {
      selectedItem.selected = !selectedItem.selected;
      if (selectedItem.lazy) {
        selectedItem.expanded = true;
      }
      syncCheckboxes(selectedItem);
    } else if (this.selection === 'single' || selectedItem.isLeaf) {
      const items = this.getAllTreeItems();
      for (const item of items) {
        item.selected = item === selectedItem;
      }
    } else if (this.selection === 'leaf') {
      selectedItem.expanded = !selectedItem.expanded;
    }

    const nextSelection = this.selectedItems;

    if (previousSelection.length !== nextSelection.length || nextSelection.some(item => !previousSelection.includes(item))) {
      // Wait for the tree items' DOM to update before emitting
      void Promise.all(nextSelection.map(el => el.updateComplete)).then(() => {
        this.emit('sl-selection-change', { detail: { selection: nextSelection } });
      });
    }
  }

  private getAllTreeItems() {
    return [...this.querySelectorAll<VelcroTreeItem>('sl-tree-item')];
  }

  private focusItem(item?: VelcroTreeItem | null) {
    item?.focus();
  }

  private handleKeyDown(event: KeyboardEvent) {
    // Ignore key presses we aren't interested in
    if (!['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft', 'Home', 'End', 'Enter', ' '].includes(event.key)) {
      return;
    }

    // Ignore key presses when focus is inside a text field. This prevents the component from hijacking nested form
    // controls that exist inside tree items.
    if (event.composedPath().some(el => ['input', 'textarea'].includes((el as HTMLElement)?.tagName?.toLowerCase()))) {
      return;
    }

    const items = this.getFocusableItems();
    const isLtr = this.direction() === 'ltr';
    const isRtl = this.direction() === 'rtl';

    if (items.length > 0) {
      event.preventDefault();
      const activeItemIndex = items.findIndex(item => item.matches(':focus'));
      const activeItem: VelcroTreeItem | undefined = items[activeItemIndex];

      const focusItemAt = (index: number) => {
        const item = items[clamp(index, 0, items.length - 1)];
        this.focusItem(item);
      };
      const toggleExpand = (expanded: boolean) => {
        activeItem!.expanded = expanded;
      };

      if (event.key === 'ArrowDown') {
        // Moves focus to the next node that is focusable without opening or closing a node.
        focusItemAt(activeItemIndex + 1);
      } else if (event.key === 'ArrowUp') {
        // Moves focus to the next node that is focusable without opening or closing a node.
        focusItemAt(activeItemIndex - 1);
      } else if ((isLtr && event.key === 'ArrowRight') || (isRtl && event.key === 'ArrowLeft')) {
        //
        // When focus is on a closed node, opens the node; focus does not move.
        // When focus is on a open node, moves focus to the first child node.
        // When focus is on an end node (a tree item with no children), does nothing.
        //
        if (!activeItem || activeItem.disabled || activeItem.expanded || (activeItem.isLeaf && !activeItem.lazy)) {
          focusItemAt(activeItemIndex + 1);
        } else {
          toggleExpand(true);
        }
      } else if ((isLtr && event.key === 'ArrowLeft') || (isRtl && event.key === 'ArrowRight')) {
        //
        // When focus is on an open node, closes the node.
        // When focus is on a child node that is also either an end node or a closed node, moves focus to its parent node.
        // When focus is on a closed `tree`, does nothing.
        //
        if (!activeItem || activeItem.disabled || activeItem.isLeaf || !activeItem.expanded) {
          focusItemAt(activeItemIndex - 1);
        } else {
          toggleExpand(false);
        }
      } else if (event.key === 'Home') {
        // Moves focus to the first node in the tree without opening or closing a node.
        focusItemAt(0);
      } else if (event.key === 'End') {
        // Moves focus to the last node in the tree that is focusable without opening the node.
        focusItemAt(items.length - 1);
      } else if (event.key === 'Enter' || event.key === ' ') {
        // Selects the focused node.
        // Upstream quirk: with no focused tree item (focus on another element inside the tree) `activeItem` is undefined and
        // this throws a TypeError, after the key's default action was prevented.
        if (!activeItem!.disabled) {
          this.selectItem(activeItem!);
        }
      }
    }
  }

  private handleClick(event: Event) {
    const target = event.target as VelcroTreeItem;
    const treeItem = target.closest<VelcroTreeItem>('sl-tree-item');
    const isExpandButton = event.composedPath().some(el => (el as HTMLElement)?.classList?.contains('tree-item__expand-button'));

    //
    // Don't Do anything if there's no tree item, if it's disabled, or if the click doesn't match the initial target
    // from mousedown. The latter case prevents the user from starting a click on one item and ending it on another,
    // causing the parent node to collapse.
    //
    // See https://github.com/shoelace-style/shoelace/issues/1082
    //
    if (!treeItem || treeItem.disabled || target !== this.clickTarget) {
      return;
    }

    if (isExpandButton) {
      treeItem.expanded = !treeItem.expanded;
    } else {
      this.selectItem(treeItem);
    }
  }

  /** @internal Shoelace's public but undocumented mouse down handler: records the item the click started on. */
  public handleMouseDown(event: MouseEvent) {
    // Record the click target so we know which item the click initially targeted
    this.clickTarget = event.target as VelcroTreeItem;
  }

  private handleFocusOut = (event: FocusEvent) => {
    const relatedTarget = event.relatedTarget as HTMLElement;

    // If the element that got the focus is not in the tree
    if (!relatedTarget || !this.contains(relatedTarget)) {
      this.tabIndex = 0;
    }
  };

  private handleFocusIn = (event: FocusEvent) => {
    const target = event.target as VelcroTreeItem;

    // If the tree has been focused, move the focus to the last focused item
    if (event.target === this) {
      this.focusItem(this.lastFocusedItem || this.getAllTreeItems()[0]);
    }

    // If the target is a tree item, update the tabindex
    if (VelcroTreeItem.isTreeItem(target) && !target.disabled) {
      if (this.lastFocusedItem) {
        this.lastFocusedItem.tabIndex = -1;
      }
      this.lastFocusedItem = target;
      this.tabIndex = -1;

      target.tabIndex = 0;
    }
  };

  private handleSlotChange() {
    const items = this.getAllTreeItems();
    items.forEach(this.initTreeItem);
  }

  // Shoelace's `@watch('selection')`: it runs before the render, from the first update on, when `selection` changed.
  protected override update(changed: PropertyValues<this>) {
    if (changed.has('selection') && changed.get('selection') !== this.selection) {
      void this.handleSelectionChange();
    }

    super.update(changed);
  }

  /** @internal Shoelace's public `@watch('selection')` handler: mirrors `selection` to `aria-multiselectable` and the items. */
  public async handleSelectionChange() {
    const isSelectionMultiple = this.selection === 'multiple';
    const items = this.getAllTreeItems();

    this.setAttribute('aria-multiselectable', isSelectionMultiple ? 'true' : 'false');

    for (const item of items) {
      item.selectable = isSelectionMultiple;
    }

    if (isSelectionMultiple) {
      await this.updateComplete;

      [...this.querySelectorAll<VelcroTreeItem>(':scope > sl-tree-item')].forEach(treeItem => syncCheckboxes(treeItem, true));
    }
  }

  /** @internal Returns the list of tree items that are selected in the tree. */
  public get selectedItems(): VelcroTreeItem[] {
    const items = this.getAllTreeItems();
    const isSelected = (item: VelcroTreeItem) => item.selected;

    return items.filter(isSelected);
  }

  /** @internal Gets focusable tree items in the tree. */
  public getFocusableItems() {
    const items = this.getAllTreeItems();
    const collapsedItems = new Set<unknown>();

    return items.filter(item => {
      // Exclude disabled elements
      if (item.disabled) return false;

      // Exclude those whose parent is collapsed or loading
      const parent = item.parentElement?.closest<VelcroTreeItem>('[role=treeitem]');
      if (parent && (!parent.expanded || parent.loading || collapsedItems.has(parent))) {
        collapsedItems.add(item);
      }

      return !collapsedItems.has(item);
    });
  }

  protected override render() {
    return html`
      <div
        part="base"
        class="tree"
        @click=${this.handleClick}
        @keydown=${this.handleKeyDown}
        @mousedown=${this.handleMouseDown}
      >
        <slot @slotchange=${this.handleSlotChange}></slot>
        <span hidden aria-hidden="true"><slot name="expand-icon"></slot></span>
        <span hidden aria-hidden="true"><slot name="collapse-icon"></slot></span>
      </div>
    `;
  }
}
