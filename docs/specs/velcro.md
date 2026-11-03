# Velcro — design

Status: local privacy/bootstrap execution authorized; later architecture and
publication gates remain in force.
Size: Build.
Oracle: instrumented, with human checks batched at explicit phase checkpoints.
Repository: repository root (`.`); resolve locally at execution time.
Design worktree: `.worktrees/design-velcro` (repository-relative).
Branch: `design/velcro`
History: existing local-only commits are not approved for publication.

## 1. Outcome and agreed decisions

Build a tier-one Charm extension, alongside FUI, directly on `@charm-ux/core`,
that replaces Shoelace 2.20.1 without application markup or event-handler rewrites.
Build its public documentation in Litro, recreating the Shoelace documentation
experience with Velcro branding and examples running Velcro itself.

Agreed with the owner:

- Proposed package: `@charm-ux/velcro`. Name availability is not yet verified.
- GitHub destination: `charm-ux/velcro`, public only after the security/privacy
  foundation is verified and the public export is approved. Public visibility
  resolves the Free organization plan limitation on private branch protection;
  actual rules and author/reviewer identities still require verified setup.
- Execution uses roost implementers in separate nested worktrees, flock review/fix
  loops, protected GitHub CI, squash merge-on-green, and postmerge cleanup.
- Changesets and package changelogs exist from the first foundation increment,
  with CI enforcement; they are not deferred until publication.
- Security/privacy is a release and merge prerequisite: no machine-specific absolute
  filesystem paths, private PII, credentials, or local agent/session artifacts in
  published source, history, packages, PR content, or CI artifacts. See the
  [security and privacy design](security-privacy.md).
- Up to three implementers may code concurrently. Reviewer capacity is separate
  and sized by risk under flock's approval/cost gates.
- Human PR approval is required initially. Reduced routine human review is a future
  explicit policy decision, never inferred from shorter or fewer review comments.
- Preserve `sl-*` tags and events, public APIs, slots, CSS parts, theme tokens,
  supported import paths, and Shoelace light/dark appearance.
- Target the whole public surface, delivered in gated milestones. A subset is
  an explicitly incomplete preview, never advertised as a complete replacement.
- Core owns shared behavior and extension hooks; Velcro owns Shoelace compatibility
  and styling. Every proposed core change needs separate justification and approval.
- Selective reuse of MIT-licensed Shoelace material is permitted with provenance
  and notices. No original Shoelace runtime in the shipped library or docs site.
- Recreate the site layout and experience, not its organizational identity:
  Velcro installation/repository links and migration guidance, no Shoelace logo,
  sunset promotion, Web Awesome promotion, unrelated social links, or tracking.
- No publish, push, deployment, remote repository creation, or changes in core,
  FUI, CUI, or Litro are authorized by this design alone.

### Meaning of drop-in

Supported migration changes are package/dependency resolution, stylesheet/script
URLs, and asset/base-path configuration. Existing tags, component attributes,
properties, method calls, listeners, slots, CSS-part selectors, and theme overrides
remain unchanged within the tested public contract.

An npm alias is the preferred migration route for applications retaining imports
from `@shoelace-style/shoelace`. Validate it using the packed Velcro artifact before
publishing instructions. Direct imports from `@charm-ux/velcro` are also supported.
A package alias cannot redirect an existing external CDN URL: CDN users must change
that URL. No control over `shoelace.style` or Shoelace's npm namespace is assumed.

"Drop-in" is a release criterion, not a claim that the current empty repository
already satisfies. A contract matrix and tested consumer fixtures define it.

## 2. Scope and non-goals

### In scope

- All 58 components in Shoelace v2.20.1 (inventory in section 12).
- Documented component behavior and public types, including lifecycle events,
  cancelation, promise completion, form ownership, validation, reset, keyboard
  navigation, focus restoration, RTL, localization, and reduced motion.
- Root and per-component ESM imports; class-only imports; React wrappers and event
  types; theme CSS; translations; documented utilities; assets; CDN bundles and
  autoloading. Inventory the actual published tarball, not just repository exports.
- Shoelace defaults, token overrides, CSS parts and slots, including component
  states and light/dark themes. Internal markup may differ if the contract holds.
- Litro docs: home, guides, framework integration pages, component reference,
  tokens, relevant tutorials/resources, search, examples, code previews, and API
  tables. Preserve relevant routes and anchor names where practical; inventory
  intentional adaptations explicitly.
- Release tooling, provenance, generated manifests, developer stories, tests,
  and packed-consumer verification.

### Not promised

