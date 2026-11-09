import { expect, test } from '@playwright/test';
import { buildFixtures, gotoBlank } from './support/fixtures.mjs';

// A tag clash never makes a registering entry or a constructor throw. Velcro registers every tag, a component's own and
// those of the elements it renders (its dependencies), as Shoelace 2.20.1's `ShoelaceElement.define` does: a tag that is
// already defined, by any constructor, is left alone (with Shoelace's warning when the versions differ), and if the
// platform refuses the class itself (it is already defined under another tag), an anonymous subclass is defined under the
// tag. Checked for every registering entry that has dependencies and for class-only construction of a representative set
// of components. The helper's own cases are in registration-helper.spec.mjs, the leaf entries in registration.spec.mjs.
// Needs the built library: `pnpm --filter @charm-ux/velcro run build` (verify:product does this first).

// Registering entries with dependencies: [entry, own tag, own class export, [[dependency tag, class export, class fixture]]].
const ICON = ['sl-icon', 'VelcroIcon', 'iconClass'];
const ICON_BUTTON = ['sl-icon-button', 'VelcroIconButton', 'iconButtonClass'];
const POPUP = ['sl-popup', 'VelcroPopup', 'popupClass'];
const SPINNER = ['sl-spinner', 'VelcroSpinner', 'spinnerClass'];
const TAG = ['sl-tag', 'VelcroTag', 'tagClass'];
const ENTRIES = [
  ['alert', 'sl-alert', 'VelcroAlert', [ICON_BUTTON, ICON]],
  ['avatar', 'sl-avatar', 'VelcroAvatar', [ICON]],
  ['button', 'sl-button', 'VelcroButton', [['sl-spinner', 'VelcroSpinner', 'spinnerClass']]],
  ['checkbox', 'sl-checkbox', 'VelcroCheckbox', [ICON]],
  ['details', 'sl-details', 'VelcroDetails', [ICON]],
  ['dropdown', 'sl-dropdown', 'VelcroDropdown', [POPUP]],
  ['icon-button', 'sl-icon-button', 'VelcroIconButton', [ICON]],
  ['input', 'sl-input', 'VelcroInput', [ICON]],
  ['menu-item', 'sl-menu-item', 'VelcroMenuItem', [ICON, POPUP, SPINNER]],
  ['option', 'sl-option', 'VelcroOption', [ICON]],
  ['radio', 'sl-radio', 'VelcroRadio', [ICON]],
  ['radio-group', 'sl-radio-group', 'VelcroRadioGroup', [['sl-button-group', 'VelcroButtonGroup', 'buttonGroupClass']]],
  ['select', 'sl-select', 'VelcroSelect', [POPUP, TAG, ICON_BUTTON, ICON]],
  ['tab', 'sl-tab', 'VelcroTab', [ICON_BUTTON, ICON]],
  ['tab-group', 'sl-tab-group', 'VelcroTabGroup', [ICON_BUTTON, ICON, ['sl-resize-observer', 'VelcroResizeObserver', 'resizeObserverClass']]],
  ['tag', 'sl-tag', 'VelcroTag', [ICON_BUTTON, ICON]],
  ['tooltip', 'sl-tooltip', 'VelcroTooltip', [['sl-popup', 'VelcroPopup', 'popupClass']]],
];
// Class-only construction (a class whose constructor registers its dependencies, as Shoelace's base element does):
// [class fixture, class export, own tag, [[dependency tag, class export, class fixture]]]. Only direct dependencies are
// listed: the constructor of a dependency registers its own ones when it is constructed.
const CLASS_ONLY = [
  ['alertClass', 'VelcroAlert', 'sl-alert', [ICON_BUTTON]],
  ['avatarClass', 'VelcroAvatar', 'sl-avatar', [ICON]],
  ['detailsClass', 'VelcroDetails', 'sl-details', [ICON]],
  ['dropdownClass', 'VelcroDropdown', 'sl-dropdown', [POPUP]],
  ['menuItemClass', 'VelcroMenuItem', 'sl-menu-item', [ICON, POPUP, SPINNER]],
  ['optionClass', 'VelcroOption', 'sl-option', [ICON]],
  ['radioGroupClass', 'VelcroRadioGroup', 'sl-radio-group', [['sl-button-group', 'VelcroButtonGroup', 'buttonGroupClass']]],
  ['selectClass', 'VelcroSelect', 'sl-select', [ICON, POPUP, TAG]],
  ['tabGroupClass', 'VelcroTabGroup', 'sl-tab-group', [ICON_BUTTON, ['sl-resize-observer', 'VelcroResizeObserver', 'resizeObserverClass']]],
  ['tagClass', 'VelcroTag', 'sl-tag', [ICON_BUTTON]],
  ['tooltipClass', 'VelcroTooltip', 'sl-tooltip', [['sl-popup', 'VelcroPopup', 'popupClass']]],
];

