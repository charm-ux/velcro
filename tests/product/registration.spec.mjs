import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { buildFixtures, gotoBlank } from './support/fixtures.mjs';

// Scope of these checks: Velcro's own badge, button, divider and spinner (everything the package root registers) register
// by defining their exported classes natively, in Chromium, alone or next to core's own button. They do NOT show that scope-dependent or nested core components work.
// Needs the built library: `pnpm --filter @charm-ux/velcro run build` (verify:product does this first).
const root = fileURLToPath(new URL('../../', import.meta.url));
let outDir;
test.beforeAll(async () => {
  outDir = await buildFixtures({
    root: "export * from '@charm-ux/velcro';",
    badge: "export * from '@charm-ux/velcro/badge';",
    button: "export * from '@charm-ux/velcro/button';",
    divider: "export * from '@charm-ux/velcro/divider';",
    spinner: "export * from '@charm-ux/velcro/spinner';",
    buttonClass: "export * from '@charm-ux/velcro/button/class';",
    spinnerClass: "export * from '@charm-ux/velcro/spinner/class';",
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
const ALL_TAGS = ['sl-badge', 'sl-button', 'sl-divider', 'sl-spinner'];

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
    let constructError;
    try {
      new b.VelcroButton();
    } catch (e) {
      constructError = e.name;
    }
    return {
      exports: [Object.keys(b).sort(), Object.keys(s).sort()],
      aliasButton: b.SlButton === b.VelcroButton,
      aliasSpinner: s.SlSpinner === s.VelcroSpinner,
      defined: [customElements.get('sl-button'), customElements.get('sl-spinner')],
      defines: window.__defines.slice(),
      constructError,
    };
  });
  expect(r.exports).toEqual([['SlButton', 'VelcroButton'], ['SlSpinner', 'VelcroSpinner']]);
  expect(r.aliasButton && r.aliasSpinner).toBe(true);
  expect(r.defined).toEqual([undefined, undefined]);
  expect(r.defines).toEqual([]);
  expect(r.constructError).toBe('TypeError');
  expect(await corePrefixState(page)).toEqual(before);
  expect(before.button).toBe('ch-button');
});

for (const order of [['buttonClass', 'button'], ['button', 'buttonClass'], ['spinnerClass', 'root'], ['root', 'spinnerClass']]) {
  test(`identity and construction hold for import order ${order.join(' then ')}`, async ({ page }) => {
    await importAll(page, ...order);
    const r = await page.evaluate(async () => {
      const m = await import('/root.js');
      const out = {};
      // Badge and divider have no class-only entry or Sl* alias in this batch, so their alias check is the class itself.
      for (const [tag, Cls, Alias] of [['sl-badge', m.VelcroBadge, m.VelcroBadge], ['sl-button', m.VelcroButton, m.SlButton],
        ['sl-divider', m.VelcroDivider, m.VelcroDivider], ['sl-spinner', m.VelcroSpinner, m.SlSpinner]]) {
        const el = new Cls();
        document.body.append(el);
        await el.updateComplete;
        out[tag] = {
          registered: customElements.get(tag) === Cls,
          alias: Alias === Cls,
          instance: el instanceof Cls,
          localName: el.localName,
          viaCreate: document.createElement(tag) instanceof Cls,
          // The divider renders nothing in its shadow root; its public surface is the host separator role.
          rendered: tag === 'sl-divider' ? el.getAttribute('role') === 'separator' : !!el.shadowRoot?.querySelector('[part~="base"]'),
        };
      }
      return { out, defines: window.__defines.slice() };
    });
    const expected = { registered: true, alias: true, instance: true, viaCreate: true, rendered: true };
    for (const tag of ALL_TAGS) expect(r.out[tag], tag).toEqual({ ...expected, localName: tag });
    expect(Object.keys(r.out).sort()).toEqual(ALL_TAGS);
    expect(r.defines.sort()).toEqual(ALL_TAGS);
  });
}

test('repeated and mixed imports define each tag exactly once with one constructor', async ({ page }) => {
  await importAll(page, 'root', 'badge', 'button', 'divider', 'spinner', 'buttonClass', 'spinnerClass', 'root', 'button', 'divider');
  const r = await page.evaluate(async () => {
    const again = await import('/root.js');
    const sub = await import('/button.js');
    return {
      defines: window.__defines.slice().sort(),
      sameButton: again.VelcroButton === sub.VelcroButton && customElements.get('sl-button') === sub.VelcroButton,
      sameOthers: ['Badge', 'Divider', 'Spinner'].every(n => customElements.get(`sl-${n.toLowerCase()}`) === again[`Velcro${n}`]),
    };
  });
  expect(r.defines).toEqual(ALL_TAGS);
  expect(r.sameOthers).toBe(true);
  expect(r.sameButton).toBe(true);
});

