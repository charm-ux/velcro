// Adapted from Shoelace v2.20.1 (src/components/tree-item/tree-item.component.ts, the `watch` decorator in
// src/internal/watch.ts and the dependency definition in src/internal/shoelace-element.ts),
// Copyright (c) 2020 A Beautiful Site, LLC, MIT License. See THIRD_PARTY_NOTICES.md. The API documentation wording, the
// rendered structure (an item row with the indentation, the expand button with its spinner and icon slots, the checkbox
// shown for multiple selection and the label, and a `children` group around the nested items), the `role`, `tabindex` and
// `aria-*` attributes the item sets on itself, the loading, selection, expansion and lazy handling, the expand and collapse
// animations with their registry defaults and the `sl-expand` / `sl-after-expand` / `sl-collapse` / `sl-after-collapse` /
// `sl-lazy-change` / `sl-lazy-load` events follow Shoelace. Velcro changes: built on the @charm-ux/core base element (core
// has no tree item), the `@watch` handlers run from `update()`, and the dependencies on <sl-checkbox>, <sl-icon> and
// <sl-spinner> are defined when a tree item is constructed through Velcro's registration helper rather than Shoelace's
// `static dependencies`. Shoelace's behavior is matched exactly, including its quirks; each one is marked "Upstream quirk"
// below and listed on the docs page.
import { html, type PropertyValues } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { live } from 'lit/directives/live.js';
import { when } from 'lit/directives/when.js';
import { CharmElement } from '@charm-ux/core/dist/base/charm-element/charm-element.js';
import { animateTo, shimKeyframesHeightAuto, stopAnimations } from '../../internal/animate.js';
import { documentDir } from '../../internal/localize.js';
import { getAnimation, setDefaultAnimation } from '../../utilities/animation-registry.js';
import { LocalizeController } from '../../utilities/localize.js';
import { defineVelcroComponent, type VelcroComponentConstructor } from '../../utilities/registration.js';
import { VelcroCheckbox } from '../checkbox/class.js';
import { VelcroIcon } from '../icon/class.js';
import { VelcroSpinner } from '../spinner/class.js';
import styles from './tree-item.styles.js';

// Shoelace's name for the class, which its manifest shows in `getChildrenItems()`'s return type (the class is exported as
// `SlTreeItem` from `class.ts`).
type SlTreeItem = VelcroTreeItem;

/**
 * A tree item serves as a hierarchical node that lives inside a tree.
 *
 * Built on the @charm-ux/core base element: core has no tree item. The only core extension is the non-bubbling `ready`
 * event on first update.
 *
 * It renders an `<sl-checkbox>` (multiple selection), an `<sl-icon>` (the default expand and collapse icon) and an
 * `<sl-spinner>` (a lazy item that is loading), as Shoelace does; like Shoelace's, constructing a tree item defines those
 * dependencies (Velcro's) when no element owns their tags yet. The expand and collapse animations come from the animation
 * registry (`tree-item.expand` and `tree-item.collapse`); change them with `setAnimation()` or `setDefaultAnimation()`
 * from `@charm-ux/velcro/utilities/animation-registry`.
 *
 * @tag sl-tree-item
 * @status prototype
 *
 * @dependency sl-checkbox
 * @dependency sl-icon
 * @dependency sl-spinner
 *
 * @event sl-expand - Emitted when the tree item expands.
 * @event sl-after-expand - Emitted after the tree item expands and all animations are complete.
 * @event sl-collapse - Emitted when the tree item collapses.
 * @event sl-after-collapse - Emitted after the tree item collapses and all animations are complete.
 * @event sl-lazy-change - Emitted when the tree item's lazy state changes.
 * @event sl-lazy-load - Emitted when a lazy item is selected. Use this event to asynchronously load data and append
 *  items to the tree before expanding. After appending new items, remove the `lazy` attribute to remove the loading
 *  state and update the tree.
 *
 * @slot - The default slot.
 * @slot expand-icon - The icon to show when the tree item is expanded.
 * @slot collapse-icon - The icon to show when the tree item is collapsed.
 *
 * @csspart base - The component's base wrapper.
 * @csspart item - The tree item's container. This element wraps everything except slotted tree item children.
 * @csspart item--disabled - Applied when the tree item is disabled.
 * @csspart item--expanded - Applied when the tree item is expanded.
 * @csspart item--indeterminate - Applied when the selection is indeterminate.
 * @csspart item--selected - Applied when the tree item is selected.
 * @csspart indentation - The tree item's indentation container.
 * @csspart expand-button - The container that wraps the tree item's expand button and spinner.
 * @csspart spinner - The spinner that shows when a lazy tree item is in the loading state.
 * @csspart spinner__base - The spinner's base part.
 * @csspart label - The tree item's label.
 * @csspart children - The container that wraps the tree item's nested children.
 * @csspart checkbox - The checkbox that shows when using multiselect.
 * @csspart checkbox__base - The checkbox's exported `base` part.
 * @csspart checkbox__control - The checkbox's exported `control` part.
 * @csspart checkbox__control--checked - The checkbox's exported `control--checked` part.
 * @csspart checkbox__control--indeterminate - The checkbox's exported `control--indeterminate` part.
 * @csspart checkbox__checked-icon - The checkbox's exported `checked-icon` part.
 * @csspart checkbox__indeterminate-icon - The checkbox's exported `indeterminate-icon` part.
 * @csspart checkbox__label - The checkbox's exported `label` part.
 *
 * @animation tree-item.expand - The animation to use when expanding a tree item. You can use `height: auto` with this animation.
 * @animation tree-item.collapse - The animation to use when collapsing a tree item. You can use `height: auto` with this animation.
 */
