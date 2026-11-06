import { expect, test } from '@playwright/test';
import { buildFixtures, gotoBlank } from './support/fixtures.mjs';

const PAGE = '/components/animation';
const TITLES = ['Overview', 'Animations & Easings', 'Using Intersection Observer', 'Custom Keyframe Formats', 'Playing Animations on Demand'];

async function openExample(page, name = 'Overview') {
  const requests = [];
  page.on('request', request => requests.push(request.url()));
  // Litro's client router remounts the page component once after load, which reloads the iframe; wait for it to settle.
  await page.goto(PAGE, { waitUntil: 'networkidle' });
  const frame = page.frameLocator(`iframe.example[title="Animation example: ${name}"]`);
  await expect(frame.locator('sl-animation').first()).toBeAttached();
  await frame.locator('body').evaluate(() => customElements.whenDefined('sl-animation'));
  await page.waitForLoadState('networkidle');
  return { frame, requests };
}

// Helpers for the evaluated callbacks, installed in every frame (including the srcdoc example documents) as
// window.__animation. `make(markup, before?)` appends the element built from markup (after calling `before` on it) and
// waits for its first update and slotchange; `record(el)` collects the animation events it emits.
const HELPERS = () => {
  const settle = () => new Promise(resolve => setTimeout(resolve, 20));
  window.__animation = {
    get body() {
      return document.body;
    },
    settle,
    async make(markup, before) {
      const host = document.createElement('div');
      host.innerHTML = markup;
      const el = host.firstElementChild;
      before?.(el);
      document.body.append(el);
      await el.updateComplete;
      await settle();
      return el;
    },
    animationsOf: el => el.firstElementChild?.getAnimations() ?? [],
    record(el, names = ['sl-start', 'sl-finish', 'sl-cancel']) {
      const events = [];
      for (const name of names) el.addEventListener(name, () => events.push(name));
      return events;
    },
  };
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(HELPERS);
});

// Runs `fn` in the example document; `fn` reads its helpers from window.__animation.
async function run(frame, fn) {
  return frame.locator('body').evaluate(fn);
}

test('docs page is prerendered with Velcro branding, prototype status, the utilities, quirks and explicit limits', async ({ request }) => {
  const response = await request.get(PAGE);
  expect(response.ok()).toBe(true);
  const html = await response.text();
  expect(html).toContain('<title>Animation - Velcro</title>');
  expect(html).toContain('Velcro is an unreleased prototype');
  expect(html).toContain('Not implemented or unverified');
  expect(html).toContain('Upstream quirks matched');
  expect(html).toContain('getAnimationNames()');
  expect(html).toContain('sl-select');
  expect(html).toContain('iterationsStart');
  expect(html).toContain('without changing the shared core prefix');
  expect(html).not.toMatch(/<(script|link)[^>]*shoelace/i);
  expect(html).not.toMatch(/(src|href)="[^"]*shoelace/i);
  expect(await (await request.get('/')).text()).toContain('/components/animation');
});

test('sl-animation registers as the exported class with no core marker and no ch-* definitions', async ({ page }) => {
  const { frame, requests } = await openExample(page);
  expect(requests.some(url => url.endsWith('/_litro/velcro.js'))).toBe(true);
  const r = await frame.locator('sl-animation').first().evaluate(el => ({
    ctor: customElements.get('sl-animation') === el.constructor,
    baseName: el.constructor.baseName,
    attributes: el.getAttributeNames().sort(),
    chDefined: ['ch-animation'].filter(tag => customElements.get(tag)),
  }));
  expect(r).toEqual({ ctor: true, baseName: 'animation', attributes: ['duration', 'name', 'play'], chDefined: [] });
});

test('structure and styles: one unnamed slot, display: contents, and a hidden host stays display: contents', async ({ page }) => {
  const { frame } = await openExample(page);
  const r = await run(frame, async () => {
    const { make } = window.__animation;
    const el = await make('<sl-animation><div>x</div></sl-animation>');
    const slot = el.shadowRoot.querySelector('slot');
    const out = {
      children: [...el.shadowRoot.children].filter(n => n.localName !== 'style').map(n => n.localName),
      slotName: slot.name,
      part: slot.getAttribute('part'),
      assigned: slot.assignedElements().map(n => n.localName),
      display: getComputedStyle(el).display,
    };
    el.hidden = true;
    out.hiddenDisplay = getComputedStyle(el).display;
    out.defaultSlot = (await el.defaultSlot) === slot;
    el.remove();
    return out;
  });
  expect(r).toEqual({ children: ['slot'], slotName: '', part: null, assigned: ['div'], display: 'contents', hiddenDisplay: 'contents', defaultSlot: true });
});

