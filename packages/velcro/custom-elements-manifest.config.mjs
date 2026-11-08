// Custom Elements Manifest for Velcro. Members inherited from @charm-ux/core are resolved from core's shipped manifest
// and keep an `inheritedFrom` that names the core class and package, so the docs and wrappers show the full API.
// The manifest is build output shipped at the package root (ignored, never committed); the React wrappers and JSX types
// are build output in dist/react. Source checks (scripts/api/model.mjs analyzeVelcro) redirect them with `--outdir` and
// VELCRO_CEM_REACT_OUTDIR.
import { createRequire } from 'node:module';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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
 * Every Velcro component renders its own shadow template, so most of core's template-bound API (slots, parts, and the
 * CSS custom properties its component styles read) does not apply to a Velcro element. Only the inherited entries
 * a component declares with @inheritedKept (below) are kept: they still take effect, because the component keeps core's styles and their selectors still
 * match its template (including :active and [disabled] rules whose specificity beats Velcro's).
 * tests/product/inherited-api.spec.mjs measures this in the browser for every component and fails
 * when these declarations and the measured effect differ.
 */
// sl-button renders Shoelace's styles instead of core's button styles, so none of core's --button-* properties apply.
//
// Each component declares its own exceptions with JSDoc tags on its class, so adding a component never edits a shared
// table here:
//   @inheritedKept <slots|cssParts|cssProperties> <name> - <why it still takes effect>
//   @inheritedEventDropped <event> - <why the element never emits it>
const TAG_LINE = /^\s*\*\s*@(inheritedKept|inheritedEventDropped)\s+(.*)$/;
const KEPT_KEYS = ['slots', 'cssParts', 'cssProperties'];

/** { [className]: { kept: { slots, cssParts, cssProperties }, droppedEvents } } from the component sources. */
export function inheritanceDeclarations(componentsDir = fileURLToPath(new URL('./src/components/', import.meta.url))) {
  const out = {};
  for (const dir of readdirSync(componentsDir, { withFileTypes: true }).filter(e => e.isDirectory())) {
    for (const file of readdirSync(path.join(componentsDir, dir.name)).filter(f => f.endsWith('.ts'))) {
      const text = readFileSync(path.join(componentsDir, dir.name, file), 'utf8');
      for (const [, doc, name] of text.matchAll(/\/\*\*((?:[^*]|\*(?!\/))*)\*\/\s*export (?:default )?class (\w+)/g)) {
        for (const line of doc.split('\n')) {
          const m = TAG_LINE.exec(line);
          if (!m) continue;
          const entry = (out[name] ??= { kept: { slots: [], cssParts: [], cssProperties: [] }, droppedEvents: [] });
          const words = m[2].split(/\s+/);
          if (m[1] === 'inheritedEventDropped') entry.droppedEvents.push(words[0]);
          else if (KEPT_KEYS.includes(words[0]) && words[1]) entry.kept[words[0]].push(words[1]);
          else throw new Error(`${dir.name}/${file}: @inheritedKept needs one of ${KEPT_KEYS.join(', ')} and a name`);
        }
      }
    }
  }
  return out;
}

const declarations = inheritanceDeclarations();
/** Inherited slots, parts and CSS custom properties each class keeps: { [className]: { slots, cssParts, cssProperties } }. */
export const keptInherited = Object.fromEntries(Object.entries(declarations).map(([name, d]) => [name, d.kept]));
/**
 * Inherited core events each class never emits: { [className]: [event] }. For example sl-switch emits Shoelace's
 * sl-change and sl-input instead of core's `change` and `input`, and sl-tab-panel never emits core's tab-show family.
 */
export const droppedInheritedEvents = Object.fromEntries(Object.entries(declarations)
  .filter(([, d]) => d.droppedEvents.length).map(([name, d]) => [name, d.droppedEvents]));

/** The inheritance step of the manifest build; exported so tests/api/superclass-resolution.test.mjs can run it on fixtures. */
export function velcroInheritance() {
  return {
    name: 'velcro-inheritance',
    packageLinkPhase({ customElementsManifest }) {
      const declarations = customElementsManifest.modules.flatMap(m => m.declarations ?? []);
      for (const mod of customElementsManifest.modules) {
        for (const decl of mod.declarations ?? []) {
          if (!decl.customElement) continue;
          // A component may extend a Velcro-local typing class that only loosens inherited property declarations so the
          // component can declare Shoelace's own types (sl-textarea's CoreTextAreaTyping). It adds no members to the API,
          // so the component's superclass is the core class that typing class extends.
          // Only a superclass the analyzer resolved to a class of this package (it has no `package`, only a `module`) and that
          // is not itself a custom element qualifies; a superclass imported from core carries its `package` and is left alone.
          const local = decl.superclass && !decl.superclass.package
            ? declarations.find(d => d.name === decl.superclass.name && !d.customElement) : undefined;
          if (local?.superclass && coreClasses.has(local.superclass.name)) decl.superclass = local.superclass;
          for (const key of ['slots', 'cssParts', 'cssProperties']) {
            const keep = keptInherited[decl.name]?.[key] ?? [];
            if (decl[key]) decl[key] = decl[key].filter(item => !item.inheritedFrom || keep.includes(item.name));
            if (decl[key]?.length === 0) delete decl[key];
          }
          // A Velcro class that redeclares an inherited core property without an attribute (for example sl-radio's
          // `checked`, `@property({ attribute: false })`) no longer observes core's attribute, but the analyzer keeps the
          // inherited attribute entry; drop it so the manifest matches the runtime.
          const propertyOnly = new Set((decl.members ?? [])
            .filter(m => m.kind === 'field' && !m.static && !m.inheritedFrom && !m.attribute).map(m => m.name));
          if (decl.attributes) {
            decl.attributes = decl.attributes.filter(a => !(a.inheritedFrom && propertyOnly.has(a.fieldName)));
            if (decl.attributes.length === 0) delete decl.attributes;
          }
          const dropped = droppedInheritedEvents[decl.name] ?? [];
          if (decl.events) decl.events = decl.events.filter(e => !e.inheritedFrom || !dropped.includes(e.name));
          for (const key of ['members', 'attributes', 'events', 'slots', 'cssParts', 'cssProperties']) {
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
 * the manifest afterwards).
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

/**
 * Corrects three defects of the generated React output (checked by type-tests/ and tests/product/react.spec.mjs):
 * - The wrappers hand every property to React. React 19 assigns `undefined` to the element property when a prop is
 *   removed, which overwrites the element's default (and can break rendering, e.g. the progress ring's label). The
 *   element's properties are instead set by `useElementProps`: a changed supplied value is assigned, a removed one
 *   restores the element's value from before the wrapper first set it, and a prop omitted throughout is never
 *   touched. Global attributes (exportparts, for, part,
 *   tabindex) stay React attributes and are passed only when supplied.
 * - Events with a typed detail get a wrong type name (`<C>ElementEvent<C><Event>ElementEvent`).
 * - The JSX `ref` type accepts only the element or a callback; React object refs (createRef/useRef) are added.
 */
const globalAttributes = new Set(['exportparts', 'for', 'part', 'tabindex']);
export function fixWrapperSource(text) {
  const managed = [];
  // A property whose attribute name differs (arrowPadding / arrow-padding) is generated as an attribute with the camelCase
  // prop as its value (`"arrow-padding": arrowPadding ?? props["arrow-padding"]`, wrapped onto two lines when long). The
  // camelCase prop is set as the element property instead, like every other property; the hyphenated spelling, if a
  // caller uses it, stays in restProps and is passed to React as an attribute.
  text = text.replace(/^ {6}"([\w-]+)":\s+(\w+) \?\? props\["\1"\],\n/gm, (line, attribute, name) => {
    managed.push(name);
    return '';
  });
  let out = text.replace(/^( {6})("?[\w-]+"?): (\w+)( \? true : undefined)?,\n/gm, (line, indent, key, name) => {
    if (key === 'ref' || key === 'style') return line;
    if (globalAttributes.has(key)) return `${indent}...(${name} === undefined ? {} : { ${key}: ${name} }),\n`;
    managed.push(name);
    return '';
  });
  if (!managed.length) return out;
  // The generator's react-utils import is one line, or a multi-line list when it also imports useProperties (for
  // public properties without an attribute, e.g. sl-button's `button`, `validity` and `validationMessage`).
  out = out.replace(/import \{([^}]*?)\s*\} from "\.\/react-utils\.js";/,
    (_, names) => `import { ${names.split(',').map(n => n.trim()).filter(Boolean).concat('useElementProps').join(', ')} } from "./react-utils.js";`);
  return out.replace(/^(  return React\.createElement\()/m, `  useElementProps(ref, { ${managed.join(', ')} });\n\n$1`);
}
const useElementProps = `
/**
 * Sets element properties from props, the @lit/react way: a supplied value is assigned when it differs from the value
 * supplied on the previous render; a prop that was supplied and is now omitted restores the value the element had
 * before the wrapper first set it; a prop omitted on both renders is never touched, so state the element manages
 * itself (a toggled pressed, an expanded) survives re-renders.
 */
export function useElementProps(targetElement, props) {
  const previous = useRef({});
  const defaults = useRef({});
  useLayoutEffect(() => {
    const el = targetElement?.current;
    if (!el) {
      return;
    }
    for (const [name, value] of Object.entries(props)) {
      const before = previous.current[name];
      if (value !== undefined) {
        if (!(name in defaults.current)) {
          defaults.current[name] = el[name];
        }
        if (value !== before) {
          el[name] = value;
        }
      } else if (before !== undefined) {
        el[name] = defaults.current[name];
      }
    }
    previous.current = { ...props };
  });
}
`;
export function fixDeclarations(text) {
  return text
    .replace(/\b(\w+)ElementEvent\1(\w+ElementEvent)\b/g, '$1$2')
    .replace(/ref\?: T \| \(\(e: T\) => void\);/g, 'ref?: T | ((e: T | null) => void) | { current: T | null } | null;');
}
function restoreNativeEvents() {
  return {
    name: 'velcro-restore-native-events',
    packageLinkPhase() {
      for (const [decl, events] of hidden) decl.events = events;
      hidden.clear();
      for (const file of readdirSync(reactDir)) {
        const fix = file.endsWith('.d.ts') ? fixDeclarations
          : file === 'react-utils.js' ? t => (t.includes('useElementProps') ? t : t + useElementProps)
          : file.endsWith('.js') && file !== 'index.js' ? fixWrapperSource : null;
        if (!fix) continue;
        const target = path.join(reactDir, file);
        const text = readFileSync(target, 'utf8');
        const fixed = fix(text);
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
      // The plugin asks for a path once per declaration in a module, so also for exported constants that are not
      // components (split-panel's SNAP_NONE), which have no tag name; every component module is src/components/<name>/<name>.ts.
      componentTypePath: (_, __, modulePath) => `../${modulePath.replace(/^src\//, '').replace(/\.ts$/, '.js')}`,
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
