// Adapted from Shoelace v2.20.1 (src/components/animation/animation.component.ts, the `@watch` decorator in
// src/internal/watch.ts and the reflected-property restore in src/internal/shoelace-element.ts), Copyright (c) 2020
// A Beautiful Site, LLC, MIT License. See THIRD_PARTY_NOTICES.md. The API documentation wording, the rendered structure
// (one default slot), the Web Animations API calls, the preset and easing lookup, the `sl-start`, `sl-finish` and
// `sl-cancel` events and the restore of reflected properties' initial values follow Shoelace. Velcro changes: built on
// the @charm-ux/core base element, and Shoelace's three `@watch` handlers are run from `update()` in the order the
// decorators run them. Shoelace's behavior is matched exactly, including its quirks; each one is marked "Upstream quirk"
// below and listed on the docs page.
import { html, type PropertyValues } from 'lit';
import { property, queryAsync } from 'lit/decorators.js';
import { CharmElement } from '@charm-ux/core/dist/base/index.js';
import { animations } from './animations.js';
import styles from './animation.styles.js';

// The properties whose change recreates the animation, in Shoelace's order. Upstream quirk: Shoelace lists
// `iterationsStart`, which is not a property, so a change to `iterationStart` after the first update does not recreate
// the animation. Each listed property that changed in one update recreates it once more (see `update`).
const ANIMATION_PROPERTIES = [
  'name',
  'delay',
  'direction',
  'duration',
  'easing',
  'endDelay',
  'fill',
  'iterations',
  'iterationsStart',
  'keyframes',
] as const;

/**
 * Animate elements declaratively with nearly 100 baked-in presets, or roll your own with custom keyframes. Powered by
 * the [Web Animations API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Animations_API). API modelled on
 * Shoelace's `sl-animation`. There is no core counterpart, so it extends the core base element.
 *
 * Velcro extension inherited from the core base element: the non-bubbling `ready` event on first update.
 *
 * @tag sl-animation
 * @status prototype
 *
 * @event sl-cancel - Emitted when the animation is canceled.
 * @event sl-finish - Emitted when the animation finishes.
 * @event sl-start - Emitted when the animation starts or restarts.
 *
 * @slot - The element to animate. Avoid slotting in more than one element, as subsequent ones will be ignored. To
 *  animate multiple elements, either wrap them in a single container or use multiple `<sl-animation>` elements.
 */
export class VelcroAnimation extends CharmElement {
  public static override baseName = 'animation';

  // Core's base styles are replaced by Shoelace's own (see the styles file). The only core rule that can apply to this
  // template is `:host([hidden]) { display: none !important }`, which Shoelace does not have.
  public static override styles = [styles];

  private animation?: Animation;

  private hasStarted = false;

  private hasRecordedInitialProperties = false;

  private readonly initialReflectedProperties = new Map<string, unknown>();

  private velcroDir?: string;

  /** @internal Resolves to the default slot once the element has rendered (Shoelace's public `defaultSlot`). */
  @queryAsync('slot')
  public defaultSlot!: Promise<HTMLSlotElement>;

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

  /** The name of the built-in animation to use. For custom animations, use the `keyframes` prop. */
  @property()
  public name = 'none';

  /**
   * Plays the animation. When omitted, the animation will be paused. This attribute will be automatically removed when
   * the animation finishes or gets canceled.
   */
  @property({ type: Boolean, reflect: true })
  public play = false;

  /** The number of milliseconds to delay the start of the animation. */
  @property({ type: Number })
  public delay = 0;

  /**
   * Determines the direction of playback as well as the behavior when reaching the end of an iteration.
   * [Learn more](https://developer.mozilla.org/en-US/docs/Web/CSS/animation-direction)
   */
  @property()
  public direction: PlaybackDirection = 'normal';

  /** The number of milliseconds each iteration of the animation takes to complete. */
  @property({ type: Number })
  public duration = 1000;

  /**
   * The easing function to use for the animation. This can be a Shoelace easing function or a custom easing function
   * such as `cubic-bezier(0, 1, .76, 1.14)`.
   */
  @property()
  public easing = 'linear';

  /** The number of milliseconds to delay after the active period of an animation sequence. */
  @property({ attribute: 'end-delay', type: Number })
  public endDelay = 0;

  /** Sets how the animation applies styles to its target before and after its execution. */
  @property()
  public fill: FillMode = 'auto';

  /** The number of iterations to run before the animation completes. Defaults to `Infinity`, which loops. */
  @property({ type: Number })
  public iterations = Infinity;

  /** The offset at which to start the animation, usually between 0 (start) and 1 (end). */
  @property({ attribute: 'iteration-start', type: Number })
  public iterationStart = 0;

  /** The keyframes to use for the animation. If this is set, `name` will be ignored. */
  @property({ attribute: false })
  public keyframes?: Keyframe[];

  /**
   * Sets the animation's playback rate. The default is `1`, which plays the animation at a normal speed. Setting this
   * to `2`, for example, will double the animation's speed. A negative value can be used to reverse the animation. This
   * value can be changed without causing the animation to restart.
   */
  @property({ attribute: 'playback-rate', type: Number })
  public playbackRate = 1;

  /** Gets and sets the current animation time. */
  public get currentTime(): CSSNumberish {
    return this.animation?.currentTime ?? 0;
  }

  public set currentTime(time: number) {
    if (this.animation) {
      this.animation.currentTime = time;
    }
  }