- Web Awesome compatibility or moving targets after Shoelace 2.20.1.
- Private implementation fields, private shadow-DOM selectors, hashed chunks,
  undocumented internal deep imports, or identical internal DOM trees.
- Co-registering original Shoelace and Velcro under `sl-*` in one registry.
- A second public `velcro-*` tag family, a new visual theme, or a full core rewrite.
- Reproducing upstream security vulnerabilities. Any necessary public behavioral
  divergence is recorded, reviewed, and reflected in the compatibility claim.
- General server rendering/hydration of all Velcro components in the first
  milestone. The docs must prerender prose and navigation without importing the
  browser-only component runtime. Published SSR-related public behavior remains
  part of the compatibility inventory; any gap blocks the corresponding claim.
- CMS, accounts, analytics, AI agents, a blog, or a hosting integration merely
  because Litro provides scaffolding for them.

## 3. Evidence and limits of this design

Read-only inspection used these local commits:

| Repository | Commit | Relevant evidence |
| --- | --- | --- |
| core | `ca0428d4147cd27d999296566d1edc4cb870db8e` | Package metadata says 0.5.2; scope, project, base classes, button, select, icon, component exports |
| charm-fui | `2d9e76104b63e8027efa1446edbce514937816fc` | Direct core inheritance, button template hooks, registration, theme generation, manifest/wrapper generation |
| charm-cui | `2ec78db045997b3fa093880a149475486b0a700c` | FUI inheritance, composed styles, Vite builds, generated wrappers, lint configuration |

Upstream references:

