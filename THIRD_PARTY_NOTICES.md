# Third-party notices

Velcro itself is private and UNLICENSED (an owner release decision, unchanged by this file). This file retains
the notices that upstream licenses require for material adapted or copied into this repository. Nothing here
relicenses Velcro code.

**Scope: this file covers only material copied or adapted into this repository's source.** It is NOT a complete
inventory of third-party code bundled into built artifacts (for example Lit, `@charm-ux/core`, its `@floating-ui`
dependency and `@beatzball/litro-router`, which minified bundles can contain without their license comments).

**Release gate (mandatory):** before any package, CDN or site artifact is published, uploaded or deployed, a complete
license inventory and the required notices for every dependency bundled into that artifact must be produced and
shipped with it. This file alone never certifies an artifact: where a built artifact carries generated runtime notices
(for example `THIRD_PARTY_RUNTIME_NOTICES.md` in the documentation site), those notices are the inventory for it.

## Shoelace v2.20.1 (MIT)

- Source: the `@shoelace-style/shoelace` 2.20.1 release (https://github.com/shoelace-style/shoelace).
- Used in: `packages/velcro/src/components/button/button.ts` (API documentation wording: class, property, event,
  slot and part descriptions adapted from `src/components/button/button.component.ts`),
  `packages/velcro/src/components/spinner/spinner.ts` (API documentation wording, and the rendered structure: an svg
  `base` part with `role="progressbar"` and a track and an indicator circle, adapted from
  `src/components/spinner/spinner.component.ts`), `packages/velcro/src/components/spinner/spinner.styles.ts`
  (styles adapted from `src/components/spinner/spinner.styles.ts` with the changes listed in its header) and
  `packages/velcro/themes/light.css` (token names, and values written to match `src/themes/light.css`; not
  mechanically diffed). The button implementation and styles are original and built on `@charm-ux/core`, and the
  spinner is built on the `@charm-ux/core` spinner; no Shoelace runtime or source files are included.
- Also used in: `packages/velcro/src/components/badge/badge.ts` (API documentation wording, and the rendered structure:
  a `span` with the `base` part, `role="status"` and `badge` / `badge--*` class names around a default slot, adapted
  from `src/components/badge/badge.component.ts`), `packages/velcro/src/components/badge/badge.styles.ts` (styles
  adapted from `src/components/badge/badge.styles.ts`, with the keyframes renamed),
  `packages/velcro/src/components/divider/divider.ts` (API documentation wording and the host `role="separator"` /
  `aria-orientation` behavior, adapted from `src/components/divider/divider.component.ts`) and
  `packages/velcro/src/components/divider/divider.styles.ts` (styles adapted from
  `src/components/divider/divider.styles.ts`, with the core host-rule resets added),
  `packages/velcro/src/components/progress-ring/progress-ring.ts` (API documentation wording, and the rendered
  structure: a `div` `base` part with `role="progressbar"`, an svg track and indicator circle, and a default slot with
  the `label` part, adapted from `src/components/progress-ring/progress-ring.component.ts`) and
  `packages/velcro/src/components/progress-ring/progress-ring.styles.ts` (styles adapted from
  `src/components/progress-ring/progress-ring.styles.ts`, with token fallbacks and a forced-colors rule added; no
  tokens beyond those already in the light theme are needed). The badge and divider are built
  on the `@charm-ux/core` badge and divider; no Shoelace runtime or source files are included. Source retrieved for
  inspection: files of the `v2.20.1` tag (`src/components/{badge,divider,progress-ring}/*`, `src/themes/light.css`); the added light
  theme tokens (`--sl-color-neutral-200`, `--sl-border-radius-small`, `--sl-letter-spacing-normal`,
  `--sl-panel-border-color`, `--sl-panel-border-width`) follow that file's names and values.
- Also used in: `packages/velcro/src/components/progress-bar/progress-bar.ts` (API documentation wording, and the
  rendered structure: a `base` part with `role="progressbar"` and an `indicator` part sized by a width style around
  the default slot with the `label` part, adapted from `src/components/progress-bar/progress-bar.component.ts`),
  `packages/velcro/src/components/progress-bar/progress-bar.styles.ts` (styles adapted from
  `src/components/progress-bar/progress-bar.styles.ts`, with the keyframes renamed and a host width reset added) and
  the docs example and page `packages/docs/examples/progress-bar/basic.html` and
  `packages/docs/pages/components/progress-bar.ts` (examples and wording adapted from
  `docs/pages/components/progress-bar.md`). The progress bar is built on the `@charm-ux/core` progress bar; no
  Shoelace runtime or source files are included. Source retrieved for inspection: files of the `v2.20.1` tag
  (`src/components/progress-bar/*`, `docs/pages/components/progress-bar.md`, `src/themes/light.css`); the added light
  theme tokens (`--sl-font-weight-normal`, `--sl-shadow-small`) follow that file's names and values.
- Also used in: `packages/velcro/src/components/visually-hidden/visually-hidden.ts` (API documentation wording and the
  rendered structure, a default slot only, adapted from `src/components/visually-hidden/visually-hidden.component.ts`)
  and `packages/velcro/src/components/visually-hidden/visually-hidden.styles.ts` (styles adapted from
  `src/components/visually-hidden/visually-hidden.styles.ts`, declarations unchanged), plus two example snippets in the
  docs page examples adapted from `docs/pages/components/visually-hidden.md`. The component extends the `@charm-ux/core`
  base element; no Shoelace runtime or source files are included.
- Also used in: `packages/velcro/src/components/skeleton/skeleton.ts` (API documentation wording, and the rendered
  structure: a `div` with the `base` part and `skeleton` / `skeleton--*` class names around a `div` with the
  `indicator` part, adapted from `src/components/skeleton/skeleton.component.ts`),
  `packages/velcro/src/components/skeleton/skeleton.styles.ts` (styles adapted from
  `src/components/skeleton/skeleton.styles.ts`, with the keyframes renamed and token fallbacks added) and
  `packages/docs/examples/skeleton/*.html` with `packages/docs/pages/components/skeleton.ts` (example markup and
  explanatory wording adapted from `docs/pages/components/skeleton.md`). The skeleton is built on the
  `@charm-ux/core` skeleton; no Shoelace runtime or source files are included. The added light theme tokens
  (`--sl-border-radius-medium`, `--sl-border-radius-circle`) follow `src/themes/light.css` names and values.
- The 2.20.1 release carries no NOTICE file. Its license text, verbatim:

```text
Copyright (c) 2020 A Beautiful Site, LLC

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

## Litro scaffold, @beatzball/create-litro 0.15.3 (Apache-2.0)

- Source: the published `@beatzball/create-litro` 0.15.3 package (https://github.com/beatzball/litro,
  `packages/create-litro`), fullstack recipe template under `dist/recipes/fullstack/template/`.
- The published package declares `Apache-2.0`, ships a LICENSE file ("Copyright 2026 beatzball", reproduced below)
  and no NOTICE file, so there is no NOTICE text to carry. The documentation site also depends on
  `@beatzball/litro` 0.17.4 (Apache-2.0, no NOTICE file); it is installed, not copied. Its runtime code is
  bundled into the built site, which falls under the release gate above (this file alone does not satisfy it).
- Copied byte-for-byte (a change-notice header comment was then added at the top of each .ts file; `tsconfig.json`
  is JSON and carries no header, it is unmodified):
  - `app.ts` and `app-main.ts` -> `packages/docs/app.ts`, `packages/docs/app-main.ts`
  - `server/middleware/vite-dev.ts` -> `packages/docs/server/middleware/vite-dev.ts`
  - `server/routes/[...].ts` -> relocated to `packages/docs/server/handlers/pages.ts`
  - `tsconfig.json` -> `packages/docs/tsconfig.json`
- Modified: `app.ts` (a comment that referred to the scaffold's verification script, which does not exist here, was
  corrected). Adapted derivatives: `packages/docs/nitro.config.ts` and `packages/docs/vite.config.ts` (server actions
  removed, explicit catch-all handler registration, second Vite entry and CSS asset naming added). The page and
  layout files are original.
- License text, verbatim from that package's LICENSE:

```text
                                 Apache License
                           Version 2.0, January 2004
                        http://www.apache.org/licenses/

   TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION

   1. Definitions.

      "License" shall mean the terms and conditions for use, reproduction,
      and distribution as defined by Sections 1 through 9 of this document.

      "Licensor" shall mean the copyright owner or entity authorized by
      the copyright owner that is granting the License.

      "Legal Entity" shall mean the union of the acting entity and all
      other entities that control, are controlled by, or are under common
      control with that entity. For the purposes of this definition,
      "control" means (i) the power, direct or indirect, to cause the
      direction or management of such entity, whether by contract or
      otherwise, or (ii) ownership of fifty percent (50%) or more of the
      outstanding shares, or (iii) beneficial ownership of such entity.

      "You" (or "Your") shall mean an individual or Legal Entity
      exercising permissions granted by this License.

      "Source" form shall mean the preferred form for making modifications,
      including but not limited to software source code, documentation
      source, and configuration files.

      "Object" form shall mean any form resulting from mechanical
      transformation or translation of a Source form, including but
      not limited to compiled object code, generated documentation,
      and conversions to other media types.

      "Work" shall mean the work of authorship, whether in Source or
      Object form, made available under the License, as indicated by a
      copyright notice that is included in or attached to the work
      (an example is provided in the Appendix below).

      "Derivative Works" shall mean any work, whether in Source or Object
      form, that is based on (or derived from) the Work and for which the
      editorial revisions, annotations, elaborations, or other modifications
      represent, as a whole, an original work of authorship. For the purposes
      of this License, Derivative Works shall not include works that remain
      separable from, or merely link (or bind by name) to the interfaces of,
      the Work and Derivative Works thereof.

      "Contribution" shall mean any work of authorship, including
      the original version of the Work and any modifications or additions
      to that Work or Derivative Works thereof, that is intentionally
      submitted to Licensor for inclusion in the Work by the copyright owner
      or by an individual or Legal Entity authorized to submit on behalf of
      the copyright owner. For the purposes of this definition, "submitted"
      means any form of electronic, verbal, or written communication sent
      to the Licensor or its representatives, including but not limited to
      communication on electronic mailing lists, source code control systems,
      and issue tracking systems that are managed by, or on behalf of, the
      Licensor for the purpose of discussing and improving the Work, but
      excluding communication that is conspicuously marked or otherwise
      designated in writing by the copyright owner as "Not a Contribution."

      "Contributor" shall mean Licensor and any individual or Legal Entity
      on behalf of whom a Contribution has been received by Licensor and
      subsequently incorporated within the Work.

   2. Grant of Copyright License. Subject to the terms and conditions of
      this License, each Contributor hereby grants to You a perpetual,
      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
      copyright license to reproduce, prepare Derivative Works of,
      publicly display, publicly perform, sublicense, and distribute the
      Work and such Derivative Works in Source or Object form.

   3. Grant of Patent License. Subject to the terms and conditions of
      this License, each Contributor hereby grants to You a perpetual,
      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
      (except as stated in this section) patent license to make, have made,
      use, offer to sell, sell, import, and otherwise transfer the Work,
      where such license applies only to those patent claims licensable
      by such Contributor that are necessarily infringed by their
      Contribution(s) alone or by combination of their Contribution(s)
      with the Work to which such Contribution(s) was submitted. If You
      institute patent litigation against any entity (including a
      cross-claim or counterclaim in a lawsuit) alleging that the Work
      or a Contribution incorporated within the Work constitutes direct
      or contributory patent infringement, then any patent licenses
      granted to You under this License for that Work shall terminate
      as of the date such litigation is filed.

   4. Redistribution. You may reproduce and distribute copies of the
      Work or Derivative Works thereof in any medium, with or without
      modifications, and in Source or Object form, provided that You
      meet the following conditions:

      (a) You must give any other recipients of the Work or
          Derivative Works a copy of this License; and

      (b) You must cause any modified files to carry prominent notices
          stating that You changed the files; and

      (c) You must retain, in the Source form of any Derivative Works
          that You distribute, all copyright, patent, trademark, and
          attribution notices from the Source form of the Work,
          excluding those notices that do not pertain to any part of
          the Derivative Works; and

      (d) If the Work includes a "NOTICE" text file as part of its
          distribution, then any Derivative Works that You distribute must
          include a readable copy of the attribution notices contained
          within such NOTICE file, excluding those notices that do not
          pertain to any part of the Derivative Works, in at least one
          of the following places: within a NOTICE text file distributed
          as part of the Derivative Works; within the Source form or
          documentation, if provided along with the Derivative Works; or,
          within a display generated by the Derivative Works, if and
          wherever such third-party notices normally appear. The contents
          of the NOTICE file are for informational purposes only and
          do not modify the License. You may add Your own attribution
          notices within Derivative Works that You distribute, alongside
          or as an addendum to the NOTICE text from the Work, provided
          that such additional attribution notices cannot be construed
          as modifying the License.

      You may add Your own copyright statement to Your modifications and
      may provide additional or different license terms and conditions
      for use, reproduction, or distribution of Your modifications, or
      for any such Derivative Works as a whole, provided Your use,
      reproduction, and distribution of the Work otherwise complies with
      the conditions stated in this License.

   5. Submission of Contributions. Unless You explicitly state otherwise,
      any Contribution intentionally submitted for inclusion in the Work
      by You to the Licensor shall be under the terms and conditions of
      this License, without any additional terms or conditions.
      Notwithstanding the above, nothing herein shall supersede or modify
      the terms of any separate license agreement you may have executed
      with Licensor regarding such Contributions.

   6. Trademarks. This License does not grant permission to use the trade
      names, trademarks, service marks, or product names of the Licensor,
      except as required for reasonable and customary use in describing the
      origin of the Work and reproducing the content of the NOTICE file.

   7. Disclaimer of Warranty. Unless required by applicable law or
      agreed to in writing, Licensor provides the Work (and each
      Contributor provides its Contributions) on an "AS IS" BASIS,
      WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or
      implied, including, without limitation, any warranties or conditions
      of TITLE, NON-INFRINGEMENT, MERCHANTABILITY, or FITNESS FOR A
      PARTICULAR PURPOSE. You are solely responsible for determining the
      appropriateness of using or redistributing the Work and assume any
      risks associated with Your exercise of permissions under this License.

   8. Limitation of Liability. In no event and under no legal theory,
      whether in tort (including negligence), contract, or otherwise,
      unless required by applicable law (such as deliberate and grossly
      negligent acts) or agreed to in writing, shall any Contributor be
      liable to You for damages, including any direct, indirect, special,
      incidental, or consequential damages of any character arising as a
      result of this License or out of the use or inability to use the
      Work (including but not limited to damages for loss of goodwill,
      work stoppage, computer failure or malfunction, or any and all
      other commercial damages or losses), even if such Contributor
      has been advised of the possibility of such damages.

   9. Accepting Warranty or Additional Liability. While redistributing
      the Work or Derivative Works thereof, You may choose to offer,
      and charge a fee for, acceptance of support, warranty, indemnity,
      or other liability obligations and/or rights consistent with this
      License. However, in accepting such obligations, You may act only
      on Your own behalf and on Your sole responsibility, not on behalf
      of any other Contributor, and only if You agree to indemnify,
      defend, and hold each Contributor harmless for any liability
      incurred by, or claims asserted against, such Contributor by reason
      of your accepting any such warranty or additional liability.

   END OF TERMS AND CONDITIONS

   APPENDIX: How to apply the Apache License to your work.

      To apply the Apache License to your work, attach the following
      boilerplate notice, with the fields enclosed by brackets "[]"
      replaced with your own identifying information. (Don't include
      the brackets!)  The text should be enclosed in the appropriate
      comment syntax for the file format. We also recommend that a
      file or class name and description of purpose be included on the
      same "printed page" as the copyright notice for easier
      identification within third-party archives.

   Copyright 2026 beatzball

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
```
