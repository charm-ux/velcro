/**
 * Internal registration helper. Not part of the public package exports.
 *
 * Velcro defines its own exported constructor through the native custom element registry, so
 * `customElements.get('sl-button') === VelcroButton` and `new VelcroButton()` works. It deliberately does not call
 * `project.updateProject`, touch core's shared scope maps or patch prototypes, which keeps the page-wide core prefix
 * (`ch`) intact. Limit: core's scope is never populated for these tags, so components that depend on core's
 * scope-aware lookups (declared `dependencies`, `scope.tag(...)` in templates) are NOT supported by this helper alone;
 * such a class opts in to Velcro's local scope resolver (`internal/scope.ts`, `useVelcroScope`) before it is defined.
 * Registration follows Shoelace's `define`: a tag clash never throws (see `defineVelcroComponent`). There is no strict
 * variant. Importing this module has no side effects.
 */

/** The prefix of every Velcro tag name (Shoelace-compatible). */
const PREFIX = 'sl';

/** A custom element constructor that carries the static core `baseName`, for example `'button'`. */
export type VelcroComponentConstructor = CustomElementConstructor & { baseName: string };

/**
 * Defines `component` as `sl-<baseName>` and returns the tag name. Matches Shoelace 2.20.1's `ShoelaceElement.define`,
 * which Shoelace uses both for a component's own tag (each registering file, for example `SlButton.define('sl-button')`)
 * and for every entry of a component's `static dependencies` (in its constructor):
 *
 * - The tag is not defined yet: defines the constructor itself. If the platform refuses it (for example because the
 *   constructor is already registered under another tag), defines an anonymous subclass of it under the tag instead. An
 *   error from that second definition propagates unchanged.
 * - The tag is already defined, by this constructor or by any other one (another library, a second copy of Velcro or an
 *   anonymous subclass from an earlier fallback): leaves the registry alone and never throws. As in Shoelace, it logs a
 *   console warning when the two constructors' static `version` values differ (a missing or empty `version` counts as
 *   "unknown version"). Velcro classes declare no `version`, so the warning appears only when the existing constructor
 *   declares one, such as a Shoelace element.
 */
export function defineVelcroComponent(component: VelcroComponentConstructor): string {
  const baseName = (component as { baseName?: unknown } | null)?.baseName;
  if (typeof component !== 'function' || typeof baseName !== 'string' || !/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(baseName)) {
    throw new TypeError('defineVelcroComponent requires a constructor with a lowercase kebab-case static baseName.');
  }
  const tag = `${PREFIX}-${baseName}`;
  const existing = customElements.get(tag);
  if (!existing) {
    // Shoelace defines the class itself first (so `new VelcroButton()` works and the registered constructor is the
    // exported one) and falls back to an anonymous subclass, because a registry accepts each constructor only once.
    try {
      customElements.define(tag, component);
    } catch {
      customElements.define(tag, class extends component {});
    }
    return tag;
  }
  // Shoelace's version check, with its message text.
  let newVersion = ' (unknown version)';
  let existingVersion = newVersion;
  if ('version' in component && component.version) newVersion = ' v' + (component.version as string);
  if ('version' in existing && existing.version) existingVersion = ' v' + (existing.version as string);
  if (newVersion && existingVersion && newVersion === existingVersion) return tag;
  console.warn(`Attempted to register <${tag}>${newVersion}, but <${tag}>${existingVersion} has already been registered.`);
  return tag;
}
