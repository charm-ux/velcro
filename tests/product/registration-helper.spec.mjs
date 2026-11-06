import { expect, test } from '@playwright/test';
import { buildFixtures, gotoBlank } from './support/fixtures.mjs';

// Needs the built library: `pnpm --filter @charm-ux/velcro run build` (verify:product does this first).
let outDir;
test.beforeAll(async () => {
  outDir = await buildFixtures({
    helper: "export * from 'velcro-internal:utilities/registration';",
    coreProject: "export { project } from 'core-internal:utilities/project';",
    coreButton: "export * from 'core-internal:components/button/index';",
    scope: "export * from 'velcro-internal:internal/scope';",
    coreSwitchClass: "export { CoreSwitch } from 'core-internal:components/switch/switch';",
    coreIconClass: "export { CoreIcon } from 'core-internal:components/icon/icon';",
  });
});

test.beforeEach(async ({ page }) => {
  await gotoBlank(page, outDir);
});

// Each case runs in its own page, so the registry starts empty.
const load = page => page.evaluate(async () => {
  const mod = await import('/helper.js');
  window.define = mod.defineVelcroComponent;
  window.make = (baseName, parent = HTMLElement) => {
    const Cls = class extends parent {};
    if (baseName !== undefined) Cls.baseName = baseName;
    return Cls;
  };
});

test('importing the helper has no side effects', async ({ page }) => {
  const defined = await page.evaluate(async () => {
    const before = customElements.get('sl-x');
    await import('/helper.js');
    return [before, customElements.get('sl-x')];
  });
  expect(defined).toEqual([undefined, undefined]);
});

test('defines the actual constructor as sl-<baseName> and returns the tag', async ({ page }) => {
  await load(page);
  const r = await page.evaluate(() => {
    const A = make('x-thing');
    const tag = define(A);
    const el = new A();
    return {
      tag,
      same: customElements.get('sl-x-thing') === A,
      isInstance: el instanceof A,
      localName: el.localName,
      created: document.createElement('sl-x-thing') instanceof A,
    };
  });
  expect(r).toEqual({ tag: 'sl-x-thing', same: true, isInstance: true, localName: 'sl-x-thing', created: true });
});

test('registering the same constructor again is idempotent', async ({ page }) => {
  await load(page);
  const r = await page.evaluate(() => {
    const A = make('idem');
    return [define(A), define(A), define(A), customElements.get('sl-idem') === A];
  });
  expect(r).toEqual(['sl-idem', 'sl-idem', 'sl-idem', true]);
});

test('a different constructor for the same tag is a clear collision and the registry is unchanged', async ({ page }) => {
  await load(page);
  const r = await page.evaluate(() => {
    const Foreign = make();
    customElements.define('sl-clash', Foreign);
    const Ours = make('clash');
    let error;
    try {
      define(Ours);
    } catch (e) {
      error = { name: e.name, message: e.message };
    }
    const Second = make('twice');
    define(make('twice'));
    let second;
    try {
      define(Second);
    } catch (e) {
      second = e.message;
    }
    return { error, kept: customElements.get('sl-clash') === Foreign, second };
  });
  expect(r.error.name).toBe('Error');
  expect(r.error.message).toContain('<sl-clash>');
  expect(r.error.message).toContain('already defined by a different constructor');
  expect(r.kept).toBe(true);
  expect(r.second).toContain('<sl-twice>');
});

test('a constructor already registered under another tag is rejected with a generic error that keeps the native cause', async ({ page }) => {
  await load(page);
  const r = await page.evaluate(() => {
    const A = make('moved');
    customElements.define('other-tag', A);
    try {
      define(A);
    } catch (e) {
      return { message: e.message, cause: e.cause?.name, registered: customElements.get('sl-moved') };
    }
    return 'no error';
  });
  expect(r.message).toContain('<sl-moved>');
  expect(r.message).toContain('customElements.define failed');
  expect(r.cause).toBe('NotSupportedError');
  expect(r.registered).toBeUndefined();
});

test('an exception from native define metadata is not misreported as a duplicate registration', async ({ page }) => {
  await load(page);
  const r = await page.evaluate(() => {
    const sentinel = new Error('metadata getter sentinel');
    const Broken = make('broken-meta');
    Broken.prototype.attributeChangedCallback = () => {};
    Object.defineProperty(Broken, 'observedAttributes', { get() { throw sentinel; } });
    let error;
    try {
      define(Broken);
    } catch (e) {
      error = { message: e.message, causeIsSentinel: e.cause === sentinel };
    }
    // The class is still unregistered, so it can be defined correctly afterwards.
    const Fixed = make('broken-meta');
    return { error, tag: customElements.get('sl-broken-meta'), retry: define(Fixed), after: customElements.get('sl-broken-meta') === Fixed };
  });
  expect(r.error.message).toContain('<sl-broken-meta>');
  expect(r.error.message).toContain('customElements.define failed');
  expect(r.error.message).not.toMatch(/already|different tag/);
  expect(r.error.causeIsSentinel).toBe(true);
  expect(r.tag).toBeUndefined();
  expect(r.retry).toBe('sl-broken-meta');
  expect(r.after).toBe(true);
});

