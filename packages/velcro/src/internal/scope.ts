/**
 * Velcro-local scope resolver for subclasses of scope-dependent core components. Internal; not a package export.
 *
 * Core's `CharmElement` constructor reads `this.scope = getScope(this)` and then calls
 * `this.scope.registerComponent(dependency)` for every class in `static dependencies`; core templates also call
 * `this.scope.tag('<baseName>')`. `getScope()` only knows tags that core's own scope registered, so for an element that
 * `defineVelcroComponent` registered natively as `sl-<baseName>` it returns `undefined`, and a core component that
 * declares dependencies throws while it is being constructed.
 *
 * `useVelcroScope(Class)` gives one Velcro class (and its subclasses) a fixed, Velcro-local scope instead:
 * - `scope.prefix` is `sl`, `scope.suffix` is empty, `scope.tagName('icon')` is `sl-icon` and `scope.tag('icon')` is
 *   the matching static tag for core templates. Core's assignment of `getScope(this)` is ignored.
 * - `scope.registerComponent(...dependencies)` defines nothing. It checks that `sl-<baseName>` of each dependency is
 *   already defined by that dependency class or by a subclass of it (a Velcro counterpart extends the core class), and
 *   throws a clear error otherwise, so a dependency without a Velcro counterpart is never a silent gap. A Velcro class
 *   whose template renders no dependency overrides `static dependencies`; its registering entry defines the Velcro
 *   counterparts before the class itself.
 * - While the element's `connectedCallback` runs, `scope` reads as `undefined`. That is how core's `CharmElement`
 *   skips its base-name marker attribute (for example `switch=""`), which Velcro hosts do not carry (Shoelace has none).
 *
 * Core's shared scope, prefix, project configuration and tag maps are never read or written.
 */
import { unsafeStatic, type StaticValue } from 'lit/static-html.js';

const PREFIX = 'sl';
const BASE_NAME = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

/** A component class as core declares it in `static dependencies`. */
type Dependency = (abstract new (...args: never[]) => HTMLElement) & { baseName?: string };

function tagName(baseName: string): string {
  if (typeof baseName !== 'string' || !BASE_NAME.test(baseName)) {
    throw new TypeError(`Velcro scope: "${String(baseName)}" is not a lowercase kebab-case base name.`);
  }
  return `${PREFIX}-${baseName}`;
}

/** The scope object a `useVelcroScope` class sees as `this.scope`. */
export const velcroScope = Object.freeze({
  prefix: PREFIX,
  suffix: '',
  /** The Velcro tag for a core base name, for example `sl-icon` for `icon`. */
  tagName,
  /** The static tag for a core template, for example `<${this.scope.tag('icon')}>`. */
  tag(baseName: string): StaticValue {
    return unsafeStatic(tagName(baseName));
  },
  /** The base name of a Velcro element or tag name, for example `switch` for `sl-switch`. */
  getBaseName(elementOrTagName: Element | string): string {
    const tag = typeof elementOrTagName === 'string' ? elementOrTagName : elementOrTagName.localName;
    return tag.startsWith(`${PREFIX}-`) ? tag.slice(PREFIX.length + 1) : tag;
  },
  /** The constructor that owns `sl-<baseName>`, if any. */
  getComponent(baseName: string): CustomElementConstructor | undefined {
    return customElements.get(tagName(baseName));
  },
  /** Checks that every dependency has a registered Velcro counterpart; defines nothing (see the module comment). */
  registerComponent(...dependencies: Dependency[]): void {
    for (const dependency of dependencies) {
      const tag = tagName(dependency?.baseName as string);
      const defined = customElements.get(tag);
      if (defined && (defined === dependency || defined.prototype instanceof dependency)) continue;
      throw new Error(
        defined
          ? `Velcro scope: <${tag}> is defined by a constructor that does not extend the declared dependency.`
          : `Velcro scope: the dependency <${tag}> is not registered. Register its Velcro counterpart first, or override static dependencies when the template does not render it.`,
      );
    }
  },
});

const connecting = new WeakSet<object>();
const installed = new WeakSet<object>();

/**
 * Installs the Velcro scope on `component.prototype` (see the module comment). Call it once, right after the class
 * declaration and before any instance is created; repeated calls are no-ops. Returns the class.
 */
export function useVelcroScope<T extends abstract new (...args: never[]) => HTMLElement>(component: T): T {
  const proto = component.prototype as HTMLElement & { connectedCallback?: () => void };
  if (installed.has(proto)) return component;
  installed.add(proto);
  const connected = proto.connectedCallback;
  Object.defineProperties(proto, {
    scope: {
      configurable: true,
      get(this: object) {
        return connecting.has(this) ? undefined : velcroScope;
      },
      // Core's constructor assigns getScope(this), which does not know sl-* tags; the Velcro scope stays in place.
      set() {},
    },
    connectedCallback: {
      configurable: true,
      writable: true,
      value(this: HTMLElement) {
        connecting.add(this);
        try {
          connected?.call(this);
        } finally {
          connecting.delete(this);
        }
      },
    },
  });
  return component;
}
