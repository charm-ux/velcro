/*
 * Landing page adapted from @beatzball/create-litro (Litro, Copyright 2026 beatzball, Apache License 2.0), Supernova
 * recipe `recipes/supernova/template/pages/index.ts` and its hero, feature-row and install-command components.
 * See THIRD_PARTY_NOTICES.md.
 * Changes: rewritten for Velcro as one page component with plain sections (hero with a background wash, alternating
 * feature rows, an install command with a copy button, a closing call to action); logos, stats, video, terminal
 * windows, status line, social links and Litro branding removed; a showcase that renders every catalog component
 * live added; colors moved to docs-scoped --velcro-docs-* properties.
 */
import { LitElement, css, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { definePageData } from '@beatzball/litro';
import { withBase } from '../src/base.js';
import { catalog } from '../src/catalog.generated.js';
import { showcase } from '../src/showcase.generated.js';
import { landingShell, shellStyles } from '../src/shell.js';
import { themeHead } from '../src/theme.js';

export const pageData = definePageData(async () => ({
  seoTitle: 'Velcro',
  seoHead: themeHead + '<meta name="description" content="Velcro: Shoelace-style web components built on @charm-ux/core (prototype).">',
}));

// The packages are private and unpublished, so the command builds the library from a checkout of the repository.
const INSTALL = 'pnpm --filter @charm-ux/velcro run build';

const features: Array<{ heading: string; body: string; figure: string }> = [
  {
    heading: 'Shoelace markup, core underneath',
    body: 'Write <sl-button>, <sl-card> and friends exactly as the Shoelace 2.20.1 documentation shows. Each Velcro component extends its @charm-ux/core counterpart and keeps the Shoelace parts, slots and attributes.',
    figure: '<sl-button variant="primary">Save</sl-button> <sl-button>Cancel</sl-button> <sl-badge variant="success" pill>New</sl-badge>',
  },
  {
    heading: 'Themed with the familiar tokens',
    body: 'Components read the --sl-* design tokens from @charm-ux/velcro/themes/light.css, so an existing Shoelace theme override keeps working. This site follows your light or dark preference.',
    figure: '<sl-progress-ring value="72" label="Theme coverage">72%</sl-progress-ring> <sl-progress-bar value="72" label="Theme coverage" style="flex: 1"></sl-progress-bar>',
  },
  {
    heading: 'Honest about what is missing',
    body: 'Every component page lists what is not implemented or not verified yet, next to live examples and API tables. Nothing is claimed that a test does not check.',
    figure: '<sl-skeleton effect="pulse" style="flex: 1"></sl-skeleton> <sl-spinner style="font-size: 1.5rem"></sl-spinner>',
  },
];

const landingStyles = css`
  .hero {
    position: relative;
    overflow: hidden;
    padding: 5rem 1.5rem 4rem;
    background: var(--velcro-docs-wash), var(--velcro-docs-bg);
    border-bottom: 1px solid var(--velcro-docs-border);
  }
  .hero-inner,
  .section {
    max-width: 72rem;
    margin: 0 auto;
  }
  .hero h1 {
    font-size: clamp(2.25rem, 5vw, 3.75rem);
    letter-spacing: -0.02em;
    margin: 0 0 1rem;
    max-width: 18ch;
  }
  .lede {
    font-size: 1.25rem;
    color: var(--velcro-docs-text-dim);
    max-width: 40rem;
    margin: 0 0 2rem;
  }
  .install {
    display: inline-flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem 0.5rem 0.5rem 1rem;
    border: 1px solid var(--velcro-docs-border);
    border-radius: 0.5rem;
    background: var(--velcro-docs-surface);
    max-width: 100%;
    flex-wrap: wrap;
  }
  .install pre {
    min-width: 0;
    overflow-x: auto;
    margin: 0;
    padding: 0;
    border: 0;
    background: none;
    font-size: 0.9375rem;
  }
  .install pre::before {
    content: '$ ';
    color: var(--velcro-docs-text-dim);
  }
  .copy {
    font: inherit;
    font-size: 0.8125rem;
    padding: 0.25rem 0.75rem;
    border-radius: 0.375rem;
    border: 1px solid var(--velcro-docs-border);
    background: var(--velcro-docs-bg);
    color: var(--velcro-docs-text);
    cursor: pointer;
  }
  .note {
    font-size: 0.875rem;
    color: var(--velcro-docs-text-dim);
    margin: 0.5rem 0 0;
  }
  .cta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    margin-top: 1.5rem;
  }
  .cta a {
    padding: 0.6rem 1.25rem;
    border-radius: 0.5rem;
    font-weight: 600;
    text-decoration: none;
    border: 1px solid var(--velcro-docs-border);
    color: var(--velcro-docs-text);
    background: var(--velcro-docs-bg);
  }
  .cta a.primary {
    background: var(--velcro-docs-accent);
    border-color: var(--velcro-docs-accent);
    color: var(--velcro-docs-bg);
  }
  .section {
    padding: 4rem 1.5rem 1rem;
  }
  .section > h2 {
    font-size: clamp(1.375rem, 7vw, 1.875rem);
    margin: 0 0 0.5rem;
  }
  .section > p {
    color: var(--velcro-docs-text-dim);
    margin: 0 0 2rem;
  }
  .row {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    padding: 1.5rem 0;
  }
  .row h3 {
    font-size: 1.375rem;
    margin: 0 0 0.5rem;
  }
  .row p {
    margin: 0;
    color: var(--velcro-docs-text-dim);
    max-width: 40rem;
  }
  .figure {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
    padding: 1.5rem;
    border: 1px solid var(--velcro-docs-border);
    border-radius: 0.75rem;
    background: var(--velcro-docs-bg-soft);
    min-height: 6rem;
  }
  @media (min-width: 48rem) {
    .row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      align-items: center;
      gap: 3rem;
    }
    .row:nth-of-type(even) .text {
      order: 2;
    }
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(16rem, 100%), 1fr));
    gap: 1rem;
  }
  .tile {
    display: flex;
    flex-direction: column;
    border: 1px solid var(--velcro-docs-border);
    border-radius: 0.75rem;
    background: var(--velcro-docs-bg-soft);
    overflow: hidden;
  }
  .tile .demo {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
    gap: 0.5rem;
    min-height: 7rem;
    padding: 1.25rem;
    background: var(--velcro-docs-bg);
  }
  .tile .demo > sl-progress-bar,
  .tile .demo > sl-skeleton,
  .tile .demo > sl-card {
    flex: 1 1 100%;
  }
  .tile .demo > sl-divider {
    flex: 1 1 100%;
  }
  /* The card draws its own (theme token) surface, so its slotted text follows the component theme, not the site's. */
  sl-card {
    color: var(--sl-color-neutral-900, inherit);
  }
  .tile .meta {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    border-top: 1px solid var(--velcro-docs-border);
  }
  .tile h3 {
    margin: 0;
    font-size: 1rem;
  }
  .tile .meta code {
    font-size: 0.75rem;
    color: var(--velcro-docs-text-dim);
  }
  .closing {
    text-align: center;
    padding: 4rem 1.5rem;
  }
  .closing h2 {
    font-size: clamp(1.375rem, 7vw, 1.875rem);
    margin: 0 0 1rem;
  }
  .closing .cta {
    justify-content: center;
  }
`;

async function copyInstall(event: Event) {
  const button = event.currentTarget as HTMLButtonElement;
  try {
    await navigator.clipboard.writeText(INSTALL);
    button.textContent = 'Copied';
  } catch {
    button.textContent = 'Copy failed';
  }
  setTimeout(() => (button.textContent = 'Copy'), 2000);
}

// The showcase lives in this page's shadow root, which native fragment navigation cannot reach.
function jumpToShowcase(event: Event) {
  const target = ((event.currentTarget as Element).getRootNode() as ShadowRoot).getElementById('showcase');
  if (!target) return;
  event.preventDefault();
  target.scrollIntoView();
  history.replaceState(history.state, '', '#showcase');
}

@customElement('page-home')
export class HomePage extends LitElement {
  static override styles = [shellStyles, landingStyles];

  override render() {
    const first = catalog[0];
    return landingShell(html`
      <main>
        <section class="hero" aria-labelledby="hero-title">
          <div class="hero-inner">
            <h1 id="hero-title">Velcro</h1>
            <p class="lede">Shoelace-style web components built on <code>@charm-ux/core</code> and Lit. ${catalog.length} components so far, each one documented, tested and shown live below. This site is a private prototype.</p>
            <div class="install">
              <pre><code>${INSTALL}</code></pre>
              <button class="copy" type="button" @click=${copyInstall}>Copy</button>
            </div>
            <p class="note">Not published yet: build it from a checkout of the repository.</p>
            <div class="cta">
              <a class="primary" href=${withBase(`/components/${first.name}`)}>Read the docs</a>
              <a href="#showcase" @click=${jumpToShowcase}>See every component</a>
            </div>
          </div>
        </section>

        <section class="section" aria-labelledby="features-title">
          <h2 id="features-title">What it does</h2>
          <p>A compatibility layer, not a new design system.</p>
          ${features.map(
            f => html`<div class="row">
              <div class="text">
                <h3>${f.heading}</h3>
                <p>${f.body}</p>
              </div>
              <div class="figure">${unsafeHTML(f.figure)}</div>
            </div>`
          )}
        </section>

        <section class="section" id="showcase" aria-labelledby="showcase-title">
          <h2 id="showcase-title">Showcase</h2>
          <p>Every implemented component, rendered live. Each tile links to its reference page.</p>
          <div class="grid">
            ${catalog.map(
              c => html`<article class="tile" data-component=${c.name}>
                <div class="demo">${unsafeHTML(showcase[c.name])}</div>
                <div class="meta">
                  <h3><a href=${withBase(`/components/${c.name}`)}>${c.title}</a></h3>
                  <code>&lt;${c.tag}&gt;</code>
                </div>
              </article>`
            )}
          </div>
        </section>

        <section class="closing" aria-labelledby="closing-title">
          <h2 id="closing-title">Start with the first component.</h2>
          <div class="cta">
            <a class="primary" href=${withBase(`/components/${first.name}`)}>${first.title} reference</a>
          </div>
        </section>
      </main>
    `);
  }
}

export default HomePage;