test('constructors without a usable static baseName are rejected with a TypeError', async ({ page }) => {
  await load(page);
  const names = await page.evaluate(() => {
    const results = [];
    for (const bad of [make(), make(''), make('Upper'), make('has space'), make('-lead'), make(5), null, {}, 'sl-x']) {
      try {
        define(bad);
        results.push('no error');
      } catch (e) {
        results.push(e.name);
      }
    }
    return results;
  });
  expect(names).toEqual(Array(9).fill('TypeError'));
});

// Oracle for core's shared scope: the real Map objects and their entries, compared by identity. It fails on a replaced
// scope object, a replaced Map, an added/removed key, and a changed value even when the size is unchanged.
const installScopeOracle = page => page.evaluate(() => {
  window.captureScope = () => {
    const scope = window.CharmComponents?.scope;
    if (!scope || !(scope.tagMap instanceof Map) || !(scope.baseNameMap instanceof Map)) throw new Error('core scope maps not found');
    return { scope, tagMap: scope.tagMap, baseNameMap: scope.baseNameMap,
      tagEntries: [...scope.tagMap.entries()], baseEntries: [...scope.baseNameMap.entries()] };
  };
  window.scopeChanges = (before, after) => {
    const problems = [];
    if (before.scope !== after.scope || window.CharmComponents.scope !== before.scope) problems.push('scope object replaced');
    for (const [label, mapKey, entriesKey] of [['tagMap', 'tagMap', 'tagEntries'], ['baseNameMap', 'baseNameMap', 'baseEntries']]) {
      if (before[mapKey] !== after[mapKey] || window.CharmComponents.scope[mapKey] !== before[mapKey]) problems.push(`${label} replaced`);
      const was = before[entriesKey];
      const now = after[entriesKey];
      if (was.length !== now.length) problems.push(`${label} size changed`);
      for (const [k] of now) if (!was.some(([k2]) => k2 === k)) problems.push(`${label} key added: ${k}`);
      for (const [k, v] of was) {
        const hit = now.find(([k2]) => k2 === k);
        if (!hit) problems.push(`${label} key removed: ${k}`);
        else if (hit[1] !== v) problems.push(`${label} value changed: ${k}`);
      }
    }
    return problems;
  };
});

test('does not touch core state: prefix, project config, scope maps (by identity and entry)', async ({ page }) => {
  await load(page);
  await installScopeOracle(page);
  const r = await page.evaluate(async () => {
    await import('/coreButton.js'); // seeds both maps with real entries so value changes are observable
    const { project } = await import('/coreProject.js');
    const state = () => JSON.stringify([project.getProject(), project.scope.tagName('thing')]);
    const before = captureScope();
    const beforeState = state();
    define(make('thing'));
    const tag = define(make('other-thing'));
    return { seeded: [before.tagEntries.length, before.baseEntries.length], changes: scopeChanges(before, captureScope()),
      sameState: state() === beforeState, prefix: project.scope.tagName('button'), tag };
  });
  expect(r.seeded[0]).toBeGreaterThan(0);
  expect(r.seeded[1]).toBeGreaterThan(0);
  expect(r.changes).toEqual([]);
  expect(r.sameState).toBe(true);
  expect(r.prefix).toBe('ch-button');
});

test('the scope oracle detects replaced objects, added keys and same-size value changes in both maps', async ({ page }) => {
  await load(page);
  await installScopeOracle(page);
  const r = await page.evaluate(async () => {
    await import('/coreButton.js');
    const mutations = {
      'tagMap added key': s => s.tagMap.set('extra-tag', class {}),
      'baseNameMap added key': s => s.baseNameMap.set('extra', class {}),
      'tagMap same-size changed value': s => { const [k] = s.tagMap.keys(); s.tagMap.set(k, class {}); },
      'baseNameMap same-size changed value': s => { const [k] = s.baseNameMap.keys(); s.baseNameMap.set(k, class {}); },
      'tagMap removed key': s => { const [k] = s.tagMap.keys(); s.tagMap.delete(k); },
      'tagMap replaced with equal copy': s => { s.tagMap = new Map(s.tagMap); },
      'baseNameMap replaced with equal copy': s => { s.baseNameMap = new Map(s.baseNameMap); },
      'scope object replaced': () => { window.CharmComponents.scope = { ...window.CharmComponents.scope }; },
    };
    const original = window.CharmComponents.scope;
    const results = {};
    for (const [name, mutate] of Object.entries(mutations)) {
      window.CharmComponents.scope = original;
      const before = captureScope();
      mutate(window.CharmComponents.scope);
      results[name] = scopeChanges(before, captureScope()).length > 0;
      // restore the shared state for the next mutation
      window.CharmComponents.scope = original;
      original.tagMap = before.tagMap; original.baseNameMap = before.baseNameMap;
      for (const [map, entries] of [[before.tagMap, before.tagEntries], [before.baseNameMap, before.baseEntries]]) {
        map.clear();
        for (const [k, v] of entries) map.set(k, v);
      }
    }
    return results;
  });
  for (const [name, detected] of Object.entries(r)) expect(detected, name).toBe(true);
});

