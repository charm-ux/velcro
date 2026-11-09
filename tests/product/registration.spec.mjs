import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { buildFixtures, gotoBlank } from './support/fixtures.mjs';
import { velcroManifestPath } from '../../scripts/api/model.mjs';
import { readCatalog } from '../../scripts/site/catalog.mjs';

// Scope of these checks: every catalog component (packages/docs/catalog.jsonl; everything the package root registers) registers
// by defining their exported classes natively, in each engine of the product suite, alone or next to core's own button. The switch is the one scope-dependent core
// component: it runs on Velcro's local scope resolver (its generic checks are in registration-helper.spec.mjs); nested core components are not shown to work.
// Needs the built library: `pnpm --filter @charm-ux/velcro run build` (verify:product does this first).
const root = fileURLToPath(new URL('../../', import.meta.url));
let outDir;
test.beforeAll(async () => {
  outDir = await buildFixtures({
    root: "export * from '@charm-ux/velcro';",
    badge: "export * from '@charm-ux/velcro/badge';",
    button: "export * from '@charm-ux/velcro/button';",
    card: "export * from '@charm-ux/velcro/card';",
    cardClass: "export * from '@charm-ux/velcro/card/class';",
    divider: "export * from '@charm-ux/velcro/divider';",
    skeleton: "export * from '@charm-ux/velcro/skeleton';",
    spinner: "export * from '@charm-ux/velcro/spinner';",
    buttonClass: "export * from '@charm-ux/velcro/button/class';",
    spinnerClass: "export * from '@charm-ux/velcro/spinner/class';",
    progressBarClass: "export * from '@charm-ux/velcro/progress-bar/class';",
    switch: "export * from '@charm-ux/velcro/switch';",
    switchClass: "export * from '@charm-ux/velcro/switch/class';",
    coreButton: "export * from 'core-internal:components/button/index';",
    coreProject: "export { project } from 'core-internal:utilities/project';",
  });
});

// Counts native define calls per tag before any module loads.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.__defines = [];
    const original = customElements.define.bind(customElements);
    customElements.define = (name, ctor, options) => {
      window.__defines.push(name);
      return original(name, ctor, options);
    };
  });
  await gotoBlank(page, outDir);
});

// Everything the package root registers.
const CATALOG = readCatalog(root);
const ALL_TAGS = CATALOG.map(c => c.tag).sort();
const pascal = name => name.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join('');
// Badge and divider have no Sl* alias (their class is the alias); every later component ships one.
const NO_ALIAS = ['sl-badge', 'sl-divider'];
// How each element shows it rendered. By default, from its manifest: its `base` part when it declares one, else a slot
// when it declares slots. An element with neither needs an entry here (no "any shadow element" default: the test must
// name what the component's public surface is). These elements expose a different public surface:
const SURFACE = {
  // The divider renders nothing in its shadow root (its public surface is the host separator role); format-bytes and
  // format-number render only text (their public surface is the formatted string).
  'sl-divider': { role: 'separator' },
  'sl-format-bytes': { text: '0 byte' },
  'sl-format-date': { selector: 'time[datetime]' },
  'sl-relative-time': { selector: 'time' },
  'sl-format-number': { text: '0' },
  // An icon without a name or src draws nothing; its public surface is then the presentational host.
  'sl-icon': { icon: true },
  // An animated image without a src renders its (hidden) image; the slots of its control box only exist once an image has loaded.
  'sl-animated-image': { selector: 'img.animated-image__animated' },
  'sl-split-panel': { selector: '[part~="divider"]' },
  'sl-include': { selector: 'slot' },
};
const declared = new Map(JSON.parse(readFileSync(path.join(root, velcroManifestPath), 'utf8')).modules
  .flatMap(m => m.declarations ?? []).filter(d => d.tagName).map(d => [d.tagName, d]));
const surface = tag => {
  if (SURFACE[tag]) return SURFACE[tag];
  if (declared.get(tag)?.cssParts?.some(p => p.name === 'base')) return { selector: '[part~="base"]' };
  if (declared.get(tag)?.slots?.length) return { selector: 'slot' };
  throw new Error(`${tag} declares no base part and no slot: add its public surface to SURFACE in registration.spec.mjs`);
};
const COMPONENTS = CATALOG.map(({ name, tag }) => ({
  tag, cls: `Velcro${pascal(name)}`, alias: NO_ALIAS.includes(tag) ? `Velcro${pascal(name)}` : `Sl${pascal(name)}`, surface: surface(tag),
}));

