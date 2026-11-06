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
 * - `scope` is always available, including in constructors, `connectedCallback` (also on reconnection) and controllers'
 *   `hostConnected`. Only core's base-name marker attribute (for example `switch=""`, written by `CharmElement`'s
 *   `connectedCallback` as `this.setAttribute(this.scope.getBaseName(this), '')`) is skipped, because Shoelace hosts
 *   have none: while `connectedCallback` runs, the element has an own `setAttribute` that passes every call through to
 *   the inherited method, except that a `getBaseName(element)` call arms it to drop the next call if that call is
 *   exactly `(baseName, '')`. The own property is removed when `connectedCallback` returns.
 *
 * Limits for reuse: core logic that finds elements by those marker attributes (for example `[accordion-item]`,
 * `[menu-item]` or `closest('[menu]')` in core's accordion and menus) does not work on Velcro hosts and must be
 * replaced in the Velcro subclass. Core's shared scope, prefix, project configuration and tag maps are never read or
 * written.
 */
import { unsafeStatic, type StaticValue } from 'lit/static-html.js';

const PREFIX = 'sl';
const BASE_NAME = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

/** A component class as core declares it in `static dependencies`. */
type Dependency = (abstract new (...args: never[]) => HTMLElement) & { baseName?: string };

const installed = new WeakSet<object>();
// Elements whose connectedCallback is running (nesting depth), and the marker base name armed by getBaseName().
const connecting = new WeakMap<Element, number>();
const armed = new WeakMap<Element, string>();
const filters = new WeakMap<Element, unknown>();

// Core's marker write is `this.setAttribute(this.scope.getBaseName(this), '')`: the method is looked up before
// getBaseName() runs, so the filter has to be in place for the whole connectedCallback.
function startConnecting(element: Element) {
  const depth = connecting.get(element) ?? 0;
  connecting.set(element, depth + 1);
  if (depth > 0 || Object.prototype.hasOwnProperty.call(element, 'setAttribute')) return;
  const filter = (name: string, value: string) => {
    const baseName = armed.get(element);
    armed.delete(element);
    if (baseName !== undefined && name === baseName && value === '') return;
    const inherited = Reflect.get(Object.getPrototypeOf(element), 'setAttribute', element) as Element['setAttribute'];
    inherited.call(element, name, value);
  };
  filters.set(element, filter);
  Object.defineProperty(element, 'setAttribute', { configurable: true, writable: true, value: filter });
}

function endConnecting(element: Element) {
  const depth = (connecting.get(element) ?? 1) - 1;
  if (depth > 0) {
    connecting.set(element, depth);
    return;
  }
  connecting.delete(element);
  armed.delete(element);
  const filter = filters.get(element);
  filters.delete(element);
  if (filter && Object.getOwnPropertyDescriptor(element, 'setAttribute')?.value === filter) {
    delete (element as { setAttribute?: unknown }).setAttribute;
  }
}

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
    const baseName = tag.startsWith(`${PREFIX}-`) ? tag.slice(PREFIX.length + 1) : tag;
    if (typeof elementOrTagName !== 'string' && connecting.has(elementOrTagName)) armed.set(elementOrTagName, baseName);
    return baseName;
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

/**
 * Installs the Velcro scope on `component.prototype` (see the module comment). Call it right after the class
 * declaration and before the class is defined as a custom element (the registry captures `connectedCallback` when it is
 * defined); it throws for a class that is already defined. Repeated calls are no-ops. Returns the class.
 */
export function useVelcroScope<T extends abstract new (...args: never[]) => HTMLElement>(component: T): T {
  const proto = component.prototype as HTMLElement & { connectedCallback?: () => void };
  if (installed.has(proto)) return component;
  const registry = customElements as CustomElementRegistry & { getName?(constructor: unknown): string | null };
  if (registry.getName?.(component)) {
    throw new Error('Velcro scope: useVelcroScope must be called before the class is defined as a custom element.');
  }
  installed.add(proto);
  const connected = proto.connectedCallback;
  Object.defineProperties(proto, {
    scope: {
      configurable: true,
      get() {
        return velcroScope;
      },
      // Core's constructor assigns getScope(this), which does not know sl-* tags; the Velcro scope stays in place.
      set() {},
    },
    connectedCallback: {
      configurable: true,
      writable: true,
      value(this: HTMLElement) {
        startConnecting(this);
        try {
          connected?.call(this);
        } finally {
          endConnecting(this);
        }
      },
    },
  });
  return component;
}