// Velcro's local scope resolver (internal/scope.ts), checked on core's own switch, whose constructor registers its
// declared CoreIcon dependency through `this.scope` and whose template renders `<${this.scope.tag('icon')}>`.
const loadScoped = page => page.evaluate(async () => {
  const { useVelcroScope, velcroScope } = await import('/scope.js');
  const { CoreSwitch } = await import('/coreSwitchClass.js');
  const { CoreIcon } = await import('/coreIconClass.js');
  Object.assign(window, { useVelcroScope, velcroScope, CoreSwitch, CoreIcon });
});

test('scope resolver: without it, a scope-dependent core subclass registered as sl-* cannot be constructed', async ({ page }) => {
  await load(page);
  await loadScoped(page);
  const r = await page.evaluate(() => {
    const Plain = class extends CoreSwitch {};
    Plain.baseName = 'plain-switch';
    define(Plain);
    try {
      new Plain();
      return 'constructed';
    } catch (e) {
      return e.name;
    }
  });
  expect(r).toBe('TypeError');
});

test('scope resolver: core lookups resolve to sl-* tags, a registered Velcro dependency renders, core state is unchanged', async ({ page }) => {
  await load(page);
  await installScopeOracle(page);
  await loadScoped(page);
  const r = await page.evaluate(async () => {
    await import('/coreButton.js'); // seeds core's scope maps so a change would show
    const { project } = await import('/coreProject.js');
    const before = captureScope();
    const config = JSON.stringify(project.getProject());
    const Icon = class extends CoreIcon {};
    Icon.baseName = 'icon';
    define(Icon); // the Velcro counterpart of core's declared dependency, registered first
    const Sw = class extends CoreSwitch {};
    Sw.baseName = 'switch';
    useVelcroScope(Sw);
    useVelcroScope(Sw); // repeated installs are no-ops
    define(Sw);
    const el = new Sw();
    document.body.append(el);
    await el.updateComplete;
    const icon = el.shadowRoot.querySelector('[part="form-control-error-text-icon"]');
    return {
      icon: icon?.localName, iconIsVelcro: icon instanceof Icon,
      scope: [el.scope === velcroScope, velcroScope.prefix, velcroScope.suffix, velcroScope.tagName('icon'), velcroScope.getBaseName(el),
        velcroScope.getBaseName('sl-icon'), velcroScope.getComponent('icon') === Icon],
      // core's base element adds its base-name marker from the scope while connecting; Velcro hosts carry none
      marker: el.hasAttribute('switch'),
      sub: (() => { const Sub = class extends Sw {}; Sub.baseName = 'sub-switch'; define(Sub); const s = new Sub(); document.body.append(s); return [s.scope === velcroScope, s.hasAttribute('sub-switch')]; })(),
      changes: scopeChanges(before, captureScope()),
      sameConfig: JSON.stringify(project.getProject()) === config,
      prefix: project.scope.tagName('button'),
    };
  });
  expect(r).toEqual({
    icon: 'sl-icon', iconIsVelcro: true,
    scope: [true, 'sl', '', 'sl-icon', 'switch', 'icon', true],
    marker: false,
    sub: [true, false],
    changes: [], sameConfig: true, prefix: 'ch-button',
  });
});

test('scope resolver: a missing or foreign dependency is a clear construction error, never a silent gap', async ({ page }) => {
  await load(page);
  await loadScoped(page);
  const r = await page.evaluate(() => {
    const attempt = () => {
      const Sw = class extends CoreSwitch {};
      Sw.baseName = `switch-${Math.random().toString(36).slice(2, 8)}`;
      useVelcroScope(Sw);
      define(Sw);
      try {
        new Sw();
        return 'constructed';
      } catch (e) {
        return e.message;
      }
    };
    const missing = attempt();
    customElements.define('sl-icon', class extends HTMLElement {});
    const foreign = attempt();
    let badName;
    try {
      velcroScope.tag('Not A Name');
    } catch (e) {
      badName = e.name;
    }
    return { missing, foreign, badName };
  });
  expect(r.missing).toContain('the dependency <sl-icon> is not registered');
  expect(r.foreign).toContain('<sl-icon> is defined by a constructor that does not extend the declared dependency');
  expect(r.badName).toBe('TypeError');
});