  // Upstream behavior: the first time any observed attribute changes (including `dir` and `lang`), the values of all
  // reflected properties that are not null are recorded, and when one of them later becomes null it is set back to the
  // recorded value. `play` is the only reflected property; removing its attribute makes it `false`, never null, so only
  // assigning `null` to it is affected.
  public override attributeChangedCallback(name: string, previous: string | null, next: string | null) {
    if (!this.hasRecordedInitialProperties) {
      (this.constructor as typeof VelcroAnimation).elementProperties.forEach((options, prop) => {
        // Reflection is checked first, as upstream does, so that a non-reflected property's getter is not read here.
        if (options.reflect) {
          const current = (this as unknown as Record<PropertyKey, unknown>)[prop];
          if (current != null) {
            this.initialReflectedProperties.set(prop as string, current);
          }
        }
      });
      this.hasRecordedInitialProperties = true;
    }
    super.attributeChangedCallback(name, previous, next);
  }

  // Upstream quirk: the animation is created here and again when the slot first reports its content, so a playing
  // animation emits `sl-start` twice when it is first connected. A reconnect has no slot change, so it emits it once.
  public override connectedCallback() {
    super.connectedCallback();
    void this.createAnimation();
  }

  // Upstream quirk: the canceled animation is kept rather than cleared, and `play` is not cleared either, so
  // `currentTime` reads 0 (its time is null) while the element is disconnected.
  public override disconnectedCallback() {
    super.disconnectedCallback();
    this.destroyAnimation();
  }

  protected override willUpdate(changed: PropertyValues<this>) {
    super.willUpdate(changed);
    this.initialReflectedProperties.forEach((value, prop) => {
      const self = this as unknown as Record<string, unknown>;
      if (changed.has(prop as keyof VelcroAnimation) && self[prop] == null) {
        self[prop] = value;
      }
    });
  }

  // Shoelace's three `@watch` handlers, in the order its decorators run them: playback rate, then play, then each
  // animation property in list order. They run before the render, including on the first update.
  protected override update(changed: PropertyValues<this>) {
    const self = this as unknown as Record<string, unknown>;
    const watched = (prop: string) => changed.has(prop as keyof VelcroAnimation) && changed.get(prop as keyof VelcroAnimation) !== self[prop];
    if (watched('playbackRate')) {
      this.handlePlaybackRateChange();
    }
    if (watched('play')) {
      this.handlePlayChange();
    }
    for (const prop of ANIMATION_PROPERTIES) {
      if (watched(prop)) {
        this.handleAnimationChange();
      }
    }
    super.update(changed);
  }

  private handleAnimationFinish = () => {
    this.play = false;
    this.hasStarted = false;
    this.emit('sl-finish');
  };

  private handleAnimationCancel = () => {
    this.play = false;
    this.hasStarted = false;
    this.emit('sl-cancel');
  };

  private handleSlotChange() {
    this.destroyAnimation();
    void this.createAnimation();
  }

  // Upstream quirks: this is asynchronous and not awaited, so an easing or keyframes that `Element.animate()` rejects
  // become an unhandled promise rejection (after the previous animation was already canceled). The easing is looked up
  // on a plain object, so an `easing` named after an `Object.prototype` member (such as `toString`) resolves to that
  // function and is rejected the same way. `name="easings"` uses the easings object as property-indexed keyframes,
  // which animate nothing.
  private async createAnimation() {
    const easing = animations.easings[this.easing] ?? this.easing;
    const keyframes = this.keyframes ?? (animations as unknown as Partial<Record<string, Keyframe[]>>)[this.name];
    const slot = await this.defaultSlot;
    const element = slot.assignedElements()[0] as HTMLElement | undefined;

    if (!element || !keyframes) {
      return false;
    }

    this.destroyAnimation();
    this.animation = element.animate(keyframes, {
      delay: this.delay,
      direction: this.direction,
      duration: this.duration,
      easing,
      endDelay: this.endDelay,
      fill: this.fill,
      iterationStart: this.iterationStart,
      iterations: this.iterations,
    });
    this.animation.playbackRate = this.playbackRate;
    this.animation.addEventListener('cancel', this.handleAnimationCancel);
    this.animation.addEventListener('finish', this.handleAnimationFinish);

    if (this.play) {
      this.hasStarted = true;
      this.emit('sl-start');
    } else {
      this.animation.pause();
    }

    return true;
  }

  private destroyAnimation() {
    if (this.animation) {
      this.animation.cancel();
      this.animation.removeEventListener('cancel', this.handleAnimationCancel);
      this.animation.removeEventListener('finish', this.handleAnimationFinish);
      this.hasStarted = false;
    }
  }

  /** @internal Recreates the animation after the first update (Shoelace's public `@watch` handler). */
  public handleAnimationChange() {
    if (!this.hasUpdated) {
      return;
    }

    void this.createAnimation();
  }

  /** @internal Plays or pauses the animation (Shoelace's public `@watch('play')` handler). */
  public handlePlayChange() {
    if (this.animation) {
      if (this.play && !this.hasStarted) {
        this.hasStarted = true;
        this.emit('sl-start');
      }

      if (this.play) {
        this.animation.play();
      } else {
        this.animation.pause();
      }

      return true;
    }
    return false;
  }

  /** @internal Applies `playbackRate` without restarting (Shoelace's public `@watch('playbackRate')` handler). */
  public handlePlaybackRateChange() {
    if (this.animation) {
      this.animation.playbackRate = this.playbackRate;
    }
  }

  /** Clears all keyframe effects caused by this animation and aborts its playback. */
  public cancel() {
    this.animation?.cancel();
  }

  // Upstream quirk: with the default infinite `iterations` the Web Animations API cannot finish the animation, so this
  // throws an `InvalidStateError`.
  /** Sets the playback time to the end of the animation corresponding to the current playback direction. */
  public finish() {
    this.animation?.finish();
  }

  protected override render() {
    return html` <slot @slotchange=${this.handleSlotChange}></slot> `;
  }
}

export default VelcroAnimation;