test('defaults and observed attributes match Shoelace', async ({ page }) => {
  const { frame } = await openExample(page);
  const r = await run(frame, async () => {
    const { make } = window.__animation;
    const el = await make('<sl-animation><div></div></sl-animation>');
    const props = ['name', 'play', 'delay', 'direction', 'duration', 'easing', 'endDelay', 'fill', 'iterations', 'iterationStart', 'keyframes', 'playbackRate', 'currentTime', 'dir', 'lang'];
    const out = {
      values: Object.fromEntries(props.map(p => [p, el[p] === Infinity ? 'Infinity' : el[p] === undefined ? 'undefined' : el[p]])),
      observed: [...el.constructor.observedAttributes].sort(),
      animations: el.firstElementChild.getAnimations().length,
    };
    el.remove();
    return out;
  });
  expect(r.values).toEqual({
    name: 'none', play: false, delay: 0, direction: 'normal', duration: 1000, easing: 'linear', endDelay: 0, fill: 'auto',
    iterations: 'Infinity', iterationStart: 0, keyframes: 'undefined', playbackRate: 1, currentTime: 0, dir: 'undefined', lang: 'undefined',
  });
  expect(r.observed).toEqual(['delay', 'dir', 'direction', 'duration', 'easing', 'end-delay', 'fill', 'iteration-start', 'iterations', 'lang', 'name', 'play', 'playback-rate']);
  // name="none" is no preset, so nothing is animated.
  expect(r.animations).toBe(0);
});

test('attributes become the Element.animate() timing, presets resolve to their keyframes and preset easings to their curves', async ({ page }) => {
  const { frame } = await openExample(page);
  const r = await run(frame, async () => {
    const { make, animationsOf } = window.__animation;
    const el = await make(
      '<sl-animation name="bounce" delay="5" direction="alternate" duration="300" easing="easeInOutCubic" end-delay="7" fill="both" iterations="3" iteration-start="0.5" playback-rate="2"><div></div><div></div></sl-animation>'
    );
    const [animation] = animationsOf(el);
    const { delay, direction, duration, easing, endDelay, fill, iterations, iterationStart } = animation.effect.getTiming();
    const out = {
      count: animationsOf(el).length,
      secondChild: el.children[1].getAnimations().length,
      timing: { delay, direction, duration, easing, endDelay, fill, iterations, iterationStart },
      playbackRate: animation.playbackRate,
      playState: animation.playState,
      keyframes: animation.effect.getKeyframes().length,
      thirdKeyframe: (({ offset, easing }) => ({ offset, easing }))(animation.effect.getKeyframes()[2]),
      props: { endDelay: el.endDelay, iterationStart: el.iterationStart, playbackRate: el.playbackRate, iterations: el.iterations },
    };
    el.easing = 'cubic-bezier(0, 1, .76, 1.14)';
    await el.updateComplete;
    await new Promise(resolve => setTimeout(resolve, 20));
    out.customEasing = animationsOf(el)[0].effect.getTiming().easing;
    el.remove();
    return out;
  });
  expect(r.count).toBe(1);
  // Only the first slotted element is animated.
  expect(r.secondChild).toBe(0);
  expect(r.timing).toEqual({ delay: 5, direction: 'alternate', duration: 300, easing: 'cubic-bezier(0.645, 0.045, 0.355, 1)', endDelay: 7, fill: 'both', iterations: 3, iterationStart: 0.5 });
  expect(r.playbackRate).toBe(2);
  expect(r.playState).toBe('paused');
  // @shoelace-style/animations 1.2.0's bounce has 9 keyframes.
  expect(r.keyframes).toBe(9);
  expect(r.thirdKeyframe).toEqual({ offset: 0.4, easing: 'cubic-bezier(0.755, 0.05, 0.855, 0.06)' });
  expect(r.props).toEqual({ endDelay: 7, iterationStart: 0.5, playbackRate: 2, iterations: 3 });
  expect(r.customEasing).toBe('cubic-bezier(0, 1, 0.76, 1.14)');
});

