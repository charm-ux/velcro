# Registration, shared project state, and barrel entry points

Status: native registration implemented for the current four leaf components;
scope-dependent components remain a documented design concern.
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
| Velcro current leaf components | Button, spinner, badge, card and divider entries call `defineVelcroComponent` from `packages/velcro/src/utilities/registration.ts`. It derives `sl-` names from `baseName` and defines the supplied constructor without updating core's project configuration. The earlier prototype instead changed core's prefix in each entry. |

FUI and CUI therefore centralize the prefix assignment; they do not have a
separate project merely because the configuration lives in a separate file.
CUI's use of FUI classes as an implementation layer is distinct from promising
that independently registered FUI and CUI elements can coexist without interference.

In core's `packages/core/src/utilities/scope.ts`:

- Project configuration is module-level mutable state.
- `CharmScope` uses a singleton within that module instance.
- The scope uses the most recently applied project prefix; `baseNameMap` is keyed
  by base name, not by library namespace.
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

## Current Velcro implementation and remaining scope work

Keep three contracts explicit:

- **Class-only entry:** exports the actual implementation, without defining tags
  or reconfiguring another project's prefix. Server compatibility is a separate promise.
- **Per-component registering entry:** deliberately registers that component and
  its required dependency closure, with defined repeat-import/collision behavior.
- **Aggregate registering entry:** a clearly documented convenience that registers
  the supported set. Do not silently change the current root's registering contract.

The Velcro-owned `defineVelcroComponent` helper centralizes `sl-` name construction
from `baseName`, defines the supplied constructor, accepts an identical repeat
registration and rejects a conflicting constructor. It does not update core's
project configuration or scope maps. Browser regressions cover the current five
leaf components, whole-root map/prefix isolation and constructor identity.
Button, card and spinner also expose class-only entries and `Sl*` aliases; badge and
divider do not yet expose equivalent class-only subpaths. The root remains a
registering aggregate. These checks run in Chromium, Firefox and WebKit; they are not a general FUI/CUI,
SSR or packed-consumer guarantee.

This implementation is not a complete replacement for core's scope machinery. Core classes
with dependencies or templates using `this.scope` fail when registered outside
core's scope maps: core's constructor calls `this.scope.registerComponent(...)` on an
undefined scope. A Velcro class built on such a component opts in to the Velcro-local
scope resolver (`packages/velcro/src/internal/scope.ts`, `useVelcroScope(Class)`, first used
by `sl-switch`). It gives that class a fixed scope that maps core base names to `sl-*` tags
for templates, checks each declared dependency against the registry instead of defining
it (the tag must be defined by the dependency class or a subclass, otherwise construction
fails with a clear error), skips only core's base-name marker attribute write (the scope
itself stays available while the element connects and reconnects, including in subclass
`connectedCallback` code and controllers' `hostConnected`), and never reads or writes core's
shared scope, prefix or project configuration. It must be installed before the class is
defined as a custom element. A class whose template renders no dependency overrides
`static dependencies`. Browser regressions in `tests/product/registration-helper.spec.mjs`
cover it on core's own switch. Nested dependency closures and icons still need a Velcro
counterpart registered first, and core logic that finds elements by marker attributes (such
as `[accordion-item]` or `closest('[menu]')`) has to be replaced in the Velcro subclass. Any actual
core change still needs a failing reproduction and separate approval.

`sl-avatar` and `sl-icon-button` do not use the scope resolver: their templates render a literal `<sl-icon>`, and, like
Shoelace's base element with `static dependencies`, their constructors define Velcro's `sl-icon` when that tag is not
defined yet (falling back to an anonymous subclass when the platform refuses the class itself), so their class-only
entries need no extra registration. `sl-tag` does the same for its remove button: it renders a literal
`<sl-icon-button>`, so its constructor defines Velcro's `sl-icon-button` (and that one defines `sl-icon`). Other
class-only entries (for example button's `sl-spinner`) do not do this yet.

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
