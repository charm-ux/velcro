/**
 * Internal registration helper. Not part of the public package exports.
 *
 * Velcro defines its own exported constructor through the native custom element registry, so
 * `customElements.get('sl-button') === VelcroButton` and `new VelcroButton()` works. It deliberately does not call
 * `project.updateProject`, touch core's shared scope maps or patch prototypes, which keeps the page-wide core prefix
 * (`ch`) intact. Limit: core's scope is never populated for these tags, so components that depend on core's
 * scope-aware lookups (declared `dependencies`, `scope.tag(...)` in templates) are NOT supported by this helper.
 * Importing this module has no side effects.
 */

/** The prefix of every Velcro tag name (Shoelace-compatible). */
const PREFIX = 'sl';

/** A custom element constructor that carries the static core `baseName`, for example `'button'`. */
export type VelcroComponentConstructor = CustomElementConstructor & { baseName: string };

/**
 * Defines `component` as `sl-<baseName>` and returns the tag name.
 *
 * - First call: defines the constructor itself (not a subclass) in the native registry.
 * - Same constructor already registered under that tag: returns the tag without redefining (idempotent).
 * - Another constructor already owns the tag: throws a collision error.
 * - The native `define` itself throws (for example the constructor is registered under another tag, or reading its
 *   metadata fails): throws a generic registration error whose `cause` is the original exception.
 */
export function defineVelcroComponent(component: VelcroComponentConstructor): string {
  const baseName = (component as { baseName?: unknown } | null)?.baseName;
  if (typeof component !== 'function' || typeof baseName !== 'string' || !/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(baseName)) {
    throw new TypeError('defineVelcroComponent requires a constructor with a lowercase kebab-case static baseName.');
  }
  const tag = `${PREFIX}-${baseName}`;
  const existing = customElements.get(tag);
  if (existing === component) return tag;
  if (existing !== undefined) {
    throw new Error(
      `Cannot register <${tag}>: that tag is already defined by a different constructor (another library or a second copy of Velcro).`,
    );
  }
  try {
    customElements.define(tag, component);
  } catch (cause) {
    // The platform can reject a definition for several reasons (a tag name taken in the meantime, the constructor already
    // registered under another tag, or an exception while reading its metadata such as `observedAttributes`), so no single
    // cause is asserted here; the original error is kept as `cause`.
    throw new Error(`Cannot register <${tag}>: customElements.define failed (see the cause for the underlying error).`, { cause });
  }
  return tag;
}
