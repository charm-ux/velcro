// Adapted from Shoelace v2.20.1 (src/components/carousel/carousel.component.ts and the dependency definition in
// src/internal/shoelace-element.ts), Copyright (c) 2020 A Beautiful Site, LLC, MIT License. See THIRD_PARTY_NOTICES.md.
// The API documentation wording, the rendered structure, the slide, clone and scroll-snap handling, the autoplay,
// keyboard, mouse-dragging and pagination logic, the mutation and intersection observers and the `sl-slide-change` event
// follow Shoelace. Velcro changes: built on the @charm-ux/core base element (core has no carousel component), the
// `@watch` handlers run from `update()`, and the dependency on <sl-icon> is defined when a carousel is constructed
// through Velcro's registration helper rather than Shoelace's `static dependencies`. Shoelace's behavior is matched
// exactly, including its quirks; each one is marked "Upstream quirk" below and listed on the docs page.
import '../tab-group/scrollend-polyfill.js';
import { html, type PropertyValues } from 'lit';
import { eventOptions, property, query, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { map } from 'lit/directives/map.js';
import { range } from 'lit/directives/range.js';
import { CharmElement } from '@charm-ux/core/dist/base/charm-element/charm-element.js';
import { defineVelcroComponent, type VelcroComponentConstructor } from '../../utilities/registration.js';
import { LocalizeController } from '../../utilities/localize.js';
import { documentDir } from '../../internal/localize.js';
import { prefersReducedMotion } from '../../internal/animate.js';
import { clamp } from '../../internal/math.js';
import { waitForEvent } from '../../internal/event.js';
import { VelcroIcon } from '../icon/class.js';
import type { VelcroCarouselItem } from '../carousel-item/class.js';
import { AutoplayController } from './autoplay-controller.js';
import styles from './carousel.styles.js';

/**
 * The `sl-slide-change` event, as Shoelace's `SlSlideChangeEvent` types it (its `slide` is Velcro's carousel item). It is also
 * the entry for the event in `GlobalEventHandlersEventMap`, so `addEventListener('sl-slide-change', ...)` on any element infers
 * the detail.
 */
export type SlSlideChangeEvent = CustomEvent<{ index: number; slide: VelcroCarouselItem }>;

declare global {
  interface GlobalEventHandlersEventMap {
    'sl-slide-change': SlSlideChangeEvent;
  }
}

/**
 * Carousels display an arbitrary number of content slides along a horizontal or vertical axis. API modelled on
 * Shoelace's `sl-carousel`. It renders `<sl-icon>` in its navigation buttons, as in Shoelace; like Shoelace's,
 * constructing a carousel defines that dependency (Velcro's) when no element owns its tag yet.
 *
 * Built on the @charm-ux/core base element: core has no carousel component, so the only core extension is the
 * non-bubbling `ready` event on first update.
 *
 * @tag sl-carousel
 * @status prototype
 *
 * @dependency sl-icon
 *
 * @event {{ index: number, slide: SlCarouselItem }} sl-slide-change - Emitted when the active slide changes.
 *
 * @slot - The carousel's main content, one or more `<sl-carousel-item>` elements.
 * @slot next-icon - Optional next icon to use instead of the default. Works best with `<sl-icon>`.
 * @slot previous-icon - Optional previous icon to use instead of the default. Works best with `<sl-icon>`.
 *
 * @csspart base - The carousel's internal wrapper.
 * @csspart scroll-container - The scroll container that wraps the slides.
 * @csspart pagination - The pagination indicators wrapper.
 * @csspart pagination-item - The pagination indicator.
 * @csspart pagination-item--active - Applied when the item is active.
 * @csspart navigation - The navigation wrapper.
 * @csspart navigation-button - The navigation button.
 * @csspart navigation-button--previous - Applied to the previous button.
 * @csspart navigation-button--next - Applied to the next button.
 *
 * @cssproperty --slide-gap - The space between each slide.
 * @cssproperty [--aspect-ratio=16/9] - The aspect ratio of each slide.
 * @cssproperty --scroll-hint - The amount of padding to apply to the scroll area, allowing adjacent slides to become
 *  partially visible as a scroll hint.
 */
export class VelcroCarousel extends CharmElement {
  public static override baseName = 'carousel';

  // Core's base styles are replaced by Shoelace's own (see the styles file).
  public static override styles = [styles];

  // Shoelace's `static dependencies` for the carousel: the element its template renders. Shoelace keys them by tag; here
  // the tag is derived from each class's `baseName`, the same tag `defineVelcroComponent` defines and the template
  // renders. As in Shoelace's base element, each one that is not defined yet is defined when a carousel is
  // constructed, and a tag that another constructor already owns is left alone (with Shoelace's warning when the
  // versions differ). If the platform refuses the class itself (for example because it is already registered under
  // another tag), an anonymous subclass is defined instead, as Shoelace does. Core's own array-typed `dependencies`
  // (registration in core's scope) stays empty.
  private static readonly shoelaceDependencies: readonly VelcroComponentConstructor[] = [VelcroIcon];

  public constructor() {
    super();
    for (const component of VelcroCarousel.shoelaceDependencies) defineVelcroComponent(component);
  }

  // Upstream quirk: Shoelace's base element restores a reflected property's initial value when its attribute is removed,
  // from its `willUpdate`. The carousel overrides `willUpdate` without calling the base one, so nothing is ever restored
  // for it and no hook is kept here: a reflected property set to null stays null.

  private velcroDir?: string;

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

  /** When set, allows the user to navigate the carousel in the same direction indefinitely. */
  @property({ type: Boolean, reflect: true })
  public loop = false;

  /** When set, show the carousel's navigation. */
  @property({ type: Boolean, reflect: true })
  public navigation = false;

  /** When set, show the carousel's pagination indicators. */
  @property({ type: Boolean, reflect: true })
  public pagination = false;

  /** When set, the slides will scroll automatically when the user is not interacting with them.  */
  @property({ type: Boolean, reflect: true })
  public autoplay = false;

  /** Specifies the amount of time, in milliseconds, between each automatic scroll.  */
  @property({ type: Number, attribute: 'autoplay-interval' })
  public autoplayInterval = 3000;

  /** Specifies how many slides should be shown at a given time.  */
  @property({ type: Number, attribute: 'slides-per-page' })
  public slidesPerPage = 1;

  /**
   * Specifies the number of slides the carousel will advance when scrolling, useful when specifying a `slides-per-page`
   * greater than one. It can't be higher than `slides-per-page`.
   */
  @property({ type: Number, attribute: 'slides-per-move' })
  public slidesPerMove = 1;

  /** Specifies the orientation in which the carousel will lay out.  */
  @property()
  public orientation: 'horizontal' | 'vertical' = 'horizontal';

  /** When set, it is possible to scroll through the slides by dragging them with the mouse. */
  @property({ type: Boolean, reflect: true, attribute: 'mouse-dragging' })
  public mouseDragging = false;

  @query('.carousel__slides')
  public scrollContainer!: HTMLElement;

  @query('.carousel__pagination')
  public paginationContainer!: HTMLElement;

  // The index of the active slide
  @state()
  public activeSlide = 0;

  @state()
  public scrolling = false;

  @state()
  public dragging = false;

  private readonly autoplayController = new AutoplayController(this, () => this.next());

  private dragStartPosition: [number, number] = [-1, -1];

  private readonly localize = new LocalizeController(this);

  private mutationObserver?: MutationObserver;

  private pendingSlideChange = false;

  public override connectedCallback(): void {
    super.connectedCallback();
    this.setAttribute('role', 'region');
    this.setAttribute('aria-label', this.localize.term('carousel'));
  }

  public override disconnectedCallback(): void {
    super.disconnectedCallback();
    // The observer is created on the first update, so a carousel that is removed before it has rendered has none; as in Shoelace,
    // the optional call makes that a no-op.
    this.mutationObserver?.disconnect();
  }

  // Shoelace's own `firstUpdated`, then core's: the non-bubbling `ready` event (a Velcro extension that Shoelace lacks).
  protected override firstUpdated(): void {
    this.initializeSlides();
    this.mutationObserver = new MutationObserver(this.handleSlotChange);
    this.mutationObserver.observe(this, {
      childList: true,
      subtree: true,
    });
    super.firstUpdated();
  }

  protected override willUpdate(changedProperties: PropertyValues<this>): void {
    // Ensure the slidesPerMove is never higher than the slidesPerPage
    if (changedProperties.has('slidesPerMove') || changedProperties.has('slidesPerPage')) {
      this.slidesPerMove = Math.min(this.slidesPerMove, this.slidesPerPage);
    }
  }

  // Shoelace's `@watch` handlers: `@watch('loop' | 'slidesPerPage', { waitUntilFirstUpdate: true })` on
  // `initializeSlides`, `@watch('activeSlide')` on `handleSlideChange`, `@watch('slidesPerMove')` on `updateSlidesSnap`
  // and `@watch('autoplay')` on `handleAutoplayChange`. They run before the render. Shoelace applies the decorators in
  // declaration order and each wraps `update`, so the later one runs first: `autoplay`, `slidesPerMove`, `activeSlide`,
  // `loop`, `slidesPerPage`. Each runs when its property changed to a different value; `loop` and `slidesPerPage` only
  // from the second update on, and a change of both runs `initializeSlides` twice.
  protected override update(changed: PropertyValues<this>) {
    if (changed.has('autoplay') && changed.get('autoplay') !== this.autoplay) {
      this.handleAutoplayChange();
    }
    if (changed.has('slidesPerMove') && changed.get('slidesPerMove') !== this.slidesPerMove) {
      this.updateSlidesSnap();
    }
    if (changed.has('activeSlide') && changed.get('activeSlide') !== this.activeSlide) {
      this.handleSlideChange();
    }
    if (this.hasUpdated) {
      if (changed.has('loop') && changed.get('loop') !== this.loop) {
        this.initializeSlides();
      }
      if (changed.has('slidesPerPage') && changed.get('slidesPerPage') !== this.slidesPerPage) {
        this.initializeSlides();
      }
    }

    super.update(changed);
  }

  // Shoelace's localization controller resolves the direction from the host's `dir` property, else the document's
  // (`<html dir>`, else ltr). Velcro's shared controller reads the host's `dir` attribute instead (core's `dir` getter
  // returns the computed direction), which would miss a direction set only through the property; this component's `dir`
  // returns what was set, by attribute or property, so it resolves the direction the way Shoelace does.
  private direction() {
    return `${this.velcroDir || documentDir()}`.toLowerCase();
  }

  private getPageCount() {
    const slidesCount = this.getSlides().length;
    const { slidesPerPage, slidesPerMove, loop } = this;

    const pages = loop ? slidesCount / slidesPerMove : (slidesCount - slidesPerPage) / slidesPerMove + 1;

    return Math.ceil(pages);
  }

  private getCurrentPage() {
    return Math.ceil(this.activeSlide / this.slidesPerMove);
  }

  private canScrollNext(): boolean {
    return this.loop || this.getCurrentPage() < this.getPageCount() - 1;
  }

  private canScrollPrev(): boolean {
    return this.loop || this.getCurrentPage() > 0;
  }

  /** @internal Gets all carousel items. */
  private getSlides({ excludeClones = true }: { excludeClones?: boolean } = {}) {
    return [...this.children].filter(
      (el: Element) => this.isCarouselItem(el) && (!excludeClones || !el.hasAttribute('data-clone'))
    ) as VelcroCarouselItem[];
  }

  private handleClick(event: MouseEvent) {
    if (this.dragging && this.dragStartPosition[0] > 0 && this.dragStartPosition[1] > 0) {
      const deltaX = Math.abs(this.dragStartPosition[0] - event.clientX);
      const deltaY = Math.abs(this.dragStartPosition[1] - event.clientY);
      const delta = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      // Prevents clicks on interactive elements while dragging if the click is within a small range. This prevents
      // accidental drags from interfering with intentional clicks.
      if (delta >= 10) {
        event.preventDefault();
      }
    }
  }

  private handleKeyDown(event: KeyboardEvent) {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) {
      const target = event.target as HTMLElement;
      const isRtl = this.direction() === 'rtl';
      const isFocusInPagination = target.closest('[part~="pagination-item"]') !== null;
      const isNext =
        event.key === 'ArrowDown' || (!isRtl && event.key === 'ArrowRight') || (isRtl && event.key === 'ArrowLeft');
      const isPrevious =
        event.key === 'ArrowUp' || (!isRtl && event.key === 'ArrowLeft') || (isRtl && event.key === 'ArrowRight');

      event.preventDefault();

      if (isPrevious) {
        this.previous();
      }

      if (isNext) {
        this.next();
      }

      if (event.key === 'Home') {
        this.goToSlide(0);
      }

      if (event.key === 'End') {
        this.goToSlide(this.getSlides().length - 1);
      }

      if (isFocusInPagination) {
        void this.updateComplete.then(() => {
          const activePaginationItem = this.shadowRoot?.querySelector<HTMLButtonElement>(
            '[part~="pagination-item--active"]'
          );

          if (activePaginationItem) {
            activePaginationItem.focus();
          }
        });
      }
    }
  }

  private handleMouseDragStart(event: PointerEvent) {
    const canDrag = this.mouseDragging && event.button === 0;
    if (canDrag) {
      event.preventDefault();

      document.addEventListener('pointermove', this.handleMouseDrag, { capture: true, passive: true });
      document.addEventListener('pointerup', this.handleMouseDragEnd, { capture: true, once: true });
    }
  }

  private readonly handleMouseDrag = (event: PointerEvent) => {
    if (!this.dragging) {
      // Start dragging if it hasn't yet
      this.scrollContainer.style.setProperty('scroll-snap-type', 'none');
      this.dragging = true;
      this.dragStartPosition = [event.clientX, event.clientY];
    }

    this.scrollContainer.scrollBy({
      left: -event.movementX,
      top: -event.movementY,
      behavior: 'instant',
    });
  };

  private readonly handleMouseDragEnd = () => {
    const scrollContainer = this.scrollContainer;

    document.removeEventListener('pointermove', this.handleMouseDrag, { capture: true });

    // get the current scroll position
    const startLeft = scrollContainer.scrollLeft;
    const startTop = scrollContainer.scrollTop;

    // remove the scroll-snap-type property so that the browser will snap the slide to the correct position
    scrollContainer.style.removeProperty('scroll-snap-type');

    // fix(safari): forcing a style recalculation doesn't seem to immediately update the scroll
    // position in Safari. Setting "overflow" to "hidden" should force this behavior.
    scrollContainer.style.setProperty('overflow', 'hidden');

    // get the final scroll position to the slide snapped by the browser
    const finalLeft = scrollContainer.scrollLeft;
    const finalTop = scrollContainer.scrollTop;

    // restore the scroll position to the original one, so that it can be smoothly animated if needed
    scrollContainer.style.removeProperty('overflow');
    scrollContainer.style.setProperty('scroll-snap-type', 'none');
    scrollContainer.scrollTo({ left: startLeft, top: startTop, behavior: 'instant' });

    requestAnimationFrame(async () => {
      if (startLeft !== finalLeft || startTop !== finalTop) {
        scrollContainer.scrollTo({
          left: finalLeft,
          top: finalTop,
          behavior: prefersReducedMotion() ? 'auto' : 'smooth',
        });
        await waitForEvent(scrollContainer, 'scrollend');
      }

      scrollContainer.style.removeProperty('scroll-snap-type');

      this.dragging = false;
      this.dragStartPosition = [-1, -1];
      this.handleScrollEnd();
    });
  };

  @eventOptions({ passive: true })
  private handleScroll() {
    this.scrolling = true;
    if (!this.pendingSlideChange) {
      this.synchronizeSlides();
    }
  }

  /** @internal Synchronizes the slides with the IntersectionObserver API. */
  private synchronizeSlides() {
    const io = new IntersectionObserver(
      entries => {
        io.disconnect();

        for (const entry of entries) {
          const slide = entry.target;
          slide.toggleAttribute('inert', !entry.isIntersecting);
          slide.classList.toggle('--in-view', entry.isIntersecting);
          slide.setAttribute('aria-hidden', entry.isIntersecting ? 'false' : 'true');
        }

        const firstIntersecting = entries.find(entry => entry.isIntersecting);
        if (!firstIntersecting) {
          return;
        }

        const slidesWithClones = this.getSlides({ excludeClones: false });
        const slidesCount = this.getSlides().length;

        // Update the current index based on the first visible slide
        const slideIndex = slidesWithClones.indexOf(firstIntersecting.target as VelcroCarouselItem);
        // Normalize the index to ignore clones
        const normalizedIndex = this.loop ? slideIndex - this.slidesPerPage : slideIndex;

        // Set the index to the closest "snappable" slide
        this.activeSlide =
          (Math.ceil(normalizedIndex / this.slidesPerMove) * this.slidesPerMove + slidesCount) % slidesCount;

        if (!this.scrolling) {
          if (this.loop && firstIntersecting.target.hasAttribute('data-clone')) {
            const clonePosition = Number(firstIntersecting.target.getAttribute('data-clone'));

            // Scrolls to the original slide without animating, so the user won't notice that the position has changed
            this.goToSlide(clonePosition, 'instant');
          }
        }
      },
      {
        root: this.scrollContainer,
        threshold: 0.6,
      }
    );

    this.getSlides({ excludeClones: false }).forEach(slide => {
      io.observe(slide);
    });
  }

  private handleScrollEnd() {
    if (!this.scrolling || this.dragging) return;
    this.scrolling = false;
    this.pendingSlideChange = false;
    this.synchronizeSlides();
  }

  private isCarouselItem(node: Node): node is VelcroCarouselItem {
    return node instanceof Element && node.tagName.toLowerCase() === 'sl-carousel-item';
  }

  private readonly handleSlotChange = (mutations: MutationRecord[]) => {
    const needsInitialization = mutations.some(mutation =>
      [...mutation.addedNodes, ...mutation.removedNodes].some(
        (el: Node) => this.isCarouselItem(el) && !el.hasAttribute('data-clone')
      )
    );

    // Reinitialize the carousel if a carousel item has been added or removed
    if (needsInitialization) {
      this.initializeSlides();
    }

    this.requestUpdate();
  };

  public initializeSlides() {
    // Removes all the cloned elements from the carousel
    this.getSlides({ excludeClones: false }).forEach((slide, index) => {
      slide.classList.remove('--in-view');
      slide.classList.remove('--is-active');
      slide.setAttribute('role', 'group');
      slide.setAttribute('aria-label', this.localize.term('slideNum', index + 1));

      if (this.pagination) {
        slide.setAttribute('id', `slide-${index + 1}`);
        slide.setAttribute('role', 'tabpanel');
        slide.removeAttribute('aria-label');
        slide.setAttribute('aria-labelledby', `tab-${index + 1}`);
      }

      if (slide.hasAttribute('data-clone')) {
        slide.remove();
      }
    });

    this.updateSlidesSnap();

    if (this.loop) {
      // Creates clones to be placed before and after the original elements to simulate infinite scrolling
      this.createClones();
    }

    // Because the DOM may be changed, restore the scroll position to the active slide
    this.goToSlide(this.activeSlide, 'auto');

    this.synchronizeSlides();
  }

  private createClones() {
    const slides = this.getSlides();

    const slidesPerPage = this.slidesPerPage;
    const lastSlides = slides.slice(-slidesPerPage);
    const firstSlides = slides.slice(0, slidesPerPage);

    lastSlides.reverse().forEach((slide, i) => {
      const clone = slide.cloneNode(true) as HTMLElement;
      clone.setAttribute('data-clone', String(slides.length - i - 1));
      this.prepend(clone);
    });

    firstSlides.forEach((slide, i) => {
      const clone = slide.cloneNode(true) as HTMLElement;
      clone.setAttribute('data-clone', String(i));
      this.append(clone);
    });
  }

  public handleSlideChange() {
    const slides = this.getSlides();
    slides.forEach((slide, i) => {
      slide.classList.toggle('--is-active', i === this.activeSlide);
    });

    // Do not emit an event on first render
    if (this.hasUpdated) {
      this.emit('sl-slide-change', {
        detail: {
          index: this.activeSlide,
          slide: slides[this.activeSlide],
        },
      });
    }
  }

  public updateSlidesSnap() {
    const slides = this.getSlides();

    const slidesPerMove = this.slidesPerMove;
    slides.forEach((slide, i) => {
      const shouldSnap = (i + slidesPerMove) % slidesPerMove === 0;
      if (shouldSnap) {
        slide.style.removeProperty('scroll-snap-align');
      } else {
        slide.style.setProperty('scroll-snap-align', 'none');
      }
    });
  }

  public handleAutoplayChange() {
    this.autoplayController.stop();
    if (this.autoplay) {
      this.autoplayController.start(this.autoplayInterval);
    }
  }

  /**
   * Move the carousel backward by `slides-per-move` slides.
   *
   * @param behavior - The behavior used for scrolling.
   */
  public previous(behavior: ScrollBehavior = 'smooth') {
    this.goToSlide(this.activeSlide - this.slidesPerMove, behavior);
  }

  /**
   * Move the carousel forward by `slides-per-move` slides.
   *
   * @param behavior - The behavior used for scrolling.
   */
  public next(behavior: ScrollBehavior = 'smooth') {
    this.goToSlide(this.activeSlide + this.slidesPerMove, behavior);
  }

  /**
   * Scrolls the carousel to the slide specified by `index`.
   *
   * @param index - The slide index.
   * @param behavior - The behavior used for scrolling.
   */
  public goToSlide(index: number, behavior: ScrollBehavior = 'smooth') {
    const { slidesPerPage, loop } = this;

    const slides = this.getSlides();
    const slidesWithClones = this.getSlides({ excludeClones: false });

    // No need to do anything in case there are no items in the carousel
    if (!slides.length) {
      return;
    }

    // Sets the next index without taking into account clones, if any.
    const newActiveSlide = loop ? (index + slides.length) % slides.length : clamp(index, 0, slides.length - slidesPerPage);
    this.activeSlide = newActiveSlide;

    const isRtl = this.direction() === 'rtl';

    // Get the index of the next slide. For looping carousel it adds `slidesPerPage`
    // to normalize the starting index in order to ignore the first nth clones.
    // For RTL it needs to scroll to the last slide of the page.
    const nextSlideIndex = clamp(
      index + (loop ? slidesPerPage : 0) + (isRtl ? slidesPerPage - 1 : 0),
      0,
      slidesWithClones.length - 1
    );

    const nextSlide = slidesWithClones[nextSlideIndex];

    this.scrollToSlide(nextSlide, prefersReducedMotion() ? 'auto' : behavior);
  }

  private scrollToSlide(slide: HTMLElement, behavior: ScrollBehavior = 'smooth') {
    // Since the geometry doesn't happen until rAF, we don't know if we'll be scrolling or not...
    // It's best to assume that we will and cleanup in the else case below if we didn't need to
    this.pendingSlideChange = true;
    window.requestAnimationFrame(() => {
      // This can happen if goToSlide is called before the scroll container is rendered
      // We will have correctly set the activeSlide in goToSlide which will get picked up when initializeSlides is called.
      if (!this.scrollContainer) {
        return;
      }

      const scrollContainer = this.scrollContainer;
      const scrollContainerRect = scrollContainer.getBoundingClientRect();
      const nextSlideRect = slide.getBoundingClientRect();

      const nextLeft = nextSlideRect.left - scrollContainerRect.left;
      const nextTop = nextSlideRect.top - scrollContainerRect.top;

      if (nextLeft || nextTop) {
        // This is here just in case someone set it back to false
        // between rAF being requested and the callback actually running
        this.pendingSlideChange = true;
        scrollContainer.scrollTo({
          left: nextLeft + scrollContainer.scrollLeft,
          top: nextTop + scrollContainer.scrollTop,
          behavior,
        });
      } else {
        this.pendingSlideChange = false;
      }
    });
  }

  protected override render() {
    const { slidesPerMove, scrolling } = this;
    const pagesCount = this.getPageCount();
    const currentPage = this.getCurrentPage();
    const prevEnabled = this.canScrollPrev();
    const nextEnabled = this.canScrollNext();
    const isLtr = this.direction() === 'ltr';

    return html`
      <div part="base" class="carousel">
        <div
          id="scroll-container"
          part="scroll-container"
          class="${classMap({
            carousel__slides: true,
            'carousel__slides--horizontal': this.orientation === 'horizontal',
            'carousel__slides--vertical': this.orientation === 'vertical',
            'carousel__slides--dragging': this.dragging,
          })}"
          style="--slides-per-page: ${this.slidesPerPage};"
          aria-busy="${scrolling ? 'true' : 'false'}"
          aria-atomic="true"
          tabindex="0"
          @keydown=${this.handleKeyDown}
          @mousedown="${this.handleMouseDragStart}"
          @scroll="${this.handleScroll}"
          @scrollend=${this.handleScrollEnd}
          @click=${this.handleClick}
        >
          <slot></slot>
        </div>

        ${this.navigation
          ? html`
              <div part="navigation" class="carousel__navigation">
                <button
                  part="navigation-button navigation-button--previous"
                  class="${classMap({
                    'carousel__navigation-button': true,
                    'carousel__navigation-button--previous': true,
                    'carousel__navigation-button--disabled': !prevEnabled,
                  })}"
                  aria-label="${this.localize.term('previousSlide')}"
                  aria-controls="scroll-container"
                  aria-disabled="${prevEnabled ? 'false' : 'true'}"
                  @click=${prevEnabled ? () => this.previous() : null}
                >
                  <slot name="previous-icon">
                    <sl-icon library="system" name="${isLtr ? 'chevron-left' : 'chevron-right'}"></sl-icon>
                  </slot>
                </button>

                <button
                  part="navigation-button navigation-button--next"
                  class=${classMap({
                    'carousel__navigation-button': true,
                    'carousel__navigation-button--next': true,
                    'carousel__navigation-button--disabled': !nextEnabled,
                  })}
                  aria-label="${this.localize.term('nextSlide')}"
                  aria-controls="scroll-container"
                  aria-disabled="${nextEnabled ? 'false' : 'true'}"
                  @click=${nextEnabled ? () => this.next() : null}
                >
                  <slot name="next-icon">
                    <sl-icon library="system" name="${isLtr ? 'chevron-right' : 'chevron-left'}"></sl-icon>
                  </slot>
                </button>
              </div>
            `
          : ''}
        ${this.pagination
          ? html`
              <div part="pagination" role="tablist" class="carousel__pagination">
                ${map(range(pagesCount), index => {
                  const isActive = index === currentPage;
                  return html`
                    <button
                      part="pagination-item ${isActive ? 'pagination-item--active' : ''}"
                      class="${classMap({
                        'carousel__pagination-item': true,
                        'carousel__pagination-item--active': isActive,
                      })}"
                      role="tab"
                      id="tab-${index + 1}"
                      aria-controls="slide-${index + 1}"
                      aria-selected="${isActive ? 'true' : 'false'}"
                      aria-label="${isActive
                        ? this.localize.term('slideNum', index + 1)
                        : this.localize.term('goToSlide', index + 1, pagesCount)}"
                      tabindex=${isActive ? '0' : '-1'}
                      @click=${() => this.goToSlide(index * slidesPerMove)}
                      @keydown=${this.handleKeyDown}
                    ></button>
                  `;
                })}
              </div>
            `
          : ''}
      </div>
    `;
  }
}

export default VelcroCarousel;