test('play starts the animation with sl-start; pausing and resuming emit nothing; finishing emits sl-finish and removes play', async ({ page }) => {
  const { frame } = await openExample(page);
  const r = await run(frame, async () => {
    const { make, animationsOf, record, settle } = window.__animation;
    const el = await make('<sl-animation name="pulse" duration="200" iterations="1"><div></div></sl-animation>');
    const events = record(el);
    const details = [];
    el.addEventListener('sl-start', e => details.push({ bubbles: e.bubbles, composed: e.composed, cancelable: e.cancelable, detail: JSON.stringify(e.detail) }));
    const animation = animationsOf(el)[0];
    el.play = true;
    await el.updateComplete;
    const out = { reflected: el.hasAttribute('play'), running: animation.playState };
    el.play = false;
    await el.updateComplete;
    out.paused = animation.playState;
    el.play = true;
    await el.updateComplete;
    out.resumed = animation.playState;
    out.sameAnimation = animationsOf(el)[0] === animation;
    await new Promise(resolve => el.addEventListener('sl-finish', resolve, { once: true }));
    await settle();
    out.afterFinish = { play: el.play, attribute: el.hasAttribute('play'), playState: animation.playState };
    out.events = [...events];
    // Playing again after a finish emits sl-start again and restarts from the beginning.
    el.play = true;
    await el.updateComplete;
    out.restart = { events: [...events], playState: animation.playState, currentTime: el.currentTime < 100 };
    out.details = details;
    el.remove();
    return out;
  });
  expect(r.reflected).toBe(true);
  expect(r.running).toBe('running');
  expect(r.paused).toBe('paused');
  expect(r.resumed).toBe('running');
  expect(r.sameAnimation).toBe(true);
  // Clearing play pauses the finished animation at its end, as in Shoelace.
  expect(r.afterFinish).toEqual({ play: false, attribute: false, playState: 'paused' });
  expect(r.events).toEqual(['sl-start', 'sl-finish']);
  expect(r.restart).toEqual({ events: ['sl-start', 'sl-finish', 'sl-start'], playState: 'running', currentTime: true });
  expect(r.details[0]).toEqual({ bubbles: true, composed: true, cancelable: false, detail: '{}' });
});

test('cancel() emits sl-cancel and removes play; finish() ends a finite animation with sl-finish', async ({ page }) => {
  const { frame } = await openExample(page);
  const r = await run(frame, async () => {
    const { make, settle } = window.__animation;
    const a = await make('<sl-animation name="pulse" duration="5000" play><div></div></sl-animation>');
    const aEvents = [];
    for (const n of ['sl-finish', 'sl-cancel']) a.addEventListener(n, () => aEvents.push(n));
    a.cancel();
    await settle();
    const b = await make('<sl-animation name="pulse" duration="5000" iterations="1" play><div></div></sl-animation>');
    const bEvents = [];
    for (const n of ['sl-finish', 'sl-cancel']) b.addEventListener(n, () => bEvents.push(n));
    b.finish();
    await settle();
    const out = { a: { events: aEvents, play: a.play, attribute: a.hasAttribute('play') }, b: { events: bEvents, play: b.play } };
    // Methods are no-ops before an animation exists.
    const c = document.createElement('sl-animation');
    c.cancel();
    c.finish();
    out.noAnimation = c.currentTime;
    a.remove();
    b.remove();
    return out;
  });
  expect(r).toEqual({ a: { events: ['sl-cancel'], play: false, attribute: false }, b: { events: ['sl-finish'], play: false }, noAnimation: 0 });
});

