import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { definePageData } from '@beatzball/litro';
import { withBase } from '../src/base.js';
import { catalog } from '../src/catalog.generated.js';
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
        <p>Implemented so far: ${catalog.map((c, i) => html`${i > 0 ? ', ' : ''}<a href=${withBase(`/components/${c.name}`)}><code>&lt;${c.tag}&gt;</code></a>`)}.</p>
      `,
      false
    );
  }
}

export default HomePage;
