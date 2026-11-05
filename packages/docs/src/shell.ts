import { css, html, type TemplateResult } from 'lit';
import { withBase } from './base.js';
import { catalog } from './catalog.generated.js';

// "a", "a and b", "a, b and c"
export const listWords = (words: readonly string[]): string =>
  words.length < 2 ? words.join('') : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;

export const shellStyles = css`
  :host {
    display: block;
    font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
    color: #18181b;
    background: #fff;
    min-height: 100vh;
  }
  * {
    box-sizing: border-box;
  }
  .banner {
    background: #fef3c7;
    color: #78350f;
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    text-align: center;
  }
  header {
    display: flex;
    align-items: center;
    gap: 1.5rem;
    padding: 0.75rem 1.5rem;
    border-bottom: 1px solid #e4e4e7;
  }
  .brand {
    font-weight: 700;
    font-size: 1.25rem;
    color: #0369a1;
    text-decoration: none;
  }
  header nav a {
    color: #3f3f46;
    text-decoration: none;
    margin-right: 1rem;
  }
  header nav a:hover,
  a:hover {
    text-decoration: underline;
  }
  .layout {
    display: grid;
    grid-template-columns: 14rem minmax(0, 1fr);
    gap: 2rem;
    max-width: 70rem;
    margin: 0 auto;
    padding: 1.5rem;
  }
  aside h2 {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #71717a;
  }
  aside ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  aside a {
    display: block;
    padding: 0.25rem 0;
    color: #0369a1;
  }
  main {
    min-width: 0;
  }
  a:focus-visible {
    outline: 3px solid #38bdf866;
    outline-offset: 2px;
  }
  @media (max-width: 48rem) {
    .layout {
      grid-template-columns: 1fr;
    }
  }
  h1 {
    margin-top: 0;
  }
  code,
  pre {
    font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
  }
  pre {
    background: #f4f4f5;
    border: 1px solid #e4e4e7;
    border-radius: 0.25rem;
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
    border-bottom: 1px solid #e4e4e7;
    vertical-align: top;
  }
  iframe.example {
    display: block;
    width: 100%;
    height: 9rem;
    border: 1px solid #e4e4e7;
    border-radius: 0.25rem;
  }
`;

export function shell(content: TemplateResult, sidebar = true): TemplateResult {
  return html`
    <div class="banner" role="note">Velcro is an unreleased prototype. Only the ${listWords(catalog.map(c => c.name))} are implemented; it is not a drop-in Shoelace replacement yet. Light theme only.</div>
    <header>
      <a class="brand" href=${withBase('/')}>Velcro</a>
      <nav aria-label="Primary"><a href=${withBase('/')}>Home</a>${catalog.map(c => html`<a href=${withBase(`/components/${c.name}`)}>${c.title}</a>`)}</nav>
    </header>
    <div class="layout">
      ${sidebar
        ? html`<aside aria-label="Components">
            <h2>Components</h2>
            <ul>
              ${catalog.map(c => html`<li><a href=${withBase(`/components/${c.name}`)}>${c.title}</a></li>`)}
            </ul>
          </aside>`
        : html`<div></div>`}
      <main>${content}</main>
    </div>
  `;
}