export class VelcroTreeItem extends CharmElement {
  public static override baseName = 'tree-item';

  // Core's base styles are replaced by Shoelace's own (see the styles file).
  public static override styles = [styles];

  // Shoelace's `static dependencies` for the tree item: the elements its template renders. Shoelace keys them by tag; here
  // the tag is derived from each class's `baseName` (`sl-checkbox` for `VelcroCheckbox`), the same tag
  // `defineVelcroComponent` defines and the template renders. As in Shoelace's base element, each one that is not defined
  // yet is defined when a tree item is constructed, and a tag that another constructor already owns is left alone (with
  // Shoelace's warning when the versions differ). If the platform refuses the class itself (for example because it is
  // already registered under another tag), an anonymous subclass is defined instead, as Shoelace does. Core's own
  // array-typed `dependencies` (registration in core's scope) stays empty. Not part of the documented API (Shoelace's
  // manifest lists `dependencies` without a description).
  private static readonly shoelaceDependencies: readonly VelcroComponentConstructor[] = [VelcroCheckbox, VelcroIcon, VelcroSpinner];

  /** @internal Whether a node is a tree item (its `role` is `treeitem`). Shoelace's public static helper. */
  public static isTreeItem(node: Node) {
    return node instanceof Element && node.getAttribute('role') === 'treeitem';
  }

  public constructor() {
    super();
    for (const component of VelcroTreeItem.shoelaceDependencies) defineVelcroComponent(component);
  }

  private velcroDir?: string;

  // As in Shoelace: the controller re-renders the item when the document's language or direction changes. The direction
  // itself is resolved by direction(), as Shoelace's controller resolves it.
  private readonly localize = new LocalizeController(this);

  /** @internal The selection of the item is indeterminate (some of its descendants are selected). Set by the tree. */
  @state()
  public indeterminate = false;

  /** @internal The item has no nested items and is not lazy. */
  @state()
  public isLeaf = false;

  /** @internal A lazy item is loading its children after an expand. */
  @state()
  public loading = false;

  /** @internal The item shows a checkbox (the tree's selection is `multiple`). Set by the tree. */
  @state()
  public selectable = false;

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

  /** Expands the tree item. */
  @property({ type: Boolean, reflect: true })
  public expanded = false;

  /** Draws the tree item in a selected state. */
  @property({ type: Boolean, reflect: true })
  public selected = false;

  /** Disables the tree item. */
  @property({ type: Boolean, reflect: true })
  public disabled = false;

  /** Enables lazy loading behavior. */
  @property({ type: Boolean, reflect: true })
  public lazy = false;

  /** @internal Shoelace's public but undocumented `defaultSlot`: the label slot. */
  @query('slot:not([name])')
  public defaultSlot!: HTMLSlotElement;

  /** @internal Shoelace's public but undocumented `childrenSlot`: the slot of the nested items. */
  @query('slot[name=children]')
  public childrenSlot!: HTMLSlotElement;

  /** @internal Shoelace's public but undocumented `itemElement`: the item row. */
  @query('.tree-item__item')
  public itemElement!: HTMLDivElement;

  /** @internal Shoelace's public but undocumented `childrenContainer`: the group that holds the nested items. */
  @query('.tree-item__children')
  public childrenContainer!: HTMLDivElement;

  /** @internal Shoelace's public but undocumented `expandButtonSlot`: the first slot inside the expand button. */
  @query('.tree-item__expand-button slot')
  public expandButtonSlot!: HTMLSlotElement;

  public override connectedCallback() {
    super.connectedCallback();

    this.setAttribute('role', 'treeitem');
    this.setAttribute('tabindex', '-1');

    if (this.isNestedItem()) {
      this.slot = 'children';
    }
  }