test('playbackRate updates the running animation in place; other properties and keyframes recreate it', async ({ page }) => {
  const { frame } = await openExample(page);
  const r = await run(frame, async () => {
    const { make, animationsOf, settle } = window.__animation;
    const el = await make('<sl-animation name="bounce" duration="5000"><div></div></sl-animation>');
    const first = animationsOf(el)[0];
    el.playbackRate = 0.5;
    await el.updateComplete;
    await settle();
    const out = { inPlace: animationsOf(el)[0] === first, rate: first.playbackRate };
    el.name = 'jello';
    await el.updateComplete;
    await settle();
    const second = animationsOf(el)[0];
    out.recreated = second !== first && first.playState === 'idle' && animationsOf(el).length === 1;
    out.rateKept = second.playbackRate;
    el.keyframes = [{ opacity: 0 }, { opacity: 1 }];
    await el.updateComplete;
    await settle();
    out.custom = animationsOf(el)[0].effect.getKeyframes().map(k => k.opacity);
    el.keyframes = undefined;
    await el.updateComplete;
    await settle();
    out.backToName = animationsOf(el)[0].effect.getKeyframes().length;
    el.remove();
    return out;
  });
  expect(r).toEqual({ inPlace: true, rate: 0.5, recreated: true, rateKept: 0.5, custom: ['0', '1'], backToName: 10 });
});

test('currentTime reads and seeks the animation; without an animation it reads 0 and ignores writes', async ({ page }) => {
  const { frame } = await openExample(page);
  const r = await run(frame, async () => {
    const { make } = window.__animation;
    const el = await make('<sl-animation name="bounce" duration="1000"><div></div></sl-animation>');
    el.currentTime = 250;
    const seeked = el.currentTime;
    const none = await make('<sl-animation><div></div></sl-animation>');
    none.currentTime = 300;
    const out = { seeked, none: none.currentTime };
    el.remove();
    none.remove();
    return out;
  });
  expect(r).toEqual({ seeked: 250, none: 0 });
});

test('the first slotted element is animated: text is ignored, no element means no animation, and a new child takes over', async ({ page }) => {
  const { frame } = await openExample(page);
  const r = await run(frame, async () => {
    const { make, settle } = window.__animation;
    const el = await make('<sl-animation name="bounce">text only</sl-animation>');
    const out = { textOnly: el.getAnimations({ subtree: true }).length };
    const first = document.createElement('p');
    el.append(first);
    await settle();
    out.appended = first.getAnimations().length;
    const second = document.createElement('span');
    el.prepend(second);
    await settle();
    out.moved = { first: first.getAnimations().length, second: second.getAnimations().length };
    el.remove();
    return out;
  });
  expect(r).toEqual({ textOnly: 0, appended: 1, moved: { first: 0, second: 1 } });
});

test('dir and lang are reactive, unreflected and returned as set', async ({ page }) => {
  const { frame } = await openExample(page);
  const r = await run(frame, async () => {
    const { make } = window.__animation;
    const el = await make('<sl-animation dir="rtl" lang="de"><div></div></sl-animation>');
    const out = { dir: el.dir, lang: el.lang };
    el.dir = 'sideways';
    el.lang = 'fr';
    await el.updateComplete;
    out.set = { dir: el.dir, lang: el.lang, dirAttr: el.getAttribute('dir'), langAttr: el.getAttribute('lang') };
    el.remove();
    return out;
  });
  expect(r).toEqual({ dir: 'rtl', lang: 'de', set: { dir: 'sideways', lang: 'fr', dirAttr: 'rtl', langAttr: 'de' } });
});

test('the core ready event fires once, without bubbling', async ({ page }) => {
  const { frame } = await openExample(page);
  const r = await run(frame, async () => {
    const { body } = window.__animation;
    const el = document.createElement('sl-animation');
    const seen = [];
    let bubbled = 0;
    el.addEventListener('ready', event => seen.push({ bubbles: event.bubbles, composed: event.composed }));
    body.addEventListener('ready', () => bubbled++);
    body.append(el);
    await el.updateComplete;
    el.name = 'bounce';
    await el.updateComplete;
    el.remove();
    return { seen, bubbled };
  });
  expect(r).toEqual({ seen: [{ bubbles: false, composed: false }], bubbled: 0 });
});

