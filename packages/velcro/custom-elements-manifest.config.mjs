// Custom Elements Manifest for Velcro. Members inherited from @charm-ux/core are resolved from core's shipped manifest
// and keep an `inheritedFrom` that names the core class and package, so the docs and wrappers show the full API.
// The manifest is committed and shipped at the package root; the React wrappers and JSX types are build output in
// dist/react. The drift test redirects them with `--outdir` and VELCRO_CEM_REACT_OUTDIR.
import { createRequire } from 'node:module';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { cemSorterPlugin } from '@wc-toolkit/cem-sorter';
import { jsxTypesPlugin } from '@wc-toolkit/jsx-types';
import { reactWrapperPlugin } from '@wc-toolkit/react-wrappers';
import { typeParserPlugin } from '@wc-toolkit/type-parser';
import { cemInheritancePlugin } from 'custom-elements-manifest-inheritance';

const require = createRequire(import.meta.url);
const corePackage = '@charm-ux/core';
const coreCEM = require(`${corePackage}/custom-elements.json`);
const coreClasses = new Set(coreCEM.modules.flatMap(m => (m.declarations ?? []).map(d => d.name)));
const componentDir = tagName => tagName.replace(/^sl-/, '');
const reactDir = process.env.VELCRO_CEM_REACT_OUTDIR || path.join('dist', 'react');

/**
 * Every Velcro component renders its own shadow template, so core's template-bound API (slots, parts, and the CSS custom
 * properties its component styles read) does not describe a Velcro element: only the slots, parts and properties a
 * Velcro class documents itself are kept. Inherited members, attributes and events stay, with core's package named.
 */
function velcroInheritance() {
  return {
    name: 'velcro-inheritance',
    packageLinkPhase({ customElementsManifest }) {
      for (const mod of customElementsManifest.modules) {
        for (const decl of mod.declarations ?? []) {
          if (!decl.customElement) continue;
          for (const key of ['slots', 'cssParts', 'cssProperties']) {
            if (decl[key]) decl[key] = decl[key].filter(item => !item.inheritedFrom);
            if (decl[key]?.length === 0) delete decl[key];
          }
          for (const key of ['members', 'attributes', 'events']) {
            for (const item of decl[key] ?? []) {
              if (item.inheritedFrom && coreClasses.has(item.inheritedFrom.name) && !item.inheritedFrom.package) {
                item.inheritedFrom.package = corePackage;
              }
            }
          }
          if (decl.superclass && coreClasses.has(decl.superclass.name)) {
            decl.superclass = { name: decl.superclass.name, package: corePackage };
          }
        }
      }
    },
  };
}

/**
 * React already types onFocus/onBlur for the native focus and blur events that core lists, so the generated wrappers
 * would declare them twice with conflicting types: they are hidden from the wrapper and JSX generators (and restored in
 * the manifest afterwards). The wrapper generator also emits a wrong type name for events with a typed detail
 * (`<C>ElementEvent<C><Event>ElementEvent`); the written declarations are corrected to the type it does declare.
 */
const nativeEvents = new Set(['focus', 'blur']);
const hidden = new Map();
function hideNativeEvents() {
  return {
    name: 'velcro-hide-native-events',
    packageLinkPhase({ customElementsManifest }) {
      for (const decl of customElementsManifest.modules.flatMap(m => m.declarations ?? [])) {
        if (!decl.events) continue;
        hidden.set(decl, decl.events);
        decl.events = decl.events.filter(e => !nativeEvents.has(e.name));
      }
    },
  };
}
function restoreNativeEvents() {
  return {
    name: 'velcro-restore-native-events',
    packageLinkPhase() {
      for (const [decl, events] of hidden) decl.events = events;
      hidden.clear();
      for (const file of readdirSync(reactDir).filter(f => f.endsWith('.d.ts'))) {
        const target = path.join(reactDir, file);
        const text = readFileSync(target, 'utf8');
        const fixed = text.replace(/\b(\w+)ElementEvent\1(\w+ElementEvent)\b/g, '$1$2');
        if (fixed !== text) writeFileSync(target, fixed);
      }
    },
  };
}

/** The analyzer does not read `@status` and `@since`; copy them from the class JSDoc onto the declaration. */
function statusTags() {
  return {
    name: 'velcro-status-tags',
    analyzePhase({ ts, node, moduleDoc }) {
      if (node.kind !== ts.SyntaxKind.ClassDeclaration || !node.name) return;
      const decl = moduleDoc.declarations?.find(d => d.name === node.name.getText());
      if (!decl) return;
      for (const doc of node.jsDoc ?? []) {
        for (const tag of doc.tags ?? []) {
          const name = tag.tagName.getText();
          const value = typeof tag.comment === 'string' ? tag.comment.trim() : '';
          if ((name === 'status' || name === 'since') && value) decl[name] = value;
        }
      }
    },
  };
}

export default {
  globs: ['src/components/*/*.ts'],
  exclude: ['src/**/*.styles.ts', 'src/**/index.ts', 'src/**/class.ts'],
  litelement: true,
  // The analyzer would otherwise rewrite package.json's customElements field to the output directory.
  packagejson: false,
  plugins: [
    statusTags(),
    typeParserPlugin({ parseObjectTypes: 'partial', parseParameters: true, hideLogs: true }),
    cemInheritancePlugin({ externalManifests: [coreCEM], hideLogs: true }),
    velcroInheritance(),
    cemSorterPlugin({ hideLogs: true }),
    hideNativeEvents(),
    jsxTypesPlugin({
      outdir: reactDir,
      fileName: 'custom-element-jsx.d.ts',
      componentTypePath: (_, tagName) => `../components/${componentDir(tagName)}/${componentDir(tagName)}.js`,
      stronglyTypedEvents: true,
      // Typed CSS custom properties would merge into React's CSSProperties and conflict with its number values.
      excludeCssCustomProperties: true,
      hideLogs: true,
    }),
    reactWrapperPlugin({
      outdir: reactDir,
      modulePath: (_, tagName) => `../components/${componentDir(tagName)}/index.js`,
      stronglyTypedEvents: true,
      hideLogs: true,
    }),
    restoreNativeEvents(),
  ],
};
