// Type-level check of <sl-animation>'s public members against Shoelace 2.20.1's SlAnimation, and of the two
// non-registering module entries against Shoelace's dist/components/animation/animations.js and
// dist/utilities/animation.js. The entries are imported by package name, so the export map and its .d.ts targets are
// what is checked. Compiled (never run) by `tsc -p tsconfig.react.json` as the last step of the library build.
import type { SlAnimation, VelcroAnimation } from '@charm-ux/velcro/animation/class';
import { animations, getAnimationNames, getEasingNames } from '@charm-ux/velcro/animation/animations';
import * as utilities from '@charm-ux/velcro/utilities/animation';

// Every member SlAnimation declares without `private` (Shoelace's own render() included). Pick<> only accepts public
// keys, so a member that is protected, private or missing here fails to compile.
type ShoelacePublicMembers =
  | 'defaultSlot'
  | 'name'
  | 'play'
  | 'delay'
  | 'direction'
  | 'duration'
  | 'easing'
  | 'endDelay'
  | 'fill'
  | 'iterations'
  | 'iterationStart'
  | 'keyframes'
  | 'playbackRate'
  | 'currentTime'
  | 'connectedCallback'
  | 'disconnectedCallback'
  | 'handleAnimationChange'
  | 'handlePlayChange'
  | 'handlePlaybackRateChange'
  | 'cancel'
  | 'finish'
  | 'render'
  | 'dir'
  | 'lang';

declare const element: SlAnimation;
const members: Pick<VelcroAnimation, ShoelacePublicMembers> = element;
void members;

const rendered: unknown = element.render();
const slot: Promise<HTMLSlotElement> = element.defaultSlot;
const time: CSSNumberish = element.currentTime;
element.currentTime = 500;
const keyframes: Keyframe[] | undefined = element.keyframes;
const direction: PlaybackDirection = element.direction;
const fill: FillMode = element.fill;
void [rendered, slot, time, keyframes, direction, fill];

// @ts-expect-error createAnimation() is private, as in Shoelace.
element.createAnimation();

// dist/components/animation/animations.js: the animations namespace and the two utilities.
const names: string[] = getAnimationNames();
const easingNames: string[] = getEasingNames();
const bounce: Keyframe[] = animations.bounce;
const easeInOutCubic: string = animations.easings.easeInOutCubic;
void [names, easingNames, bounce, easeInOutCubic];

// dist/utilities/animation.js: the two utilities only.
const utilityNames: string[] = utilities.getAnimationNames();
const utilityEasings: string[] = utilities.getEasingNames();
void [utilityNames, utilityEasings];
// @ts-expect-error the utility entry does not expose the animations namespace, as in Shoelace.
void utilities.animations;
