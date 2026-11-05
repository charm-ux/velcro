# Registration, shared project state, and barrel entry points

Status: documented design concern; not a completed registration redesign.
Related: [Velcro architecture and registration gate](../specs/velcro.md#53-registration-is-an-early-gate).

## Why this note exists

Velcro must preserve `sl-*` names without changing another Charm library's namespace.
Moving repeated configuration into one module reduces duplication, but does not
isolate mutable state. A barrel can also make configuration or registration run
when a caller intended only to import a class.

This records inspected source behavior and future verification requirements. It
is not an attribution of a particular architectural opinion, a blanket ban on
barrels, or approval to modify core/FUI/CUI.

## The pattern in the existing layers

Paths in this table are relative to the named repository, not a local checkout.
The inspected FUI package metadata is version 0.0.3, pinning core 0.5.2; CUI is
0.0.4, pinning FUI 0.0.3. These are source snapshots, not a fresh audit of every
published bundle or application dependency graph.

| Layer | Configuration and registering entry |
| --- | --- |
| Core | `packages/core/src/utilities/project.ts` exports a project instance. `updateProject()` sets configuration, updates icons and updates the scope. `packages/core/src/components/button/index.ts` calls `project.scope.registerComponent(button)`. |
| FUI | `src/project-config.ts` imports `project` from `@charm-ux/core`, calls `updateProject({ prefix: 'fui', icons: ... })`, and re-exports it. `src/components/button/index.ts` imports that module and registers the class. |
| CUI | `src/project-config.ts` imports `project` from `@charm-ux/fui`, calls `updateProject({ prefix: 'cui', icons: ... })`, and re-exports it. `src/components/button/index.ts` imports that module and registers the class. |
| Velcro prototype | `packages/velcro/src/components/button/index.ts` imports core's project directly, sets `prefix: 'sl'`, and registers the class. This currently repeats configuration in the component entry rather than centralizing it. |

FUI and CUI therefore centralize the prefix assignment; they do not have a
separate project merely because the configuration lives in a separate file.
CUI's use of FUI classes as an implementation layer is distinct from promising
that independently registered FUI and CUI elements can coexist without interference.

In core's `packages/core/src/utilities/scope.ts`:

- Project configuration is module-level mutable state.
- `CharmScope` uses a singleton within that module instance.
- Scope lookup reads the current prefix; `baseNameMap` is keyed by base name,
  not by library namespace.
- The maps on `window.CharmComponents` are shared in the document, including
  across separately loaded copies that use those globals.
- Registration defines an anonymous subclass rather than the supplied class itself.

Do not conflate module-level and document-global state: duplicated core modules
can have different project instances while still encountering the shared maps.
Deduplication alone is not an isolation guarantee, nor are separate copies.

## What the barrels actually do

A filename such as `index.ts` does not identify its side effects; its dependency
edges and evaluated code do.

1. **Core's component barrel** (`packages/core/src/components/index.ts`) re-exports
   class modules such as `button/button.js`, rather than the registering
   `button/index.js` entry.
2. **FUI/CUI component barrels** (`src/components/index.ts`) likewise re-export
   class modules. Do not describe those lists as directly registering every component.
3. **FUI/CUI package-root barrels** (`src/index.ts`) also re-export
   `project-config.js`. Their root `index.js` forwards to `dist/index.js`.
   The configuration dependency can therefore run on a package-root import.
4. **CUI's button class** (`src/components/button/button.ts`) imports
   `FluentButton` from `@charm-ux/fui`. That class import reaches FUI's root
   configuration edge; it is not equivalent to importing only a leaf class module.
5. **Velcro's current root** (`packages/velcro/src/index.ts`) re-exports registering
   component entries. It is intentionally an aggregate registration entry today,
   not a class-only barrel.

This is a source-graph assessment, not proof that every transitive class dependency
is side-effect-free or that every bundled build evaluates an identical graph.

## Why a barrel can be dangerous here

- **Hidden initialization:** a named import from an ESM barrel does not by itself
  mean only the named class's module is evaluated. Runtime re-export dependencies
  participate in module evaluation unless an optimizer can safely remove them.
  Type-only imports/exports erased by TypeScript are a different case.
- **Order and caching:** with a shared project instance, a different library can
  change configuration between imports. A previously evaluated `project-config`
  module is cached; importing it again does not restore its prefix. A later
  component entry can consequently register using another library's active prefix.
- **Unexpected registrations:** an aggregate that reaches registering entries can
  define unrelated tags, encounter collisions, and alter initialization order.
  A true registering entry can be useful; the risk is disguising it as a neutral import.
- **Dependency breadth and cycles:** broad barrels can pull in unrelated modules,
  icon configuration and browser-only dependencies. Importing an internal helper
  through an aggregate that exports its caller can also create a cycle.
- **Bundling surprises:** tree shaking depends on the graph, optimizer and truthful
  side-effect metadata. Neither FUI nor CUI's inspected package manifest declares
  `sideEffects`; that absence is not evidence that their entry points are pure.
  Marking everything `sideEffects: false` is not a fix: it can remove registration
  or stylesheet imports that consumers rely on.
- **Server evaluation:** a class-only entry is not automatically SSR-safe. Core's
  scope module accesses browser globals, so even a leaf's transitive imports need
  a separate server-safety check.

These are mixed-library and packaging risks, not a claim that the intended
single-design-system usage of FUI or CUI is universally broken. Local runtime
probes covered core 0.5.2 with Velcro; real FUI/CUI mixed-package scenarios still
need their own tests before asserting exact failures for those distributions.

## Direction for Velcro — proposed, not implemented

Keep three contracts explicit:

- **Class-only entry:** exports the actual implementation, without defining tags
  or reconfiguring another project's prefix. Server compatibility is a separate promise.
- **Per-component registering entry:** deliberately registers that component and
  its required dependency closure, with defined repeat-import/collision behavior.
- **Aggregate registering entry:** a clearly documented convenience that registers
  the supported set. Do not silently change the current root's registering contract.

A small Velcro-owned registration helper can centralize `sl-` name construction
from `baseName`, preserve the supplied constructor, and check collisions without
calling `project.updateProject()` on import. Native `customElements.define()`
trials demonstrated the basic button identity and prefix-isolation path.

That trial is not a complete replacement for core's scope machinery. Core classes
with dependencies or templates using `this.scope` can fail when registered outside
core's scope maps. Nested dependencies, icons and base-name attributes must be
resolved explicitly before extending that approach across the catalog. Any actual
core change still needs a failing reproduction and separate approval.

Do not treat these as solutions by themselves:

- Moving `updateProject()` into a root barrel or one cached config module.
- Saving/changing/restoring the shared prefix around registration.
- Replacing imports with leaf paths without checking transitive side effects.
- Disabling side-effect metadata or depending on one lucky import order.

## Keep this on the verification checklist

When registration, exports, generators or component dependencies change, test:

- Root versus direct registering versus class-only imports; actual package exports,
  not a source-path substitution that hides a missing public entry.
- Class-only import without tag definition or prefix reconfiguration; aggregate
  registration still behaving according to its documented contract.
- Both library orders and interleaved component imports after another library
  changes its configuration; core, FUI, CUI and Velcro where applicable.
- Shared and duplicated dependency copies; foreign tags and repeated definitions;
  exported/registered constructor identity and construction after definition.
- Nested dependency registration, rendered tag lookup, icons and base-name attributes,
  not just an isolated leaf that happens not to use a scope.
- Development and production bundles with representative named and side-effect
  imports; narrow, correct `sideEffects` declarations and packed consumers.
- Browser registration and separately advertised server-safe imports.

Convert exploratory findings into committed regression tests with each fix. A
source-level review or a passing leaf probe is not a full mixed-library guarantee.
