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
 * Every Velcro component renders its own shadow template, so most of core's template-bound API (slots, parts, and the
 * CSS custom properties its component styles read) does not apply to a Velcro element. Only the inherited entries
 * listed here are kept: they still take effect, because the component keeps core's styles and their selectors still
 * match its template (including :active and [disabled] rules whose specificity beats Velcro's).
 * tests/product/inherited-api.spec.mjs measures this in the browser for every component and fails
 * when this list and the measured effect differ.
 */
// sl-button renders Shoelace's styles instead of core's button styles, so none of core's --button-* properties apply.
export const keptInherited = {};

/**
 * Inherited core events a Velcro element does not emit. sl-switch emits Shoelace's sl-change and sl-input instead of
 * core's `change` and `input` events (as in Shoelace, the host still receives the platform's composed `input` event
 * from its inner checkbox on a click). sl-tab-panel never emits core's tab-show, tab-hide, tab-after-show and
 * tab-after-hide: they come from core's internal `visible` property, which belongs to core's own tabs and is inert here.
 */
export const droppedInheritedEvents = {
  VelcroSwitch: ['change', 'input'],
  VelcroTabPanel: ['tab-show', 'tab-hide', 'tab-after-show', 'tab-after-hide'],
};

function velcroInheritance() {
  return {
    name: 'velcro-inheritance',
    packageLinkPhase({ customElementsManifest }) {
      for (const mod of customElementsManifest.modules) {
        for (const decl of mod.declarations ?? []) {
          if (!decl.customElement) continue;
          for (const key of ['slots', 'cssParts', 'cssProperties']) {
            const keep = keptInherited[decl.name]?.[key] ?? [];
            if (decl[key]) decl[key] = decl[key].filter(item => !item.inheritedFrom || keep.includes(item.name));
            if (decl[key]?.length === 0) delete decl[key];
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