  public override firstUpdated() {
    // Velcro extension (core): the base element's non-bubbling `ready` event.
    super.firstUpdated();

    this.childrenContainer.hidden = !this.expanded;
    this.childrenContainer.style.height = this.expanded ? 'auto' : '0';

    this.isLeaf = !this.lazy && this.getChildrenItems().length === 0;
    this.handleExpandedChange();
  }

  // The direction the render and the animations use, as Shoelace's localization controller resolves it: the host's `dir`
  // property (set directly or through the attribute), else the controller's document-direction snapshot (`<html dir>` as
  // of the last observer callback or translation registration, not a live read; else `ltr`), lower-cased. Velcro's shared
  // controller reads the host's `dir` attribute instead (core's `dir` getter returns the computed direction), which would
  // miss a direction set only through the property; this component's `dir` returns what was set, by attribute or property.
  private direction() {
    return `${this.velcroDir || documentDir()}`.toLowerCase();
  }

  private async animateCollapse() {
    this.emit('sl-collapse');

    await stopAnimations(this.childrenContainer);

    const { keyframes, options } = getAnimation(this, 'tree-item.collapse', { dir: this.direction() });
    await animateTo(
      this.childrenContainer,
      shimKeyframesHeightAuto(keyframes, this.childrenContainer.scrollHeight),
      options,
    );
    this.childrenContainer.hidden = true;

    this.emit('sl-after-collapse');
  }

  // Checks whether the item is nested into an item
  private isNestedItem(): boolean {
    const parent = this.parentElement;
    return !!parent && VelcroTreeItem.isTreeItem(parent);
  }

  private handleChildrenSlotChange() {
    this.loading = false;
    this.isLeaf = !this.lazy && this.getChildrenItems().length === 0;
  }

  // Shoelace's own `willUpdate`: a change of `selected` clears `indeterminate` unless it changed in the same update.
  // Upstream quirk: it replaces the base element's `willUpdate` without calling it, so the base element's restore of a
  // reflected property's initial value (which other components have) never runs for a tree item: a property set to null
  // stays null.
  protected override willUpdate(changed: PropertyValues<this>) {
    if (changed.has('selected') && !changed.has('indeterminate')) {
      this.indeterminate = false;
    }
  }

  // Shoelace's `@watch` handlers, which run before the render. Shoelace applies the decorators in declaration order
  // (`loading`, `disabled`, `selected`, `expanded` twice, `lazy`) and each wraps `update`, so the last one runs first:
  // `lazy`, then the expand animation and the aria-expanded handler of `expanded`, then `selected`, `disabled` and
  // `loading`. The ones marked `waitUntilFirstUpdate` start from the second update. Each runs only when the value differs
  // from the previous one, checked when its turn comes. Because they run inside `update()`, a property they set (`loading`)
  // does not start another update, as upstream.
  protected override update(changed: PropertyValues<this>) {
    if (this.hasUpdated && changed.has('lazy') && changed.get('lazy') !== this.lazy) {
      this.handleLazyChange();
    }
    if (this.hasUpdated && changed.has('expanded') && changed.get('expanded') !== this.expanded) {
      this.handleExpandAnimation();
    }
    if (this.hasUpdated && changed.has('expanded') && changed.get('expanded') !== this.expanded) {
      this.handleExpandedChange();
    }
    if (changed.has('selected') && changed.get('selected') !== this.selected) {
      this.handleSelectedChange();
    }
    if (changed.has('disabled') && changed.get('disabled') !== this.disabled) {
      this.handleDisabledChange();
    }
    if (this.hasUpdated && changed.has('loading') && changed.get('loading') !== this.loading) {
      this.handleLoadingChange();
    }

    super.update(changed);
  }

  private async animateExpand() {
    this.emit('sl-expand');

    await stopAnimations(this.childrenContainer);
    this.childrenContainer.hidden = false;

    const { keyframes, options } = getAnimation(this, 'tree-item.expand', { dir: this.direction() });
    await animateTo(
      this.childrenContainer,
      shimKeyframesHeightAuto(keyframes, this.childrenContainer.scrollHeight),
      options,
    );
    this.childrenContainer.style.height = 'auto';

    this.emit('sl-after-expand');
  }

  /** @internal Shoelace's public `@watch('loading')` handler: mirrors `loading` to `aria-busy` and expands when loading ends. */
  public handleLoadingChange() {
    this.setAttribute('aria-busy', this.loading ? 'true' : 'false');

    if (!this.loading) {
      void this.animateExpand();
    }
  }

  /** @internal Shoelace's public `@watch('disabled')` handler: mirrors `disabled` to `aria-disabled`. */
  public handleDisabledChange() {
    this.setAttribute('aria-disabled', this.disabled ? 'true' : 'false');
  }

  /** @internal Shoelace's public `@watch('selected')` handler: mirrors `selected` to `aria-selected`. */
  public handleSelectedChange() {
    this.setAttribute('aria-selected', this.selected ? 'true' : 'false');
  }