const importAll = (page, ...names) => page.evaluate(async list => {
  const out = [];
  for (const n of list) out.push(Object.keys(await import(`/${n}.js`)));
  return out;
}, names);

const corePrefixState = page => page.evaluate(async () => {
  const { project } = await import('/coreProject.js');
  return { config: project.getProject(), button: project.scope.tagName('button') };
});

test('class-only entries define nothing and leave core state alone, and construction fails until registered', async ({ page }) => {
  const before = await corePrefixState(page);
  const r = await page.evaluate(async () => {
    const b = await import('/buttonClass.js');
    const s = await import('/spinnerClass.js');
    const c = await import('/cardClass.js');
    const p = await import('/progressBarClass.js');
    const w = await import('/switchClass.js');
    let constructError;
    try {
      new b.VelcroButton();
    } catch (e) {
      constructError = e.name;
    }
    let cardConstructError;
    try {
      new c.VelcroCard();
    } catch (e) {
      cardConstructError = e.name;
    }
    return {
      exports: [Object.keys(b).sort(), Object.keys(s).sort(), Object.keys(c).sort(), Object.keys(p).sort(), Object.keys(w).sort()],
      aliasSwitch: w.SlSwitch === w.VelcroSwitch,
      aliasProgressBar: p.SlProgressBar === p.VelcroProgressBar,
      aliasButton: b.SlButton === b.VelcroButton,
      aliasSpinner: s.SlSpinner === s.VelcroSpinner,
      aliasCard: c.SlCard === c.VelcroCard,
      defined: [customElements.get('sl-button'), customElements.get('sl-spinner'), customElements.get('sl-card'), customElements.get('sl-progress-bar'), customElements.get('sl-switch')],
      defines: window.__defines.slice(),
      constructError,
      cardConstructError,
    };
  });
  expect(r.exports).toEqual([['SlButton', 'VelcroButton'], ['SlSpinner', 'VelcroSpinner'], ['SlCard', 'VelcroCard'], ['SlProgressBar', 'VelcroProgressBar'], ['SlSwitch', 'VelcroSwitch']]);
  expect(r.aliasButton && r.aliasSpinner && r.aliasCard && r.aliasProgressBar && r.aliasSwitch).toBe(true);
  expect(r.defined).toEqual([undefined, undefined, undefined, undefined, undefined]);
  expect(r.defines).toEqual([]);
  expect(r.constructError).toBe('TypeError');
  expect(r.cardConstructError).toBe('TypeError');
  expect(await corePrefixState(page)).toEqual(before);
  expect(before.button).toBe('ch-button');
});

for (const order of [['buttonClass', 'button'], ['button', 'buttonClass'], ['spinnerClass', 'root'], ['root', 'spinnerClass'], ['progressBarClass', 'root'], ['root', 'progressBarClass'], ['switchClass', 'switch'], ['switch', 'root']]) {
  test(`identity and construction hold for import order ${order.join(' then ')}`, async ({ page }) => {
    await importAll(page, ...order);
    const r = await page.evaluate(async components => {
      const m = await import('/root.js');
      const out = {};
      for (const { tag, cls, alias, surface } of components) {
        const Cls = m[cls];
        const el = new Cls();
        document.body.append(el);
        await el.updateComplete;
        out[tag] = {
          registered: customElements.get(tag) === Cls,
          alias: m[alias] === Cls,
          instance: el instanceof Cls,
          localName: el.localName,
          viaCreate: document.createElement(tag) instanceof Cls,
          rendered: surface.role ? el.getAttribute('role') === surface.role
            : surface.text !== undefined ? el.shadowRoot?.textContent === surface.text
            : surface.icon ? el.getAttribute('aria-hidden') === 'true' && !el.shadowRoot?.querySelector('svg')
            : !!el.shadowRoot?.querySelector(surface.selector),
        };
      }
      return { out, defines: window.__defines.slice() };
    }, COMPONENTS);
    const expected = { registered: true, alias: true, instance: true, viaCreate: true, rendered: true };
    for (const tag of ALL_TAGS) expect(r.out[tag], tag).toEqual({ ...expected, localName: tag });
    expect(Object.keys(r.out).sort()).toEqual(ALL_TAGS);
    expect(r.defines.sort()).toEqual(ALL_TAGS);
  });
}