const camel = name => name.replace(/-(\w)/g, (_, c) => c.toUpperCase());

let outDir;
test.beforeAll(async () => {
  const fixtures = {};
  for (const [entry] of ENTRIES) fixtures[camel(entry)] = `export * from '@charm-ux/velcro/${entry}';`;
  for (const name of [...new Set([...ENTRIES.map(([entry]) => entry), 'button-group', 'icon', 'popup', 'resize-observer', 'spinner'])]) {
    fixtures[`${camel(name)}Class`] = `export * from '@charm-ux/velcro/${name}/class';`;
  }
  outDir = await buildFixtures(fixtures);
});

// Each test runs in its own page, so the registry starts empty. Console warnings and errors are collected, so "logs
// nothing" is asserted, not assumed.
let logs;
test.beforeEach(async ({ page }) => {
  logs = [];
  page.on('console', message => {
    if (message.type() === 'warning' || message.type() === 'error') logs.push(`${message.type()}: ${message.text()}`);
  });
  page.on('pageerror', error => logs.push(`pageerror: ${error.message}`));
  await gotoBlank(page, outDir);
});

test.describe('registering entries', () => {
  for (const [entry, ownTag, ownExport, deps] of ENTRIES) {
    const tags = [ownTag, ...deps.map(d => d[0])];

    test(`${entry}: importing the entry leaves foreign-owned tags alone, without an error or a log`, async ({ page }) => {
      const r = await page.evaluate(async ([fixture, allTags]) => {
        const foreign = {};
        for (const tag of allTags) {
          foreign[tag] = class extends HTMLElement {};
          customElements.define(tag, foreign[tag]);
        }
        let error = null;
        try {
          await import(`/${fixture}.js`);
        } catch (e) {
          error = e.message;
        }
        return { error, kept: allTags.filter(tag => customElements.get(tag) === foreign[tag]) };
      }, [camel(entry), tags]);
      expect(r).toEqual({ error: null, kept: tags });
      expect(logs).toEqual([]);
    });

    test(`${entry}: importing the entry defines classes already defined under another tag as anonymous subclasses`, async ({ page }) => {
      const list = [[ownTag, ownExport, `${camel(entry)}Class`], ...deps];
      const r = await page.evaluate(async ([fixture, own, entries]) => {
        const classes = {};
        for (const [tag, exportName, classFixture] of entries) {
          classes[tag] = (await import(`/${classFixture}.js`))[exportName];
          customElements.define(`other-${tag}`, classes[tag]);
        }
        let error = null;
        try {
          await import(`/${fixture}.js`);
        } catch (e) {
          error = e.message;
        }
        const el = document.createElement(own);
        document.body.append(el);
        await el.updateComplete;
        return {
          error,
          constructed: el instanceof classes[own],
          subclasses: entries
            .map(([tag]) => tag)
            .filter(tag => {
              const defined = customElements.get(tag);
              return Boolean(defined) && defined !== classes[tag] && Object.getPrototypeOf(defined) === classes[tag]
                && customElements.get(`other-${tag}`) === classes[tag];
            }),
        };
      }, [camel(entry), ownTag, list]);
      expect(r).toEqual({ error: null, constructed: true, subclasses: tags });
      expect(logs).toEqual([]);
    });
  }

  test('importing an entry logs Shoelace\'s warning for each existing constructor whose version differs', async ({ page }) => {
    const r = await page.evaluate(async () => {
      for (const tag of ['sl-tag', 'sl-icon-button']) {
        const Shoelace = class extends HTMLElement {};
        Shoelace.version = '2.20.1';
        customElements.define(tag, Shoelace);
      }
      await import('/tag.js');
      return customElements.get('sl-icon') === (await import('/iconClass.js')).VelcroIcon;
    });
    expect(r).toBe(true);
    expect(logs).toEqual([
      'warning: Attempted to register <sl-tag> (unknown version), but <sl-tag> v2.20.1 has already been registered.',
      'warning: Attempted to register <sl-icon-button> (unknown version), but <sl-icon-button> v2.20.1 has already been registered.',
    ]);
  });
});