  /** @internal Shoelace's public `@watch('expanded')` handler: mirrors `expanded` to `aria-expanded` (not on a leaf). */
  public handleExpandedChange() {
    if (!this.isLeaf) {
      this.setAttribute('aria-expanded', this.expanded ? 'true' : 'false');
    } else {
      this.removeAttribute('aria-expanded');
    }
  }

  /** @internal Shoelace's public `@watch('expanded')` handler: starts the expand or collapse animation, or the lazy load. */
  public handleExpandAnimation() {
    if (this.expanded) {
      if (this.lazy) {
        this.loading = true;

        this.emit('sl-lazy-load');
      } else {
        void this.animateExpand();
      }
    } else {
      void this.animateCollapse();
    }
  }

  /** @internal Shoelace's public `@watch('lazy')` handler: announces the change of `lazy`. */
  public handleLazyChange() {
    this.emit('sl-lazy-change');
  }

  /** Gets all the nested tree items in this node. */
  public getChildrenItems({ includeDisabled = true }: { includeDisabled?: boolean } = {}): SlTreeItem[] {
    return this.childrenSlot
      ? (this.childrenSlot
          .assignedElements({ flatten: true })
          .filter(item => VelcroTreeItem.isTreeItem(item) && (includeDisabled || !(item as SlTreeItem).disabled)) as SlTreeItem[])
      : [];
  }

  protected override render() {
    const isRtl = this.direction() === 'rtl';
    const showExpandButton = !this.loading && (!this.isLeaf || this.lazy);

    return html`
      <div
        part="base"
        class="${classMap({
          'tree-item': true,
          'tree-item--expanded': this.expanded,
          'tree-item--selected': this.selected,
          'tree-item--disabled': this.disabled,
          'tree-item--leaf': this.isLeaf,
          'tree-item--has-expand-button': showExpandButton,
          'tree-item--rtl': this.direction() === 'rtl',
        })}"
      >
        <div
          class="tree-item__item"
          part="
            item
            ${this.disabled ? 'item--disabled' : ''}
            ${this.expanded ? 'item--expanded' : ''}
            ${this.indeterminate ? 'item--indeterminate' : ''}
            ${this.selected ? 'item--selected' : ''}
          "
        >
          <div class="tree-item__indentation" part="indentation"></div>

          <div
            part="expand-button"
            class=${classMap({
              'tree-item__expand-button': true,
              'tree-item__expand-button--visible': showExpandButton,
            })}
            aria-hidden="true"
          >
            ${when(
              this.loading,
              () => html` <sl-spinner part="spinner" exportparts="base:spinner__base"></sl-spinner> `,
            )}
            <slot class="tree-item__expand-icon-slot" name="expand-icon">
              <sl-icon library="system" name=${isRtl ? 'chevron-left' : 'chevron-right'}></sl-icon>
            </slot>
            <slot class="tree-item__expand-icon-slot" name="collapse-icon">
              <sl-icon library="system" name=${isRtl ? 'chevron-left' : 'chevron-right'}></sl-icon>
            </slot>
          </div>

          ${when(
            this.selectable,
            () => html`
              <sl-checkbox
                part="checkbox"
                exportparts="
                    base:checkbox__base,
                    control:checkbox__control,
                    control--checked:checkbox__control--checked,
                    control--indeterminate:checkbox__control--indeterminate,
                    checked-icon:checkbox__checked-icon,
                    indeterminate-icon:checkbox__indeterminate-icon,
                    label:checkbox__label
                  "
                class="tree-item__checkbox"
                ?disabled="${this.disabled}"
                ?checked="${live(this.selected)}"
                ?indeterminate="${this.indeterminate}"
                tabindex="-1"
              ></sl-checkbox>
            `,
          )}

          <slot class="tree-item__label" part="label"></slot>
        </div>

        <div class="tree-item__children" part="children" role="group">
          <slot name="children" @slotchange="${this.handleChildrenSlotChange}"></slot>
        </div>
      </div>
    `;
  }
}

setDefaultAnimation('tree-item.expand', {
  keyframes: [
    { height: '0', opacity: '0', overflow: 'hidden' },
    { height: 'auto', opacity: '1', overflow: 'hidden' },
  ],
  options: { duration: 250, easing: 'cubic-bezier(0.4, 0.0, 0.2, 1)' },
});

setDefaultAnimation('tree-item.collapse', {
  keyframes: [
    { height: 'auto', opacity: '1', overflow: 'hidden' },
    { height: '0', opacity: '0', overflow: 'hidden' },
  ],
  options: { duration: 200, easing: 'cubic-bezier(0.4, 0.0, 0.2, 1)' },
});