test.describe('upstream quirks', () => {
  test('a playing animation emits sl-start twice when first connected (once more on each reconnect)', async ({ page }) => {
    const { frame } = await openExample(page);
    const r = await run(frame, async () => {
      const { make, record, settle, body } = window.__animation;
      let events;
      const el = await make('<sl-animation name="pulse" duration="5000" play><div></div></sl-animation>', e => (events = record(e)));
      const out = { connect: [...events] };
      el.remove();
      await settle();
      body.append(el);
      await settle();
      out.reconnect = [...events];
      el.remove();
      return out;
    });
    // A reconnect has no slotchange (the shadow tree is unchanged), so it creates the animation once.
    expect(r).toEqual({ connect: ['sl-start', 'sl-start'], reconnect: ['sl-start', 'sl-start', 'sl-start'] });
  });

  test('each animation property changed in the same update recreates the animation once more', async ({ page }) => {
    const { frame } = await openExample(page);
    const r = await run(frame, async () => {
      const { make, record, settle } = window.__animation;
      const el = await make('<sl-animation name="pulse" duration="5000" play><div></div></sl-animation>');
      const events = record(el, ['sl-start']);
      el.name = 'jello';
      await el.updateComplete;
      await settle();
      const one = events.length;
      el.name = 'bounce';
      el.duration = 4000;
      await el.updateComplete;
      await settle();
      const two = events.length - one;
      el.remove();
      return { one, two };
    });
    expect(r).toEqual({ one: 1, two: 2 });
  });

  test('iterationStart changes after the first update are not applied until something else recreates the animation', async ({ page }) => {
    const { frame } = await openExample(page);
    const r = await run(frame, async () => {
      const { make, animationsOf, settle } = window.__animation;
      const el = await make('<sl-animation name="bounce" duration="5000"><div></div></sl-animation>');
      const first = animationsOf(el)[0];
      el.setAttribute('iteration-start', '0.5');
      await el.updateComplete;
      await settle();
      const out = { property: el.iterationStart, same: animationsOf(el)[0] === first, timing: first.effect.getTiming().iterationStart };
      el.duration = 4000;
      await el.updateComplete;
      await settle();
      out.afterDuration = animationsOf(el)[0].effect.getTiming().iterationStart;
      el.remove();
      return out;
    });
    expect(r).toEqual({ property: 0.5, same: true, timing: 0, afterDuration: 0.5 });
  });

  test('finish() throws an InvalidStateError while iterations is Infinity', async ({ page }) => {
    const { frame } = await openExample(page);
    const r = await run(frame, async () => {
      const { make } = window.__animation;
      const el = await make('<sl-animation name="bounce" play><div></div></sl-animation>');
      let error = null;
      try {
        el.finish();
      } catch (e) {
        error = e.name;
      }
      el.remove();
      return error;
    });
    expect(r).toBe('InvalidStateError');
  });

  test('disconnecting cancels without sl-cancel, keeps play, and currentTime reads 0 until reconnected', async ({ page }) => {
    const { frame } = await openExample(page);
    const r = await run(frame, async () => {
      const { make, record, animationsOf, settle, body } = window.__animation;
      const el = await make('<sl-animation name="pulse" duration="5000" play><div></div></sl-animation>');
      const events = record(el);
      el.currentTime = 1000;
      const animation = animationsOf(el)[0];
      el.remove();
      await settle();
      const out = { events: [...events], play: el.play, attribute: el.hasAttribute('play'), currentTime: el.currentTime, state: animation.playState };
      body.append(el);
      await settle();
      const next = animationsOf(el)[0];
      out.reconnected = { fresh: next !== animation, state: next.playState, early: el.currentTime < 1000 };
      el.remove();
      return out;
    });
    expect(r).toEqual({
      events: [], play: true, attribute: true, currentTime: 0, state: 'idle',
      reconnected: { fresh: true, state: 'running', early: true },
    });
  });

  test('a rejected easing cancels the previous animation, creates none and surfaces only as an unhandled rejection', async ({ page }) => {
    const { frame } = await openExample(page);
    const r = await run(frame, async () => {
      const { make, animationsOf, settle } = window.__animation;
      const rejections = [];
      const onRejection = event => {
        rejections.push(event.reason?.name);
        event.preventDefault();
      };
      window.addEventListener('unhandledrejection', onRejection);
      const el = await make('<sl-animation name="bounce" duration="5000" play><div></div></sl-animation>');
      const first = animationsOf(el)[0];
      el.easing = 'not-an-easing';
      await el.updateComplete;
      await settle();
      const out = { invalid: { previous: first.playState, animations: animationsOf(el).length, play: el.play } };
      el.easing = 'linear';
      await el.updateComplete;
      await settle();
      out.recovered = animationsOf(el).length;
      el.easing = 'toString';
      await el.updateComplete;
      await settle();
      out.prototypeMember = animationsOf(el).length;
      out.rejections = rejections;
      window.removeEventListener('unhandledrejection', onRejection);
      el.remove();
      return out;
    });
    expect(r).toEqual({ invalid: { previous: 'idle', animations: 0, play: true }, recovered: 1, prototypeMember: 0, rejections: ['TypeError', 'TypeError'] });
  });

  test('name="easings" animates the easings table, which changes nothing, and is not an animation name', async ({ page }) => {
    const { frame } = await openExample(page);
    const r = await run(frame, async () => {
      const { make, animationsOf } = window.__animation;
      const el = await make('<sl-animation name="easings" duration="5000" play><div></div></sl-animation>');
      const animations = animationsOf(el);
      const keyframes = animations[0].effect.getKeyframes().length;
      const { getAnimationNames } = await import(document.querySelector('script[src$="/_litro/velcro.js"]').src);
      el.remove();
      return { count: animations.length, keyframes, listed: getAnimationNames().includes('easings') };
    });
    // The easings object is read as property-indexed keyframes with no CSS properties, so the effect has no keyframes.
    expect(r).toEqual({ count: 1, keyframes: 0, listed: false });
  });

  test('null play restores the value recorded at the first attribute change', async ({ page }) => {
    const { frame } = await openExample(page);
    const r = await run(frame, async () => {
      const { make } = window.__animation;
      const a = await make('<sl-animation play name="bounce"><div></div></sl-animation>');
      a.play = null;
      await a.updateComplete;
      const b = document.createElement('sl-animation');
      b.play = true;
      b.setAttribute('name', 'bounce');
      document.body.append(b);
      await b.updateComplete;
      b.play = null;
      await b.updateComplete;
      const c = await make('<sl-animation play><div></div></sl-animation>');
      c.removeAttribute('play');
      await c.updateComplete;
      const out = { a: a.play, b: [b.play, b.hasAttribute('play')], removed: c.play };
      a.remove();
      b.remove();
      c.remove();
      return out;
    });
    expect(r).toEqual({ a: false, b: [true, true], removed: false });
  });
});