test('a foreign sl-* definition is a clear error from every registering entry and is never replaced', async ({ page }) => {
  const r = await page.evaluate(async () => {
    class Foreign extends HTMLElement {}
    customElements.define('sl-button', Foreign);
    const errors = {};
    for (const n of ['button', 'root']) {
      try {
        await import(`/${n}.js`);
        errors[n] = 'no error';
      } catch (e) {
        errors[n] = e.message;
      }
    }
    // Class-only still works: it never touches the registry, and its class is not the foreign one.
    const cls = await import('/buttonClass.js');
    return { errors, kept: customElements.get('sl-button') === Foreign, classIsForeign: cls.VelcroButton === Foreign };
  });
  for (const message of Object.values(r.errors)) {
    expect(message).toContain('<sl-button>');
    expect(message).toContain('already defined by a different constructor');
  }
  expect(r.kept).toBe(true);
  expect(r.classIsForeign).toBe(false);
});

for (const [tag, entry] of [['sl-badge', 'badge'], ['sl-divider', 'divider']]) {
  test(`a foreign ${tag} definition is a clear error from its entry and the root and is never replaced`, async ({ page }) => {
    const r = await page.evaluate(async ([tagName, entryName]) => {
      class Foreign extends HTMLElement {}
      customElements.define(tagName, Foreign);
      const errors = {};
      for (const n of [entryName, 'root']) {
        try {
          await import(`/${n}.js`);
          errors[n] = 'no error';
        } catch (e) {
          errors[n] = e.message;
        }
      }
      return { errors, kept: customElements.get(tagName) === Foreign };
    }, [tag, entry]);
    for (const message of Object.values(r.errors)) {
      expect(message).toContain(`<${tag}>`);
      expect(message).toContain('already defined by a different constructor');
    }
    expect(r.kept).toBe(true);
  });
}

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

// Whole-root isolation: importing the package root (all four registering entries) must not change core's prefix,
// project config, scope object or either scope Map, compared by identity and by entry (so same-size value changes show).
test('the whole package root changes no core state: prefix, config, scope object and both scope maps', async ({ page }) => {
  const r = await page.evaluate(async () => {
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
      prefix: after.prefix, defined: ['sl-badge', 'sl-button', 'sl-divider', 'sl-spinner'].map(t => customElements.get(t) !== undefined) };
  });
  expect(r.defined).toEqual([true, true, true, true]);
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
import * as rootEntry from '@charm-ux/velcro';
import * as buttonEntry from '@charm-ux/velcro/button';
import * as spinnerEntry from '@charm-ux/velcro/spinner';
import * as badgeEntry from '@charm-ux/velcro/badge';
import * as dividerEntry from '@charm-ux/velcro/divider';

const ctorButton: typeof VelcroButton = SlButton;
const ctorSpinner: typeof VelcroSpinner = SlSpinner;
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
const tag: string = VelcroButton.baseName;
// @ts-expect-error the registration helper is internal and not exported from the package root
rootEntry.defineVelcroComponent;
// @ts-expect-error internal files are not reachable through the package exports
void import('@charm-ux/velcro/dist/utilities/registration.js');
// @ts-expect-error badge and divider have registering entries only; no class-only subpath exists for them in this batch
void import('@charm-ux/velcro/badge/class');
export { ctorButton, ctorSpinner, spinner, variant, fromRoot, fromRootSpinner, fromButton, fromSpinner, tag, badgeClass, dividerClass, vertical };
`);
  const tsc = createRequire(path.join(root, 'package.json')).resolve('typescript/bin/tsc');
  const run = () => execFileSync(process.execPath, [tsc, '--noEmit', '--strict', '--module', 'nodenext', '--moduleResolution',
    'nodenext', '--target', 'es2022', '--lib', 'es2022,dom', '--skipLibCheck', path.join(dir, 'check.mts')],
  { cwd: dir, encoding: 'utf8', stdio: 'pipe' });
  expect(run).not.toThrow();
});