test('repeated and mixed imports define each tag exactly once with one constructor', async ({ page }) => {
  await importAll(page, 'root', 'badge', 'button', 'card', 'divider', 'skeleton', 'spinner', 'switch', 'buttonClass', 'cardClass', 'spinnerClass', 'switchClass', 'root', 'button', 'divider', 'switch');
  const r = await page.evaluate(async () => {
    const again = await import('/root.js');
    const sub = await import('/button.js');
    return {
      defines: window.__defines.slice().sort(),
      sameButton: again.VelcroButton === sub.VelcroButton && customElements.get('sl-button') === sub.VelcroButton,
      sameOthers: [['Badge', 'badge'], ['Card', 'card'], ['Divider', 'divider'], ['ProgressBar', 'progress-bar'], ['ProgressRing', 'progress-ring'], ['Skeleton', 'skeleton'], ['Spinner', 'spinner'], ['Switch', 'switch'], ['VisuallyHidden', 'visually-hidden']].every(([n, t]) => customElements.get(`sl-${t}`) === again[`Velcro${n}`]),
    };
  });
  expect(r.defines).toEqual(ALL_TAGS);
  expect(r.sameOthers).toBe(true);
  expect(r.sameButton).toBe(true);
});

// A tag clash never makes a registering entry throw: entries register as Shoelace 2.20.1's `define` does (the helper's
// cases, including the version warning, are in registration-helper.spec.mjs; entries with dependencies in
// registration-clash.spec.mjs).
const LEAF_ENTRIES = [['sl-button', 'button'], ['sl-badge', 'badge'], ['sl-card', 'card'], ['sl-divider', 'divider'], ['sl-switch', 'switch']];

test('a foreign sl-* definition is left in place by its entry and the root, without an error or a warning', async ({ page }) => {
  const logs = [];
  page.on('console', m => { if (m.type() === 'warning' || m.type() === 'error') logs.push(m.text()); });
  const r = await page.evaluate(async entries => {
    const foreign = {};
    for (const [tag] of entries) {
      foreign[tag] = class extends HTMLElement {};
      customElements.define(tag, foreign[tag]);
    }
    const errors = [];
    for (const n of [...entries.map(([, entry]) => entry), 'root']) {
      try {
        await import(`/${n}.js`);
      } catch (e) {
        errors.push(`${n}: ${e.message}`);
      }
    }
    // Class-only still works: it never touches the registry, and its class is not the foreign one.
    const cls = await import('/buttonClass.js');
    const spinner = await import('/spinnerClass.js');
    return {
      errors,
      kept: entries.filter(([tag]) => customElements.get(tag) === foreign[tag]).map(([tag]) => tag),
      classIsForeign: cls.VelcroButton === foreign['sl-button'],
      othersRegistered: customElements.get('sl-spinner') === spinner.VelcroSpinner,
    };
  }, LEAF_ENTRIES);
  expect(r).toEqual({ errors: [], kept: LEAF_ENTRIES.map(([tag]) => tag), classIsForeign: false, othersRegistered: true });
  expect(logs).toEqual([]);
});

test('a class already registered under another tag is registered by its entry and the root as an anonymous subclass', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const classes = {
      'sl-button': (await import('/buttonClass.js')).VelcroButton,
      'sl-card': (await import('/cardClass.js')).VelcroCard,
      'sl-switch': (await import('/switchClass.js')).VelcroSwitch,
    };
    for (const [tag, cls] of Object.entries(classes)) customElements.define(`other-${tag}`, cls);
    const errors = [];
    for (const n of ['button', 'card', 'switch', 'root']) {
      try {
        await import(`/${n}.js`);
      } catch (e) {
        errors.push(`${n}: ${e.message}`);
      }
    }
    return {
      errors,
      subclasses: Object.entries(classes)
        .filter(([tag, cls]) => {
          const defined = customElements.get(tag);
          return defined !== cls && Object.getPrototypeOf(defined) === cls && document.createElement(tag) instanceof cls;
        })
        .map(([tag]) => tag),
    };
  });
  expect(r).toEqual({ errors: [], subclasses: ['sl-button', 'sl-card', 'sl-switch'] });
});