test.describe('utilities and entry points', () => {
  let outDir;
  test.beforeAll(async () => {
    outDir = await buildFixtures({
      root: "export * from '@charm-ux/velcro';",
      animation: "export * from '@charm-ux/velcro/animation';",
      animationClass: "export * from '@charm-ux/velcro/animation/class';",
    });
  });

  test('getAnimationNames and getEasingNames come from the root, ./animation and ./animation/class with the 1.2.0 presets', async ({ page }) => {
    await gotoBlank(page, outDir);
    const r = await page.evaluate(async () => {
      const classOnly = await import('/animationClass.js');
      const definedBeforeRegistering = customElements.get('sl-animation') !== undefined;
      const entry = await import('/animation.js');
      const root = await import('/root.js');
      const names = root.getAnimationNames();
      const easings = root.getEasingNames();
      return {
        definedBeforeRegistering,
        same: [entry, classOnly].every(m => m.getAnimationNames === root.getAnimationNames && m.getEasingNames === root.getEasingNames),
        alias: classOnly.SlAnimation === classOnly.VelcroAnimation && classOnly.default === undefined,
        registered: customElements.get('sl-animation') === root.VelcroAnimation,
        names: names.length,
        sorted: names.join() === [...names].sort().join(),
        firstNames: names.slice(0, 2),
        includes: ['bounce', 'jello', 'heartBeat', 'flip', 'jackInTheBox', 'rubberBand', 'pulse'].every(n => names.includes(n)),
        easings: easings.length,
        firstEasings: easings.slice(0, 3),
        easeInOutCubic: easings.includes('easeInOutCubic'),
        animationsExported: 'animations' in root,
      };
    });
    expect(r).toEqual({
      definedBeforeRegistering: false, same: true, alias: true, registered: true, names: 98, sorted: true,
      firstNames: ['backInDown', 'backInLeft'], includes: true, easings: 29, firstEasings: ['linear', 'ease', 'easeIn'],
      easeInOutCubic: true, animationsExported: false,
    });
  });
});

test('every docs example renders in its own document', async ({ page }) => {
  await page.goto(PAGE, { waitUntil: 'networkidle' });
  const titles = await page.locator('iframe.example').evaluateAll(frames => frames.map(f => f.title));
  expect(titles).toEqual(TITLES.map(t => `Animation example: ${t}`));
  for (const title of titles) {
    const frame = page.frameLocator(`iframe.example[title="${title}"]`);
    await expect(frame.locator('sl-animation').first()).toBeAttached();
    await frame.locator('body').evaluate(() => customElements.whenDefined('sl-animation'));
  }
});

