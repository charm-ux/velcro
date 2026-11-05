/*
 * Layout adapted from @beatzball/create-litro (Litro, Copyright 2026 beatzball, Apache License 2.0), Starlight recipe
 * `recipes/starlight/template/src/components/starlight-{page,header,sidebar,toc}.ts`. See THIRD_PARTY_NOTICES.md.
 * Changes: the four custom elements are folded into plain template functions rendered inside each page's shadow root;
 * Litro branding, the hamburger drawer and the footer credit removed; the sidebar is driven by catalog.jsonl and the
 * table of contents by the generated page headings; prev/next links, a three-way light/dark/system theme control and
 * Velcro components in the chrome added; colors moved to docs-scoped --velcro-docs-* properties (src/theme.ts).
 */
import { css, html, nothing, type TemplateResult } from 'lit';
import { withBase } from './base.js';
import { catalog } from './catalog.generated.js';
import { toc } from './toc.generated.js';
import { setThemePreference, themePreference, type ThemePreference } from './theme.js';

// "a", "a and b", "a, b and c"
export const listWords = (words: readonly string[]): string =>
  words.length < 2 ? words.join('') : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;

export const shellStyles = css`
  :host {
    display: block;
    font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
    color: var(--velcro-docs-text);
    background: var(--velcro-docs-bg);
    min-height: 100vh;
    line-height: 1.6;
  }
  * {
    box-sizing: border-box;
  }
  a {
    color: var(--velcro-docs-accent-text);
  }
  a:focus-visible,
  select:focus-visible,
  button:focus-visible {
    outline: 3px solid color-mix(in srgb, var(--velcro-docs-accent) 45%, transparent);
    outline-offset: 2px;
  }
  .banner {
    background: var(--velcro-docs-banner-bg);
    color: var(--velcro-docs-banner-text);
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    text-align: center;
  }
  header.site {
    position: sticky;
    top: 0;
    z-index: 10;
    display: flex;
    align-items: center;
    gap: 1rem;
    height: 3.5rem;
    padding: 0 1.5rem;
    background: var(--velcro-docs-bg);
    border-bottom: 1px solid var(--velcro-docs-border);
  }
  .brand {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 700;
    font-size: 1.125rem;
    color: var(--velcro-docs-text);
    text-decoration: none;
    white-space: nowrap;
  }
  header.site nav {
    display: flex;
    gap: 0.25rem;
    flex: 1;
    min-width: 0;
    overflow-x: auto;
  }
  header.site nav a {
    padding: 0.35rem 0.75rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--velcro-docs-text-dim);
    text-decoration: none;
    border-radius: 0.375rem;
    white-space: nowrap;
  }
  header.site nav a:hover {
    color: var(--velcro-docs-text);
    background: var(--velcro-docs-surface);
  }
  header.site nav a[aria-current='page'],
  header.site nav a[aria-current='true'] {
    color: var(--velcro-docs-accent-text);
    background: var(--velcro-docs-accent-low);
  }
  .theme {
    /* Hidden until the head theme script has run (it sets the property); without JavaScript it would do nothing. */
    display: var(--velcro-docs-theme-control, none);
    margin-left: auto;
    font: inherit;
    font-size: 0.875rem;
    color: var(--velcro-docs-text);
    background: var(--velcro-docs-bg);
    border: 1px solid var(--velcro-docs-border);
    border-radius: 0.375rem;
    padding: 0.3rem 0.5rem;
  }
  .docs {
    display: grid;
    grid-template-columns: 15rem minmax(0, 1fr) 13rem;
    max-width: 90rem;
    margin: 0 auto;
  }
  .sidebar {
    border-right: 1px solid var(--velcro-docs-border);
    background: var(--velcro-docs-bg-soft);
    padding: 1.5rem 1rem;
    position: sticky;
    top: 3.5rem;
    align-self: start;
    max-height: calc(100vh - 3.5rem);
    overflow-y: auto;
  }
  .sidebar h2,
  .toc h2 {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--velcro-docs-text-dim);
    margin: 0 0 0.75rem;
  }
  .sidebar ul,
  .toc ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .sidebar a {
    display: block;
    padding: 0.3rem 0.75rem;
    border-radius: 0.375rem;
    color: var(--velcro-docs-text-dim);
    text-decoration: none;
    font-size: 0.9375rem;
  }
  .sidebar a:hover {
    color: var(--velcro-docs-text);
    background: var(--velcro-docs-surface);
  }
  .sidebar a[aria-current='page'] {
    color: var(--velcro-docs-accent-text);
    background: var(--velcro-docs-accent-low);
    font-weight: 600;
  }
  .content {
    min-width: 0;
    padding: 2rem 2.5rem 3rem;
  }
  .content > * {
    max-width: 52rem;
  }
  .toc {
    padding: 2rem 1rem;
    position: sticky;
    top: 3.5rem;
    align-self: start;
    max-height: calc(100vh - 3.5rem);
    overflow-y: auto;
  }
  .toc a {
    display: block;
    padding: 0.2rem 0 0.2rem 0.75rem;
    border-left: 2px solid var(--velcro-docs-border);
    font-size: 0.875rem;
    color: var(--velcro-docs-text-dim);
    text-decoration: none;
  }
  .toc a:hover {
    color: var(--velcro-docs-text);
    border-left-color: var(--velcro-docs-accent);
  }
  .pager {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 1rem;
    margin-top: 1rem;
  }
  .pager a {
    display: flex;
    flex-direction: column;
    padding: 0.75rem 1rem;
    border: 1px solid var(--velcro-docs-border);
    border-radius: 0.5rem;
    text-decoration: none;
    flex: 1 1 12rem;
    max-width: 100%;
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .pager a:hover {
    border-color: var(--velcro-docs-accent);
  }
  .pager .next {
    margin-left: auto;
    text-align: right;
  }
  .pager small {
    color: var(--velcro-docs-text-dim);
  }
  footer.site {
    max-width: 90rem;
    margin: 0 auto;
    padding: 0 1.5rem 2rem;
    font-size: 0.875rem;
    color: var(--velcro-docs-text-dim);
  }
  @media (max-width: 72rem) {
    .docs {
      grid-template-columns: 15rem minmax(0, 1fr);
    }
    .toc {
      display: none;
    }
  }
  @media (max-width: 48rem) {
    .docs {
      grid-template-columns: 1fr;
    }
    .sidebar {
      position: static;
      max-height: none;
      border-right: 0;
      border-bottom: 1px solid var(--velcro-docs-border);
    }
    .content {
      padding: 1.5rem 1rem;
    }
  }
  h1 {
    margin-top: 0;
    font-size: 2.25rem;
    line-height: 1.15;
  }
  h2 {
    scroll-margin-top: 4.5rem;
  }
  code,
  pre {
    font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
  }
  :not(pre) > code {
    background: var(--velcro-docs-code-bg);
    border-radius: 0.25rem;
    padding: 0.1em 0.3em;
    font-size: 0.9em;
  }
  pre {
    background: var(--velcro-docs-code-bg);
    border: 1px solid var(--velcro-docs-border);
    border-radius: 0.375rem;
    padding: 1rem;
    overflow: auto;
    font-size: 0.875rem;
  }
  table {
    border-collapse: collapse;
    width: 100%;
    font-size: 0.875rem;
  }
  th,
  td {
    text-align: left;
    padding: 0.5rem;
    border-bottom: 1px solid var(--velcro-docs-border);
    vertical-align: top;
  }
  iframe.example {
    display: block;
    width: 100%;
    height: 9rem;
    border: 1px solid var(--velcro-docs-border);
    border-radius: 0.375rem;
    background: var(--velcro-docs-bg);
  }
`;