for (const order of ['velcro first', 'core first']) {
  test(`core's own button coexists, ${order}: both tags are distinct and core keeps its prefix`, async ({ page }) => {
    const before = await corePrefixState(page);
    await importAll(page, ...(order === 'core first' ? ['coreButton', 'root'] : ['root', 'coreButton']));
    const r = await page.evaluate(async () => {
      const { project } = await import('/coreProject.js');
      const velcro = await import('/root.js');
      const core = await import('/coreButton.js');
      const chButton = document.createElement('ch-button');
      const slButton = document.createElement('sl-button');
      document.body.append(chButton, slButton);
      return {
        distinct: customElements.get('ch-button') !== customElements.get('sl-button'),
        velcroSame: customElements.get('sl-button') === velcro.VelcroButton,
        coreInstance: chButton instanceof core.CoreButton && !(chButton instanceof velcro.VelcroButton),
        velcroInstance: slButton instanceof velcro.VelcroButton,
        config: project.getProject(),
        tagName: project.scope.tagName('button'),
        chAttr: chButton.hasAttribute('button'),
      };
    });
    expect(r).toMatchObject({ distinct: true, velcroSame: true, coreInstance: true, velcroInstance: true, tagName: 'ch-button', chAttr: true });
    expect(r.config).toEqual(before.config);
  });
}

// Whole-root isolation: importing the package root (all registering entries) must not change core's prefix,
// project config, scope object or either scope Map, compared by identity and by entry (so same-size value changes show).
test('the whole package root changes no core state: prefix, config, scope object and both scope maps', async ({ page }) => {
  const r = await page.evaluate(async tags => {
    await import('/coreButton.js'); // seeds both scope maps with real entries so changes are observable
    const { project } = await import('/coreProject.js');
    const capture = () => {
      // Core's shared scope object, as the helper spec's oracle reads it (`project.scope` is read for the prefix).
      const scope = window.CharmComponents?.scope;
      if (!scope || !(scope.tagMap instanceof Map) || !(scope.baseNameMap instanceof Map)) throw new Error('core scope maps not found');
      return { scope, tagMap: scope.tagMap, baseNameMap: scope.baseNameMap, tagEntries: [...scope.tagMap.entries()],
        baseEntries: [...scope.baseNameMap.entries()], config: JSON.stringify(project.getProject()), prefix: project.scope.tagName('button') };
    };
    const before = capture();
    await import('/root.js');
    const after = capture();
    const problems = [];
    if (before.scope !== after.scope || window.CharmComponents.scope !== before.scope) problems.push('scope object replaced');
    for (const [label, mapKey, entriesKey] of [['tagMap', 'tagMap', 'tagEntries'], ['baseNameMap', 'baseNameMap', 'baseEntries']]) {
      if (before[mapKey] !== after[mapKey] || window.CharmComponents.scope[mapKey] !== before[mapKey]) problems.push(`${label} replaced`);
      if (before[entriesKey].length !== after[entriesKey].length) problems.push(`${label} size changed`);
      for (const [k, v] of before[entriesKey]) {
        const hit = after[entriesKey].find(([k2]) => k2 === k);
        if (!hit) problems.push(`${label} key removed: ${k}`);
        else if (hit[1] !== v) problems.push(`${label} value changed: ${k}`);
      }
      for (const [k] of after[entriesKey]) if (!before[entriesKey].some(([k2]) => k2 === k)) problems.push(`${label} key added: ${k}`);
    }
    return { seeded: [before.tagEntries.length, before.baseEntries.length], problems, sameConfig: before.config === after.config,
      prefix: after.prefix, defined: tags.map(t => customElements.get(t) !== undefined),
      // The switch is the scope-dependent component: creating and connecting one must not touch core's scope either.
      switchMarker: await (async () => {
        const el = document.createElement('sl-switch');
        document.body.append(el);
        await el.updateComplete;
        const found = after.tagEntries.length !== [...window.CharmComponents.scope.tagMap.entries()].length || el.hasAttribute('switch');
        el.remove();
        return found;
      })() };
  }, ALL_TAGS);
  expect(r.defined).toEqual(ALL_TAGS.map(() => true));
  expect(r.switchMarker).toBe(false);
  expect(r.seeded[0]).toBeGreaterThan(0);
  expect(r.seeded[1]).toBeGreaterThan(0);
  expect(r.problems).toEqual([]);
  expect(r.sameConfig).toBe(true);
  expect(r.prefix).toBe('ch-button');
});