- [Shoelace v2.20.1](https://github.com/shoelace-style/shoelace/tree/v2.20.1),
  resolved tree `fb59fda70ed737c92611051b49bc7e3a5fed5dc5`.
- [Shoelace installation contracts](https://github.com/shoelace-style/shoelace/blob/v2.20.1/docs/pages/getting-started/installation.md),
  component source, class base, page inventory, and `LICENSE.md`.
- [Litro source snapshot](https://github.com/beatzball/litro/tree/4056e98e5ec40ac4b363fa9d5c3d0fb411c1778f),
  framework metadata 0.17.6; Starlight scaffold, SSG guide, Lit adapter guide,
  and known gaps. Pin a verified published version during foundation work;
  do not install the scaffold's unbounded `latest` dependency.
- [shoelace.style](https://shoelace.style/) and [litro.dev](https://litro.dev/)
  live HTML were inspected for site structure. The tagged Shoelace source is
  the repeatable baseline; the live site is not a stable test oracle.

This is source research, not a completed runtime audit. Registry/tarball access,
package installation, builds, browser tests, and screenshot comparisons have not
been performed. npm registry requests failed during research; GitHub source was
available. Published artifacts must be checked before implementation relies on
source layout or public exports.

## 4. Architecture options and choice

| Option | Benefit | Why not choose it as the architecture |
| --- | --- | --- |
| Restyle/retag FUI | Fast access to many components | Wrong dependency tier; inherits Fluent APIs and behavior rather than Shoelace contracts |
| Fork Shoelace wholesale | Short path to initial compatibility | Not a meaningful Charm tier-one extension; duplicates the behavior core should supply |
| Thin wrappers around original Shoelace | Quick demos | Runtime dependency violates the agreed replacement goal |
| Core subclasses plus explicit compatibility adapters | Reuses Charm foundations and permits exact public contracts | Chosen; requires per-component fit assessment and honest gap tracking |

Inheritance is a reuse tool, not a rule that similarly named classes must inherit
from one another. Prefer `VelcroButton extends CoreButton` when the parent fits.
When it does not, use an appropriate Charm base and reusable controllers. Do not
wrap a core component inside an extra custom element if doing so breaks focus,
forms, event targets, slots, or CSS parts.

### Repository layout

Use one pnpm workspace repository with one publishable library:

```text
velcro/
  packages/
    velcro/                 # @charm-ux/velcro: source and published dist/cdn
      src/
        components/
        compatibility/      # narrowly scoped Shoelace-specific adapters
        utilities/
        events/
        translations/
        themes/
      scripts/
    docs/                   # private Litro SSG app, not an npm library
      content/
      pages/
      src/
      public/
      server/
  tests/
    compatibility/          # differential runner and shared fixtures
    consumers/              # packed package, aliases, framework and CDN checks
  compatibility/            # checked-in inventory and explicit exceptions
  docs/specs/               # project design and follow-on plans
  .changeset/
```

Use Node 24.22.1 and pnpm 9.15.9 for the Velcro bootstrap, with exact dependency
pins. Other repositories retain their own Node configuration; verify Litro's
resolved toolchain requirements before its integration phase. Lock dependencies. Pin core to an exact
published version (0.5.2 is the inspected starting candidate). No permanent local
links or `file:` references in a release. Local links are only for evaluating an
approved core change before release.

Reuse FUI/CUI conventions: ESM `.js` source imports, explicit `Velcro*` classes,
`baseName`-driven nested registration, component-local styles/tests/harnesses,
JSDoc-driven manifests, generated wrappers, and Changesets. Generate the component
layout through a Velcro Plop template rather than manually repeating boilerplate.
Use Litro Markdown for public docs; Storybook remains an internal development tool,
not a second manually maintained public documentation set.

## 5. Component and compatibility layers

### 5.1 Contract inventory first

For each upstream component and utility record:

- public import/export forms and declaration paths;
- attributes and properties, converters, defaults, reflection, and reset semantics;
- methods, return values, promises, overloads, and relevant public base APIs;
- events, detail shape, bubbling/composition/cancelation, and observable ordering;
- slots, CSS parts, CSS custom properties, theme states, and dependencies;
- form, keyboard, accessibility, localization, and asset-loading behavior;
- proposed Charm parent/primitives, evidence links, tests, and milestone status.

States are `not-started`, `in-progress`, `verified`, and `exception`. A skipped test
is not verification. Exceptions carry an owner-approved rationale and impact;
there is no blanket "partial compatibility" escape hatch for claiming completion.
The manifest is input, not a complete oracle: source/docs/runtime fixtures supply
semantics that manifests omit. Never fill unsupported API tables by copying the
upstream manifest into Velcro's generated output.

### 5.2 Public API adapters

Expose Shoelace class names where consumers expect them, e.g. `SlButton`, as
exports of the actual Velcro implementation. Keep the maintainable source name
`VelcroButton`; test imported constructor use and `instanceof` relationships.

Override templates, slots, parts, styles, defaults, and events deliberately.
Do not mechanically rename every emitted event: native events and cancelable
lifecycle events need correct semantics, not just an `sl-` prefix. Avoid emitting
both inherited and adapted public notifications for one action. Core-only APIs
must not accidentally become the documented Shoelace contract.

Maintain type-level checks using unchanged consumer code, without loading both
libraries' global tag/event augmentations into one TypeScript compilation.
Generated wrappers must preserve Shoelace names, prop/event mappings, refs, and
supported import shapes; stock FUI/CUI generator output is not presumed compatible.

### 5.3 Registration is an early gate

Observed in `core/packages/core/src/utilities/scope.ts` and `project.ts`:

- scope construction uses singleton state;
- project configuration is module-global and mutable;
- `window.CharmComponents` contains global maps, including a base-name-only map;
- registration creates `class extends component {}` rather than registering the
  exported class directly;
- `CharmElement` obtains a scope and registers dependencies during construction;
- icons read shared `project.iconSet`.

Shoelace's base uses a static `define()` API and a dependency map. Its class-only
modules and direct imported-constructor usage are documented/represented upstream.
Core's dependency arrays and Shoelace's static APIs cannot simply be assigned to
one another. Class identity, dependency lookup, and initialization order require
an explicit design proof.

Test isolated construction, class-only import side effects, nested dependencies,
repeated imports, conflicting registrations, alternate supported definitions,
and mixed pages with FUI/CUI using representative nested components and icons.
Exercise both import orders and shared versus duplicated core module instances.
A pre-existing FUI/CUI defect must be distinguished from a regression introduced
by Velcro; do not make a speculative scope redesign the first implementation task.

Prefer a Velcro-local adapter using supported hooks. If the required scope or
constructor contract cannot be achieved safely, produce a minimal reproduction
and separately approved core proposal. Do not patch browser registries, mutate
another design system's prefix, import protected internals through unchecked
casts, or silently accept another library's `sl-*` registration as Velcro.

### 5.4 Forms are a separate behavioral gate

Core uses form-associated custom elements and `ElementInternals`. Its button
currently invokes `form.submit()`, which bypasses interactive validation and the
normal submit event. Shoelace uses a controller with its own form integration.
These are observations, not proof that every form scenario is broken.

Compare actual submissions, submitter name/value and overrides, cancellation,
external form owners, reset/default state, disabled fieldsets, custom validity,
invalid events, serialization utilities, and Enter-key submission. Capture form
data and requests, not only component properties. Avoid attaching two active
form-integration mechanisms that submit or serialize values twice.

`CoreSelect` is not the planned direct parent of `VelcroSelect`: it wraps a native
select, has numeric `size`, and a string value; Shoelace has a popup/listbox, named
sizes, and a string-or-array value. Use lower-level Charm primitives, with a
Velcro form adapter where necessary. A reusable value-generic form base is a
possible future core proposal, not a preapproved requirement.

### 5.5 Theme, icon, localization, and animation contracts

Preserve `sl-theme-light`, `sl-theme-dark`, all supported `--sl-*` tokens and public
component-local custom properties. Core styles are not known to be visually
neutral: append or replace styles only after checking layout/state effects.
Map tokens where useful; do not force Shoelace tokens through Fluent/CUI schemas.
Use `@charm-ux/theming` only where it preserves the exact public CSS contract.

Include the supported icon library API, resolver/mutator/sprite behavior, system
icons, base-path utilities, and licensed assets. Test nested components using
Velcro icons instead of core/FUI defaults. Keep locale bundles and formatting
behavior; test `lang`/`dir` changes, inherited direction, and locale fallback.
Use fixed locale/time/timezone in comparisons. Preserve animation customization
and after-event/promise behavior, with deterministic reduced-motion tests.

## 6. Core change boundary and process

A core change is eligible only if it fixes shared behavior or supplies a reusable
extension hook; it must not encode Shoelace tag names, variants, tokens, or events.

For each candidate:

1. Write a failing contract test and minimal reproduction.
2. Show why existing core hooks are insufficient and what a Velcro-only solution
   would cost or break.
3. Propose the smallest backward-compatible core change, with alternatives and
   effects on existing consumers. A behavior correction is not automatically
   nonbreaking just because the method signature stays unchanged.
4. Obtain individual owner approval before modifying core.
5. Implement in a separate nested core worktree/branch, with core regression tests,
   relevant FUI/CUI integration checks, and its own Changeset/release path.
6. Validate Velcro with the candidate locally, then pin the published core release.
   No release that depends on unpublished core code.

If approval is declined or a change is breaking, stop the dependent milestone and
present a local alternative or precise compatibility limitation. Do not quietly
switch to FUI inheritance, copy all of core, or weaken the release gate.

New components without a core counterpart may live in Velcro on Charm bases.
Promote a primitive to core only with a demonstrated cross-extension use case,
not just to make the inheritance diagram uniform. FUI/CUI-only components are
references, not runtime dependencies; any reuse needs provenance and API review.

## 7. Distribution and generated artifacts

Use TypeScript for declarations and ESM library output; use Vite library builds
for browser-ready CDN output. Keep `dist/` npm modules distinct from bundled
`cdn/` modules. Verify generated import paths, explicit side-effect registration,
external dependencies, and tree-shaking with packed consumers.

Required compatibility surfaces include:

| Surface | Examples / semantics |
| --- | --- |
| Root | Named `Sl*` class exports, utilities and event types |
| Traditional loader | `dist/shoelace.js`, `cdn/shoelace.js` |
| Autoloader | `dist/shoelace-autoloader.js`, `cdn/shoelace-autoloader.js` |
| Registering component | `dist/components/button/button.js` |
| Class-only component | `dist/components/button/button.component.js` without registration |
| React | `dist/react` and published per-component import forms |
| Themes/assets | `dist/themes/light.css`, `dark.css`, corresponding CDN assets |
| Utilities/translations | Published `dist/utilities/*` and `dist/translations/*` contracts |
| Metadata | Custom elements manifest and supported type declarations |

The tarball inventory determines additional documented paths. Package export
conditions put `types` before runtime conditions where appropriate. Avoid relying
on workspace source resolution to conceal missing files in the published package.
Do not embed the original package name in internal imports that break npm aliases.

Generate manifests from actual Velcro source with inheritance resolved, then
normalize public aliases intentionally. Derive wrappers, API tables, editor data,
and compatibility coverage from these artifacts. Guard against inherited core
members appearing as supported Shoelace features by accident. Test generation
repeatability and generated path resolution.

React is an optional peer for React entry points, not a dependency that browser
HTML users must load. Verify supported React versions against the pinned upstream
contract. Test static import safety for advertised server-capable wrapper paths
rather than inferring safety from a generator's `ssrSafe` option.

### Changesets and changelogs from the start

Configure Changesets at the workspace root with `main` as its base branch and
`@charm-ux/velcro` as the publishable package. Create
`packages/velcro/CHANGELOG.md` in the initial scaffold with its package heading
only. Show the no-release state in the docs site rather than permanent changelog
prose that would survive the first generated entry. Pending release notes live in
changeset files, not invented release entries. Changesets versioning generates
versioned entries. The docs changelog consumes those entries and may separately
show clearly labeled unreleased changes.

Every release-relevant package PR includes a changeset with its semantic-version
impact and user-facing notes: features, fixes, public API/style changes, relevant
dependencies, and package documentation. Test/tooling-only and internal-refactor
PRs may use an explicit reviewed no-changeset reason. CI validates coverage and
format rather than requiring release notes for unrelated internal planning files.

Test version/changelog generation in a disposable fixture or isolated worktree:
pending changesets must produce the expected version and changelog entries, with
no accidental versioning/publication of private workspaces. Never consume the
working branch's pending changesets merely to test generation. Version PRs must
include the generated changelog and expose exact prerelease/stable versions for
review. Choose the initial release channel at the release gate; installing the
tooling does not authorize either stable or prerelease publication.

Keep changeset creation/status/version commands available from foundation onward.
Any release-PR automation and publish credentials require explicit authorization;
ordinary squash merges must not silently publish packages. Preserve changelog
history and use the same generated source for package and site release history.

## 8. Litro documentation site

### 8.1 Approach and rendering boundary

Use Litro's Lit adapter and static generation, starting from the Starlight recipe
for mechanics, not accepting its visual identity or Shoelace dependency.
Reshape its layout to Shoelace's sidebar, article, component headers, toolbar,
code previews, and responsive navigation. Static deployment is the design target;
provider, domain, and deployment credentials are outside this approval.

All relevant routes get prerendered HTML via Litro's route enumeration. Follow
Litro's SSG guidance: ordinary anchors and full-page navigation, not SPA-only
`litro-link` navigation. Preserve deep links, back/forward behavior, fragments,
and scroll restoration; match user-visible behavior without copying Turbo.

Keep page/layout modules safe to evaluate on the server. They render readable
prose, navigation, API tables, highlighted source, and unupgraded example markup.
The browser entry registers Velcro and activates examples. Do not import Velcro
through a page module or shared barrel that pulls browser globals into SSG.
Use the scaffold's hydration-support import followed by dynamic `app-main`
import; a static import of Lit before the hook can discard prerendered DOM.

Test this boundary in production builds, not just development. Keep one Lit module
instance where hydration requires it. No fake `window` or `document` globals to
make builds appear to succeed. Velcro controls may require JavaScript, but prose,
code, and navigation must remain available without it. Provide no-JS fallback text
for interactive examples and avoid blank-page loading gates.

### 8.2 Actual Velcro integration

Remove the scaffold's Shoelace package dependency, imports, asset mounts, and
copied runtime bundles. Serve assets/themes from the built Velcro package, not
from the upstream reference fixture. Shared `--sl-*` naming is not proof of correct
theming: replace recipe styling that would override Shoelace component tokens with
docs-scoped `--velcro-docs-*` variables.

The site becomes an integration consumer: locally it uses the built workspace
package, and a clean CI job builds it against a packed artifact. Site controls use
native HTML where appropriate and verified Velcro components where enhanced;
never add original Shoelace as a temporary fallback. While the library is partial,
render explicit unimplemented-status pages instead of nonfunctional examples.

### 8.3 Content and route fidelity

Inventory every tagged upstream docs page, permalink, and important anchor.
Classify each as retained, adapted, replaced with a documented redirect, or omitted
with a reason. Include tokens and tutorials, not just the component sidebar.
Replace release history with Velcro's history; link upstream history as reference
rather than presenting it as Velcro work. Replace contribution/support links with
real Velcro destinations only when those destinations exist.

Adapt Markdown and licensed prose with attribution; convert Eleventy/Nunjucks
shortcodes, includes, version placeholders, and demo fences into explicit Litro
build-time processing. Escape ordinary source examples; render only trusted,
checked-in examples. Keep one example source for visible code and executable
markup/scripts to prevent divergence. Bundle module-based example scripts rather
than using `eval` or assuming scripts inserted by `innerHTML` execute.

Generate API tables from Velcro's manifest. Display upstream target version and
Velcro implementation/verification status separately; do not copy Shoelace's
`stable` status or `since` values as if they were Velcro releases.

Search uses a generated local index of canonical prose, headings, and API names,
with keyboard access, result excerpts, fragment links, empty states, and no
external service requirement. Index source content, not a crawler that misses
Declarative Shadow DOM. Add sitemap, canonical URLs, page metadata, and a 404
page explicitly; Litro's recipe does not supply a sitemap automatically.

### 8.4 Visual and interaction fidelity

Match the pinned source baseline's sidebar dimensions, typography, spacing,
article widths, component headers, preview/code presentation, tables, mobile
navigation, and light/dark/system theme behavior. Branding and changed content are
intentional differences, identified in visual fixtures rather than broadly masked.
Theme storage must tolerate unavailable storage, track system changes in automatic
mode, and avoid first-paint theme flashes.

Use controlled screenshots of a locally served upstream baseline, not live pages
with promotions or network-dependent content. Exercise narrow/mobile and desktop
layouts, keyboard search, mobile menu dismissal, code copy feedback, anchors,
reduced motion, and RTL examples. Same-page reference demos must not register the
original library; differential references run in separate documents/contexts.

## 9. Verification design

### Automated/instrumented checks

1. **Inventory and declarations:** compare required names, defaults, attributes,
   public signatures, slots/parts/events, import paths, and statuses; compile
   unchanged consumer TypeScript/TSX fixtures in separate reference/candidate jobs.
2. **Differential behavior:** run the same fixtures against the exact upstream
   package and packed Velcro in isolated browser contexts. Change only package
   resolution/assets, not assertions or application markup. Compare observable
   results, event traces, DOM-exposed state, form data, keyboard/focus behavior,
   utility output, and promise completion. Do not compare private DOM snapshots.
3. **Independent expectations:** assert platform correctness and accessibility
   separately so matching an upstream bug is not the only success criterion.
   Any conflict with strict parity needs an explicit reviewed decision.
4. **Browser matrix:** Chromium, Firefox, WebKit with pinned runner/browser builds;
   light/dark, RTL, keyboard-only, reduced motion, and relevant touch scenarios.
5. **Visual tests:** capture identical component states in the same pinned OS/font/
   browser environment. Use exact geometry assertions plus per-fixture screenshot
   tolerances calibrated on repeated upstream runs. Record tolerances; never
   raise them globally to conceal differences or regenerate baselines blindly.
6. **Packaging:** install packed output in clean consumers; root/deep/class-only/
   React imports, npm alias, asset base paths, standalone CDN, autoloaded dynamic
   content, registration side effects, and absence of original Shoelace runtime.
   Assert required dependency closure is present without pulling all components
   into a cherry-picked entry. Record gzip sizes as evidence before setting budgets.
7. **Docs:** build and serve static output; validate every intended route, internal
   link/fragment, missing-page behavior, search index/result, example and API table.
   Test direct deep-link loads, no-JS readability, hydration preservation, theme
   persistence, nested deployment base paths, mobile navigation, and no console or
   failed-asset errors. Inspect the module/asset graph for upstream runtime leakage.
8. **Architecture:** verify class ancestry/reuse, no FUI/CUI runtime dependencies,
   deterministic generation, and no incidental changes outside approved worktrees.

Use Web Test Runner + Playwright for component-local tests, consistent with Charm,
and Playwright end-to-end/visual tests for differential consumers and the site.
Use axe-based automated checks plus explicit interaction assertions; automated
accessibility checks do not replace assistive-technology review.

Reference inputs are pinned and provenance-recorded. Tests must work without
contacting Shoelace's CDN; remote content examples use controlled local fixtures.
Actual commands and exact task paths belong in the executable plan after this
design is approved. No verification above has been run yet.

### Deferred human checks — batched at phase checkpoints

Batch relevant checks at the stopping points in section 10 and
[the delivery workflow](delivery-workflow.md), rather than interrupting each task.
The final release review consolidates remaining checks and regression evidence.
This refines the earlier single end-of-project pass at the owner's request.

- Compare representative component states and docs pages on desktop/mobile,
  both themes, including branding and readable API/code tables.
- Screen-reader review of forms, select, dialog, documentation navigation/search,
  and focus return; confirm expected announcements and no traps.
- Review migration instructions against a real or representative existing app,
  compatibility exceptions, attribution, and public naming before release.

A failed human check becomes a specific follow-up task, not silent acceptance or
an unbounded redesign. Each checkpoint records an explicit go/no-go decision;
merging a task does not authorize crossing a phase gate.

## 10. Delivery sequence and gates

These are milestone boundaries, not yet executable task instructions. Plan each
milestone in small, verifiable tasks; do not invent detailed implementations for
later components before the foundational probes resolve their dependencies.

### M0 — Contract and foundation proofs

- Establish the security/privacy foundation before any external publication:
  portable tracked docs and agent instructions, ignored local execution context,
  approved commit/automation identity, staged-content and full-history checks,
  artifact/PR-body scans, and adversarial tests for the CI gate. Prepare a clean
  public history rather than pushing the existing local commits.
- Initialize root `.changeset/config.json`, Changesets commands, and
  `packages/velcro/CHANGELOG.md` with the library scaffold. Keep private docs/test
  workspaces out of publication. Include release-relevant package changes in
  changesets from the first PR, not as a retrospective batch before release.
- Scaffold the workspace, explicit tooling roots/exclusions, library generator,
  and minimal Litro build pipeline without importing original Shoelace.
- Freeze upstream package/route/API inventories, license provenance, and test
  reference installation. Establish empty coverage as incomplete, not passing.
- Add isolated differential and packed-consumer runners.
- Prove registration/class identity, form behavior, class-only imports, and Litro
  prerender/client-loading boundaries with minimal fixtures.
- Produce individually scoped core proposals only when a failing proof requires
  them; do not proceed with blocked implementation by hiding the test.

Exit: repeatable build/test foundation, measured gaps, and approved resolution for
any blocker needed by M1. If unsupported public behavior remains, record it and do
not label the foundation compatible. No full-library release claim.

### M1 — Representative vertical slice

Deliver button, input, select/option, dialog, and their actual dependency closure.
Expected supporting components include icon, spinner, popup, tag, and icon-button;
verify the full dependency graph before assigning tasks. Include themes, needed
utilities/locales/animations, targeted React wrappers, and matching public paths.

Build the real docs shell, installation/migration pages, and component pages for
this slice. Minimal native controls are acceptable where a site control's Velcro
component is not yet implemented; no substitute upstream runtime.

Exit: the slice passes differential behavior, type, form, packaging, visual, and
site tests; all other components remain explicitly unverified. Confirm the
architecture is sustainable before expanding.

### M2 — Remaining families, incrementally verified

Cover remaining components by shared dependencies: presentation; remaining form
controls; menus/navigation; overlays/layout; tree/carousel; specialized utilities.
Each component includes contract tests, styles, stories, docs examples, accessibility
checks, and generated artifacts. Develop coherent dependency groups, not 58 stubs.
Complete public utility, translation, animation, asset, wrapper, and autoloader
coverage alongside the families that exercise them.

Exit: all 58 components and inventoried public supporting surfaces have evidence;
no unimplemented component is concealed by generator output or inherited metadata.

### M3 — Full replacement and documentation acceptance

- Complete retained/adapted upstream routes and audited links/anchors, reference
  tables, tutorials, searchable content, mobile interactions, and provenance.
- Run clean packed-consumer migrations for HTML and supported framework examples;
  exercise theme overrides, CDN/autoloading, utility imports, and asset paths.
- Run complete browser, type, docs, visual, and dependency checks and consolidate
  human checks. Review the whole branch before handoff.
- Audit exceptions against the advertised compatibility claim, packaging license
  files, naming, release notes, and exact core/Litro dependencies.

Exit: an evidence-backed release candidate. Publishing and deployment remain
separate explicit approvals. Do not use the phrase "complete drop-in replacement"
with unexplained material contract gaps.

### Execution and stopping points

Follow [the delivery workflow](delivery-workflow.md) for dispatch, branch ownership,
flock review, CI, merge authorization, and cleanup. The coordinator orchestrates;
implementers write code. Use one PR per independently verifiable task or tightly
related batch. Run independent tasks in parallel and serialize merges.

| Stop | Evidence required before proceeding |
| --- | --- |
| Privacy preflight, before remote creation or first push | Approved identity and exception policy; staged/history/artifact scans tested; sanitized export independently reviewed; explicit authorization for the external operation |
| Foundation gate, within M0 | Real required GitHub CI is enforced; deliberate failure cannot pass the aggregate; package/docs test harnesses run |
| Architecture gate, end of M0 | Registration, constructor identity, forms, and Litro rendering boundaries have evidence; required core proposals are individually approved |
| Slice gate, end of M1 | Packed consumer and actual Litro site exercise the representative slice; human review confirms behavior and appearance; adapter complexity is acceptable |
| Family gates, within M2 | Family contract coverage, exceptions, integration checks, and representative visual/accessibility evidence reviewed before dependent expansion |
| Release gate, end of M3 | Full coverage, migration rehearsal, licensing/naming, and consolidated human checks accepted; publication/deployment require separate authorization |

Stop dispatching work beyond a closed gate. Independent work already authorized
within the phase may finish; do not speculate into later phases. At the slice gate,
review whether routine PR approval can be delegated under a new explicit policy.
The initial execution mode remains supervised.

## 11. Tooling, reproducibility, and project safeguards

- The [security/privacy design](security-privacy.md) defines blocking local and CI
  checks, commit identity, safe diagnostics, public artifact scans, and the initial
  clean-history handoff. Agent instructions alone are not enforcement.
- Public plans/specs use repository-relative paths. If an execution skill requires
  absolute location fields, generate its runtime plan/brief in ignored local
  scratch from the portable plan; never commit or upload that runtime copy.
- Primary checkouts remain clean. All edits, installs, builds, and commits occur
  in nested worktrees. Core changes use their own repository worktrees.
- Explicitly exclude `.worktrees/**` and `.airig/**` from ordinary lint, format, TypeScript, content,
  generator, test, file-watching, and any container build scans. FUI/CUI's inspected
  broad lint configs lack that explicit exclusion; do not copy them unchanged.
- Pin Vite/Litro roots to the intended workspace app, never infer them from the
  parent checkout's lockfile. No Next.js root configuration is needed unless a
  later framework consumer fixture actually uses Next.js.
- Use supported Node/pnpm versions and frozen installs in CI; install browser
  binaries explicitly, not through an unexpected package lifecycle hook.
- Build the library before generating dependent docs; prevent cyclic manifest,
  wrappers, library, and site generation. CI verifies reproducible artifacts.
- Only `packages/velcro` is publishable. Docs and test fixtures are private and
  original Shoelace is confined to reference-test dependencies/fixtures.
- Preserve upstream MIT notices and any third-party asset licenses; Litro scaffold
  reuse must satisfy Apache-2.0 obligations. Record source version, paths, and
  modifications for adapted material, including docs and tests.
- Velcro is a working project name, not a finding of trademark clearance. Confirm
  public naming and package/domain availability before public release; do not
  imply endorsement by Shoelace, Web Awesome, or another brand.

## 12. Initial component inventory

This inventory enumerates tagged source files, not a completed API audit.
Candidate reuse is directional, not a promise of direct subclass compatibility.
Every row still needs contract and runtime verification.

| Family / reuse candidate | Shoelace components |
| --- | --- |
| Existing similarly named core components; evaluate subclass fit | alert, avatar, badge, breadcrumb, breadcrumb-item, button, button-group, card, checkbox, dialog, divider, icon, input, menu, menu-item, popup, progress-bar, radio, radio-group, skeleton, spinner, switch, tab, tab-panel, tooltip |
| Renamed/core-adjacent; semantic adaptation required | details (disclosure), dropdown (popup/menu primitives), menu-label (menu-group/presentation), tab-group (tabs), textarea (text-area) |
| Known non-fit for direct same-name subclass | select (native core select differs), option (new companion) |
| FUI has related components, but no FUI runtime inheritance | carousel, carousel-item, drawer, range (slider), tag, tree, tree-item |
| New Velcro components on suitable Charm bases/primitives | animated-image, animation, color-picker, copy-button, format-bytes, format-date, format-number, icon-button, image-comparer, include, mutation-observer, progress-ring, qr-code, radio-button, rating, relative-time, resize-observer, split-panel, visually-hidden |

Total: 58 unique components. The fixture inventory must additionally enumerate
utility modules, event types, translation bundles, theme/assets, class-only paths,
React exports, and documentation routes. Component counts alone do not measure
compatibility completeness.

## 13. Risks, decisions on failure, and approval

| Risk | Early evidence/check | Response if it fails |
| --- | --- | --- |
| Shared registry/scope or icon configuration leaks across libraries | Both import orders, dependency resolution, class identity and mixed-page fixtures | Minimal approved core proposal or explicit blocked milestone; no global monkey-patch |
| Form APIs conflict with inherited property types or integration | Select type checks, submit/validation/reset/serialization traces | Lower-level Charm base plus Velcro adapter; shared changes need approval |
| Nominal subclassing duplicates most parent behavior | Slice review of overridden behavior and dependency use | Revisit parent selection before catalog expansion |
| Browser globals break Litro static builds | Production SSG without Velcro server imports | Maintain client boundary; propose SSR-safe hooks only if needed and approved |
| Recipe styles distort Shoelace tokens | Theme override and screenshot fixtures | Isolate docs tokens and replace scaffold theme assumptions |
| Alias, wrapper or class exports work only in a workspace | Clean tarball installs and unchanged consumer type/browser tests | Fix distribution before scaling components |
| Live site or floating tools move the reference | Pinned source/package/browser and locally served fixtures | Update reference only through a deliberate reviewed change |
| Upstream behavior conflicts with accessibility/security expectations | Independent assertions plus reference traces | Explicit reviewed divergence; qualify compatibility claim |
| Full parity costs more than a style extension | M1 evidence and measured adapter volume | Replan later milestone tasks; retain honest partial status |
| Registry access prevents acquiring exact artifacts | Reference-install/checksum task in M0 | Report blocked verification; never substitute an unpinned reference |

Proceed with the authorized local [Phase 0 bootstrap](../plans/phase-0.md).
The representative component and Litro architecture proofs remain later gates. Core changes remain individually
gated even after design approval. The full catalog/site roadmap is retained; later
execution plans depend on the representative slice's verified architecture.
