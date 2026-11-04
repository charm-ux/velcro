import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { definePageData } from '@beatzball/litro';
import { withBase } from '../src/base.js';
import { shell, shellStyles } from '../src/shell.js';

export const pageData = definePageData(async () => ({
  seoTitle: 'Velcro',
  seoHead: '<meta name="description" content="Velcro: Shoelace-style web components built on @charm-ux/core (prototype).">',
}));

@customElement('page-home')
export class HomePage extends LitElement {
  static override styles = [shellStyles];

  override render() {
    return shell(
      html`
        <h1>Velcro</h1>
        <p>Shoelace-style web components built on <code>@charm-ux/core</code> and Lit. This site is a private prototype.</p>
        <p>Implemented so far: <a href=${withBase('/components/button')}><code>&lt;sl-button&gt;</code></a>, <a href=${withBase('/components/spinner')}><code>&lt;sl-spinner&gt;</code></a>.</p>
      `,
      false
    );
  }
}

export default HomePage;