const componentHref = (name: string) => withBase(`/components/${name}`);

function onThemeChange(event: Event) {
  setThemePreference((event.target as HTMLSelectElement).value as ThemePreference);
}

// Headings live in the page's shadow root, which native fragment navigation cannot reach: scroll to them directly.
function onTocClick(event: MouseEvent) {
  const link = (event.target as Element | null)?.closest?.('a[href^="#"]');
  if (!link) return;
  const id = link.getAttribute('href')!.slice(1);
  const target = (link.getRootNode() as ShadowRoot | Document).getElementById?.(id);
  if (!target) return;
  event.preventDefault();
  target.scrollIntoView();
  history.replaceState(history.state, '', `#${id}`);
}

function siteHeader(current: string): TemplateResult {
  const preference = themePreference();
  const first = catalog[0];
  return html`
    <div class="banner" role="note">Velcro is an unreleased prototype. Only the ${listWords(catalog.map(c => c.name))} are implemented; it is not a drop-in Shoelace replacement yet. The site follows your light or dark preference; Velcro's component dark tokens are not available yet.</div>
    <header class="site">
      <a class="brand" href=${withBase('/')}>Velcro <sl-badge variant="neutral" pill>prototype</sl-badge></a>
      <nav aria-label="Primary">
        <a href=${withBase('/')} aria-current=${current === '' ? 'page' : 'false'}>Home</a>
        <a href=${componentHref(first.name)} aria-current=${current === first.name ? 'page' : current !== '' ? 'true' : 'false'}>Components</a>
      </nav>
      <select class="theme" aria-label="Color theme" @change=${onThemeChange}>
        ${(['system', 'light', 'dark'] as const).map(
          value => html`<option value=${value} ?selected=${preference === value}>${value === 'system' ? 'System theme' : value === 'light' ? 'Light theme' : 'Dark theme'}</option>`
        )}
      </select>
    </header>
  `;
}