test.describe('class-only construction', () => {
  for (const [fixture, ownExport, ownTag, deps] of CLASS_ONLY) {
    test(`${ownTag}: constructing the class leaves foreign-owned dependency tags alone, without an error or a log when neither declares a version`, async ({ page }) => {
      const r = await page.evaluate(async ([fixtureName, exportName, own, depTags]) => {
        const foreign = {};
        for (const tag of depTags) {
          foreign[tag] = class extends HTMLElement {};
          customElements.define(tag, foreign[tag]);
        }
        const Cls = (await import(`/${fixtureName}.js`))[exportName];
        customElements.define(own, Cls);
        const el = document.createElement(own);
        document.body.append(el);
        await el.updateComplete;
        return { constructed: el instanceof Cls, kept: depTags.filter(tag => customElements.get(tag) === foreign[tag]) };
      }, [fixture, ownExport, ownTag, deps.map(d => d[0])]);
      expect(r).toEqual({ constructed: true, kept: deps.map(d => d[0]) });
      expect(logs).toEqual([]);
    });

    test(`${ownTag}: constructing the class defines a dependency class already defined under another tag as an anonymous subclass`, async ({ page }) => {
      const r = await page.evaluate(async ([fixtureName, exportName, own, depList]) => {
        const classes = {};
        for (const [tag, depExport, depFixture] of depList) {
          classes[tag] = (await import(`/${depFixture}.js`))[depExport];
          customElements.define(`other-${tag}`, classes[tag]);
        }
        const Cls = (await import(`/${fixtureName}.js`))[exportName];
        customElements.define(own, Cls);
        const before = depList.map(([tag]) => customElements.get(tag) ?? null);
        const el = document.createElement(own);
        document.body.append(el);
        await el.updateComplete;
        return {
          before,
          constructed: el instanceof Cls,
          subclasses: depList
            .map(([tag]) => tag)
            .filter(tag => {
              const defined = customElements.get(tag);
              return Boolean(defined) && defined !== classes[tag] && Object.getPrototypeOf(defined) === classes[tag];
            }),
        };
      }, [fixture, ownExport, ownTag, deps]);
      expect(r).toEqual({ before: deps.map(() => null), constructed: true, subclasses: deps.map(d => d[0]) });
      expect(logs).toEqual([]);
    });

    // Shoelace's constructor calls `define` for every dependency on every construction, so a versioned owner whose
    // version differs from Velcro's (none: "unknown version") gets Shoelace's warning each time an element is created.
    test(`${ownTag}: constructing the class logs Shoelace's warning for each versioned owner of a dependency tag, every time`, async ({ page }) => {
      const r = await page.evaluate(async ([fixtureName, exportName, own, depTags]) => {
        const foreign = {};
        for (const tag of depTags) {
          foreign[tag] = class extends HTMLElement {};
          foreign[tag].version = '2.20.1';
          customElements.define(tag, foreign[tag]);
        }
        const Cls = (await import(`/${fixtureName}.js`))[exportName];
        customElements.define(own, Cls);
        for (let i = 0; i < 2; i++) {
          const el = document.createElement(own);
          document.body.append(el);
          await el.updateComplete;
        }
        return { kept: depTags.filter(tag => customElements.get(tag) === foreign[tag]) };
      }, [fixture, ownExport, ownTag, deps.map(d => d[0])]);
      expect(r).toEqual({ kept: deps.map(d => d[0]) });
      const warnings = deps.map(([tag]) => `warning: Attempted to register <${tag}> (unknown version), but <${tag}> v2.20.1 has already been registered.`);
      expect(logs).toEqual([...warnings, ...warnings]);
    });

    test(`${ownTag}: constructing the class logs nothing when a dependency tag's owner has the same version`, async ({ page }) => {
      const r = await page.evaluate(async ([fixtureName, exportName, own, depList]) => {
        const foreign = {};
        for (const [tag, depExport, depFixture] of depList) {
          (await import(`/${depFixture}.js`))[depExport].version = '2.20.1';
          foreign[tag] = class extends HTMLElement {};
          foreign[tag].version = '2.20.1';
          customElements.define(tag, foreign[tag]);
        }
        const Cls = (await import(`/${fixtureName}.js`))[exportName];
        customElements.define(own, Cls);
        const el = document.createElement(own);
        document.body.append(el);
        await el.updateComplete;
        return { kept: depList.filter(([tag]) => customElements.get(tag) === foreign[tag]).map(([tag]) => tag) };
      }, [fixture, ownExport, ownTag, deps]);
      expect(r).toEqual({ kept: deps.map(d => d[0]) });
      expect(logs).toEqual([]);
    });
  }
});