test('overview: the four presets play', async ({ page }) => {
  const { frame } = await openExample(page);
  await expect.poll(() =>
    frame.locator('body').evaluate(() => [...document.querySelectorAll('sl-animation')].map(a => `${a.name}:${a.firstElementChild.getAnimations()[0]?.playState}`))
  ).toEqual(['bounce:running', 'jello:running', 'heartBeat:running', 'flip:running']);
});

test('animations & easings: the pickers list every preset and easing and drive the animation', async ({ page }) => {
  const { frame } = await openExample(page, 'Animations & Easings');
  await expect(frame.locator('.animation-name option')).toHaveCount(98);
  await expect(frame.locator('.easing-name option')).toHaveCount(29);
  await expect(frame.locator('.animation-name')).toHaveValue('bounce');
  await expect(frame.locator('.easing-name')).toHaveValue('linear');
  await frame.locator('.animation-name').selectOption('tada');
  await frame.locator('.easing-name').selectOption('easeInOutCubic');
  await frame.locator('input[type="number"]').fill('1.5');
  const read = () => frame.locator('sl-animation').evaluate(el => {
    const animation = el.firstElementChild.getAnimations()[0];
    return { name: el.name, easing: animation?.effect.getTiming().easing, rate: animation?.playbackRate, state: animation?.playState };
  });
  await expect.poll(read).toEqual({ name: 'tada', easing: 'cubic-bezier(0.645, 0.045, 0.355, 1)', rate: 1.5, state: 'running' });
});

test('intersection observer: the animation plays while the box is in view and rewinds when it leaves', async ({ page }) => {
  const { frame } = await openExample(page, 'Using Intersection Observer');
  const iframe = page.locator('iframe.example[title="Animation example: Using Intersection Observer"]');
  const state = () => frame.locator('sl-animation').evaluate(el => ({ play: el.play, time: el.currentTime }));
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await iframe.scrollIntoViewIfNeeded();
  await expect.poll(async () => (await state()).play).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect.poll(async () => {
    const box = await iframe.boundingBox();
    const viewport = page.viewportSize();
    return box.y + box.height < 0 || box.y > viewport.height ? await state() : 'visible';
  }).toEqual({ play: false, time: 0 });
});

test('custom keyframes: the keyframes property replaces the name', async ({ page }) => {
  const { frame } = await openExample(page, 'Custom Keyframe Formats');
  await expect.poll(() => frame.locator('sl-animation').evaluate(el => {
    const animation = el.firstElementChild.getAnimations()[0];
    return animation ? { last: animation.effect.getKeyframes().at(-1).transform, easing: animation.effect.getTiming().easing, state: animation.playState } : null;
  })).toEqual({ last: 'rotate(90deg)', easing: 'ease-in-out', state: 'running' });
});

test('on demand: clicking the button plays the animation once and play is removed when it finishes', async ({ page }) => {
  const { frame } = await openExample(page, 'Playing Animations on Demand');
  const animation = frame.locator('sl-animation');
  await expect(animation).not.toHaveAttribute('play');
  await animation.evaluate(el => {
    window.__events = [];
    for (const name of ['sl-start', 'sl-finish']) el.addEventListener(name, () => window.__events.push(name));
  });
  await frame.locator('sl-button').click();
  await expect(animation).toHaveAttribute('play');
  await expect(animation).not.toHaveAttribute('play');
  expect(await animation.evaluate(() => window.__events)).toEqual(['sl-start', 'sl-finish']);
});

test('no upstream Shoelace runtime is requested or defined; all requests stay on the local origin', async ({ page }) => {
  const { frame, requests } = await openExample(page, 'Animations & Easings');
  expect(requests.filter(url => /shoelace/i.test(url))).toEqual([]);
  const origin = new URL(page.url()).origin;
  expect(requests.every(url => url.startsWith(origin) || url.startsWith('about:') || url.startsWith('data:'))).toBe(true);
  expect(await frame.locator('body').evaluate(() => Boolean(window.Shoelace || document.querySelector('script[src*="shoelace"]')))).toBe(false);
});