const siteFooter = html`
  <footer class="site">
    <sl-divider></sl-divider>
    <p>Velcro: Shoelace-style web components built on <code>@charm-ux/core</code>. A private prototype; nothing here is published.</p>
  </footer>
`;

/** A component reference page: header, catalog sidebar, article, on-page contents and previous/next links. */
export function docsShell(name: string, content: TemplateResult): TemplateResult {
  const index = catalog.findIndex(c => c.name === name);
  const prev = index > 0 ? catalog[index - 1] : undefined;
  const next = index >= 0 && index < catalog.length - 1 ? catalog[index + 1] : undefined;
  const entries = toc[name] ?? [];
  return html`
    ${siteHeader(name)}
    <div class="docs">
      <aside class="sidebar">
        <nav aria-label="Components">
          <h2>Components</h2>
          <ul>
            ${catalog.map(c => html`<li><a href=${componentHref(c.name)} aria-current=${c.name === name ? 'page' : 'false'}>${c.title}</a></li>`)}
          </ul>
        </nav>
      </aside>
      <main class="content">
        ${content}
        <sl-divider></sl-divider>
        <nav class="pager" aria-label="Previous and next">
          ${prev ? html`<a class="prev" href=${componentHref(prev.name)} rel="prev"><small>Previous</small> ${prev.title}</a>` : nothing}
          ${next ? html`<a class="next" href=${componentHref(next.name)} rel="next"><small>Next</small> ${next.title}</a>` : nothing}
        </nav>
      </main>
      ${entries.length
        ? html`<aside class="toc">
            <nav aria-label="On this page" @click=${onTocClick}>
              <h2>On this page</h2>
              <ul>
                ${entries.map(e => html`<li><a href="#${e.id}">${e.text}</a></li>`)}
              </ul>
            </nav>
          </aside>`
        : nothing}
    </div>
    ${siteFooter}
  `;
}

/** The landing page: header, full-width content, footer. */
export function landingShell(content: TemplateResult): TemplateResult {
  return html`${siteHeader('')}${content}${siteFooter}`;
}
