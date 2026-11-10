// Adapted from Shoelace v2.20.1 (src/components/include/include.component.ts and the `@watch` timing of
// src/internal/watch.ts), Copyright (c) 2020 A Beautiful Site, LLC, MIT License. See THIRD_PARTY_NOTICES.md.
// The API documentation wording, the request and cache (see request.ts), the replacement of the element's content, the
// re-creation of scripts and the `sl-load` and `sl-error` events follow Shoelace. Velcro changes: built on the
// @charm-ux/core base element (there is no core include). Shoelace's behavior is matched exactly, including its quirks;
// each one is marked "Upstream quirk" below and listed on the docs page.
import { html, type PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import { CharmElement } from '@charm-ux/core/dist/base/index.js';
import { ShoelaceCompat } from '../../internal/shoelace-compat.js';
import styles from './include.styles.js';
import { requestInclude } from './request.js';

/**
 * Includes give you the power to embed external HTML files into the page. API modelled on Shoelace's `sl-include`.
 * There is no core counterpart, so it extends the core base element.
 *
 * Velcro extension inherited from the core base element and kept working: the `ready` event (non-bubbling, emitted once
 * after the first render). Shoelace has no such event.
 *
 * @property {string} lang - The element's language, as set by the `lang` attribute or property. Not reflected.
 *
 * @tag sl-include
 * @status prototype
 *
 * @event sl-load - Emitted when the included file is loaded.
 * @event {{ status: number }} sl-error - Emitted when the included file fails to load due to an error.
 */
export class VelcroInclude extends ShoelaceCompat(CharmElement, { lang: true, dir: true }) {
  public static override baseName = 'include';

  // Core's base styles are replaced by Shoelace's own (see the styles file). The only core rule that can apply to this
  // template is `:host([hidden]) { display: none !important }`, which Shoelace does not have.
  public static override styles = [styles];

  /**
   * The element's text direction, as set by the `dir` attribute or property and returned as set. Not reflected. Any
   * string can be assigned; the declared read type stays core's `'ltr' | 'rtl' | 'auto'`.
   */
  @property()
  public override get dir(): 'ltr' | 'rtl' | 'auto' {
    return super.dir;
  }
  public override set dir(value: string) {
    super.dir = value as 'ltr' | 'rtl' | 'auto';
  }

  /**
   * The location of the HTML file to include. Be sure you trust the content you are including as it will be executed as
   * code and can result in XSS attacks.
   */
  @property()
  public src!: string;

  /** The fetch mode to use. */
  @property()
  public mode: 'cors' | 'no-cors' | 'same-origin' = 'cors';

  /**
   * Allows included scripts to be executed. Be sure you trust the content you are including as it will be executed as
   * code and can result in XSS attacks.
   */
  @property({ attribute: 'allow-scripts', type: Boolean })
  public allowScripts = false;

  // No property of this element is reflected, so Shoelace's restore of reflected properties' initial values (when their
  // attribute is removed) has nothing to restore and is not implemented. Upstream quirk, a consequence: removing the
  // `mode` attribute sets `mode` to null (not back to 'cors'), and the next request then fails with `sl-error` status -1,
  // because `fetch` rejects a null mode; removing `src` sets it to null, which requests the relative URL "null".

  private executeScript(script: HTMLScriptElement) {
    // Create a copy of the script and swap it out so the browser executes it
    const newScript = document.createElement('script');
    [...script.attributes].forEach(attr => newScript.setAttribute(attr.name, attr.value));
    newScript.textContent = script.textContent;
    script.parentNode!.replaceChild(newScript, script);
  }

  // Shoelace's `@watch('src')`: it runs before the render, including on the first update (so a `src` set before the
  // element first updates is requested then), and it is not awaited. Upstream quirk: the method is public.
  protected override update(changed: PropertyValues<this>) {
    if (changed.has('src') && changed.get('src') !== this.src) {
      void this.handleSrcChange();
    }

    super.update(changed);
  }

  // Upstream quirks: only `src` triggers a request. Changing `mode` or `allow-scripts` later does nothing until the
  // next `src` change, and `allow-scripts` only applies to the scripts of content loaded after it was set. The stale-src
  // check below runs only when the request settles with a response: a response (ok or not) for a superseded `src` emits
  // nothing, but a superseded request that rejects skips the check and reaches the catch, so it still emits `sl-error`
  // with status -1 after the newer content has loaded. With `src` A, then B, then A again the first request is not
  // stale (`src` is A again), so A is inserted, and `sl-load` is emitted, once per request. Any exception, including
  // one thrown after the content was replaced (a script that cannot be re-created, for example), emits `sl-error` with
  // status -1, and a response that is not ok leaves the previous content in place.
  public async handleSrcChange(): Promise<void> {
    try {
      const src = this.src;
      const file = await requestInclude(src, this.mode);

      // If the src changed since the request started do nothing, otherwise we risk overwriting a subsequent response
      if (src !== this.src) {
        return;
      }

      if (!file.ok) {
        this.emit('sl-error', { detail: { status: file.status } });
        return;
      }

      this.innerHTML = file.html;

      if (this.allowScripts) {
        [...this.querySelectorAll('script')].forEach(script => this.executeScript(script));
      }

      this.emit('sl-load');
    } catch {
      this.emit('sl-error', { detail: { status: -1 } });
    }
  }

  // Upstream: Shoelace's render is public.
  public override render() {
    return html`<slot></slot>`;
  }
}

export default VelcroInclude;