test('type and export regressions: class-only and registering entries, aliases, private helper stays private', async () => {
  const dir = mkdtempSync(path.join(root, '.airig/product-fixtures/types-'));
  mkdirSync(path.join(dir, 'node_modules/@charm-ux'), { recursive: true });
  symlinkSync(path.join(root, 'packages/velcro'), path.join(dir, 'node_modules/@charm-ux/velcro'), 'dir');
  writeFileSync(path.join(dir, 'check.mts'), `
import { SlButton, VelcroButton } from '@charm-ux/velcro/button/class';
import { SlSpinner, VelcroSpinner } from '@charm-ux/velcro/spinner/class';
import { SlCard, VelcroCard } from '@charm-ux/velcro/card/class';
import * as cardEntry from '@charm-ux/velcro/card';
import { SlProgressBar, VelcroProgressBar } from '@charm-ux/velcro/progress-bar/class';
import * as rootEntry from '@charm-ux/velcro';
import * as buttonEntry from '@charm-ux/velcro/button';
import * as spinnerEntry from '@charm-ux/velcro/spinner';
import * as badgeEntry from '@charm-ux/velcro/badge';
import * as dividerEntry from '@charm-ux/velcro/divider';
import { SlSwitch, VelcroSwitch } from '@charm-ux/velcro/switch/class';
import * as switchEntry from '@charm-ux/velcro/switch';

const ctorButton: typeof VelcroButton = SlButton;
const ctorSpinner: typeof VelcroSpinner = SlSpinner;
const ctorProgressBar: typeof VelcroProgressBar = SlProgressBar;
const progressValue: number = new SlProgressBar().value;
const button: SlButton = new VelcroButton();
const spinner: SlSpinner = new SlSpinner();
const variant: 'default' | 'primary' | 'success' | 'neutral' | 'warning' | 'danger' | 'text' = button.variant;
const fromRoot: typeof VelcroButton = rootEntry.SlButton;
const fromRootSpinner: typeof VelcroSpinner = rootEntry.SlSpinner;
const fromButton: typeof VelcroButton = buttonEntry.SlButton;
const fromSpinner: typeof VelcroSpinner = spinnerEntry.SlSpinner;
const badgeClass: typeof rootEntry.VelcroBadge = badgeEntry.VelcroBadge;
const dividerClass: typeof rootEntry.VelcroDivider = dividerEntry.VelcroDivider;
const vertical: boolean = new rootEntry.VelcroDivider().vertical;
const ctorCard: typeof VelcroCard = SlCard;
const fromRootCard: typeof VelcroCard = rootEntry.SlCard;
const fromCard: typeof VelcroCard = cardEntry.SlCard;
const tag: string = VelcroButton.baseName;
const ctorSwitch: typeof VelcroSwitch = SlSwitch;
const fromSwitch: typeof VelcroSwitch = switchEntry.SlSwitch;
const fromRootSwitch: typeof VelcroSwitch = rootEntry.SlSwitch;
const switchSize: 'small' | 'medium' | 'large' = new SlSwitch().size;
const switchForm: HTMLFormElement | null = new VelcroSwitch().getForm();
// @ts-expect-error the registration helper is internal and not exported from the package root
rootEntry.defineVelcroComponent;
// @ts-expect-error internal files are not reachable through the package exports
void import('@charm-ux/velcro/dist/utilities/registration.js');
// @ts-expect-error the scope resolver is internal and not reachable through the package exports
void import('@charm-ux/velcro/dist/internal/scope.js');
// @ts-expect-error badge and divider have registering entries only; no class-only subpath exists for them in this batch
void import('@charm-ux/velcro/badge/class');
export { ctorCard, fromRootCard, fromCard, ctorButton, ctorSpinner, ctorProgressBar, progressValue, spinner, variant, fromRoot, fromRootSpinner, fromButton, fromSpinner, tag, badgeClass, dividerClass, vertical, ctorSwitch, fromSwitch, fromRootSwitch, switchSize, switchForm };
`);
  const tsc = createRequire(path.join(root, 'package.json')).resolve('typescript/bin/tsc');
  const run = () => execFileSync(process.execPath, [tsc, '--noEmit', '--strict', '--module', 'nodenext', '--moduleResolution',
    'nodenext', '--target', 'es2022', '--lib', 'es2022,dom', '--skipLibCheck', path.join(dir, 'check.mts')],
  { cwd: dir, encoding: 'utf8', stdio: 'pipe' });
  expect(run).not.toThrow();
});
