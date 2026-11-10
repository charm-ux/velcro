// Portions of the API documentation wording and the behavior in this file (resolving `name` through a registered icon
// library or fetching `src`, the shared request cache with cacheable and retryable errors, sprite sheets drawn as
// `<svg part="svg"><use part="use">`, library mutators, `sl-load` / `sl-error`, and the label-driven `role="img"` /
// `aria-hidden` on the host) are adapted from Shoelace v2.20.1 (src/components/icon/icon.component.ts), Copyright (c)
// 2020 A Beautiful Site, LLC, MIT License. See THIRD_PARTY_NOTICES.md. No Shoelace source file or runtime is included.
// Shoelace's behavior is matched exactly, including its quirks; each one is marked "Upstream quirk" below and listed on
// the docs page.
import { html, type HTMLTemplateResult, type PropertyValues, type TemplateResult } from 'lit';
import { isTemplateResult } from 'lit/directive-helpers.js';
import { property, state } from 'lit/decorators.js';
import { CoreIcon } from '@charm-ux/core/dist/components/icon/icon.js';
import { ShoelaceCompat, restoreReflectedProperties } from '../../internal/shoelace-compat.js';
import { getIconLibrary, type IconLibrary, unwatchIcon, watchIcon } from './library.js';
import styles from './icon.styles.js';

interface IconError {
  /** A cacheable error stays in the shared cache; a retryable one is dropped so the next request fetches again. */
  readonly retry: boolean;
  /** The HTTP status, or -1 when the request failed without one or the file is not an SVG. */
  readonly status: number;
}
type SVGResult = HTMLTemplateResult | SVGSVGElement | IconError;

const isIconError = (result: SVGResult): result is IconError =>
  !isTemplateResult(result) && !(result instanceof SVGElement) && typeof (result as IconError).retry === 'boolean';

let parser: DOMParser;
// Shared by every sl-icon on the page, keyed by URL, as in Shoelace.
const iconCache = new Map<string, Promise<SVGResult>>();

interface IconSource {
  url?: string;
  fromLibrary: boolean;
}

/**
 * Icons are symbols that can be used to represent various options within an application. API modelled on Shoelace's
 * `sl-icon`. The default library is Bootstrap Icons, shipped with the package in `dist/assets/icons`.
 *
 * @property {string} lang - The element's language, as set by the `lang` attribute or property. Not reflected.
 *
 * @tag sl-icon
 * @status prototype
 *
 * @event sl-load - Emitted when the icon has loaded. When using `spriteSheet: true` this will not emit.
 * @event sl-error - Emitted when the icon fails to load due to an error. When using `spriteSheet: true` this will not emit.
 * @event icon-load - Velcro extension (from the core icon), emitted together with `sl-load`.
 * @event {{ status: number }} icon-error - Velcro extension (from the core icon), emitted together with `sl-error`. `status` is the HTTP status, or -1 when there is none.
 *
 * @csspart svg - The internal SVG element.
 * @csspart use - The <use> element generated when using `spriteSheet: true`
 */
export class VelcroIcon extends ShoelaceCompat(CoreIcon, { lang: true, dir: true, reflected: true }) {
  // Core's styles are replaced by Shoelace's own (see the styles file): core's icon styles make the host an inline-flex
  // box with `contain: strict`, `vertical-align: middle` and a forced `fill: currentColor`, and core's base styles add
  // `:host([hidden]) { display: none !important }`, `box-sizing: border-box` on every shadow descendant and focus and
  // form-control resets. Shoelace's icon has none of these.
  public static override styles = [styles];

  private initialRender = false;

  // Shoelace's private `svg` state. Core's own `svg` state (a markup string) stays declared by the base class but unused.
  @state() private icon: SVGElement | HTMLTemplateResult | null = null;

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

  /** The name of the icon to draw. Available names depend on the icon library being used. */
  @property({ reflect: true }) public override name?: string;

  /**
   * An external URL of an SVG file. Be sure you trust the content you are including, as it will be executed as code and
   * can result in XSS attacks.
   */
  @property() public src?: string;

  /**
   * An alternate description to use for assistive devices. If omitted, the icon will be considered presentational and
   * ignored by assistive devices.
   */
  @property() public override label = '';

  /** The name of a registered custom icon library. */
  @property({ reflect: true }) public library = 'default';

  /**
   * Velcro extension (from the core icon): an external URL of an SVG file, used only when `src` is null or undefined
   * (never set, or its attribute removed) and no library icon applies. Prefer `src`.
   */
  @property() public override url?: string;

  public override connectedCallback() {
    super.connectedCallback();
    watchIcon(this);
  }

  public override disconnectedCallback() {
    super.disconnectedCallback();
    unwatchIcon(this);
  }

  // Core's willUpdate resolves core's own icon set on every update; Velcro resolves icons in setIcon() instead, so core's
  // is not called. Async only to match core's signature; nothing is awaited, so the body runs before render.
  protected override async willUpdate(changed?: PropertyValues<this>) {
    restoreReflectedProperties(this, changed);
  }

  // Shoelace's `@watch(['name', 'src', 'library'])` and `@watch('label')`, in the order Shoelace's decorators wrap
  // `update`: they run before render, on the first update too. Upstream quirk: `setIcon` runs once for EACH watched
  // property that changed, so changing `name` and `library` together on a drawn icon fetches once (shared cache) but
  // draws twice, runs the library's mutator twice and emits `sl-load` (or `sl-error`) twice.
  protected override update(changed: PropertyValues<this>) {
    const differs = (prop: keyof VelcroIcon) => changed.has(prop) && changed.get(prop) !== this[prop];
    const watched = (['name', 'src', 'library'] as const).filter(differs);
    watched.forEach(() => void this.setIcon());
    // Velcro extension: `url` redraws only when it is the source in effect and no Shoelace property changed with it,
    // so it never adds a load or an event to what Shoelace does.
    if (!watched.length && differs('url') && this.src == null && !(this.name && getIconLibrary(this.library))) {
      void this.setIcon();
    }
    if (differs('label')) {
      this.handleLabelChange();
    }
    super.update(changed);
  }

  protected override firstUpdated() {
    super.firstUpdated();
    this.initialRender = true;
    void this.setIcon();
  }

  /** Given a URL, this function returns the resulting SVG element or an appropriate error. */
  private async resolveIcon(url: string, library?: IconLibrary): Promise<SVGResult> {
    let fileData: Response;

    if (library?.spriteSheet) {
      this.icon = html`<svg part="svg">
        <use part="use" href="${url}"></use>
      </svg>`;

      return this.icon;
    }

    try {
      fileData = await fetch(url, { mode: 'cors' });
      if (!fileData.ok) return { retry: fileData.status !== 410, status: fileData.status };
    } catch {
      return { retry: true, status: -1 };
    }

    const notSvg: IconError = { retry: false, status: fileData.status };
    try {
      // Upstream quirk: the fetched text is parsed with innerHTML and not sanitized, so markup such as an event handler
      // attribute on an element in the response (from `src` or a library's URL) runs in the page.
      const div = document.createElement('div');
      div.innerHTML = await fileData.text();

      const svg = div.firstElementChild;
      if (svg?.tagName?.toLowerCase() !== 'svg') return notSvg;

      if (!parser) parser = new DOMParser();
      const doc = parser.parseFromString(svg.outerHTML, 'text/html');

      const svgEl = doc.body.querySelector('svg');
      if (!svgEl) return notSvg;

      svgEl.part.add('svg');
      return document.adoptNode(svgEl);
    } catch {
      return notSvg;
    }
  }

  private getIconSource(): IconSource {
    const library = getIconLibrary(this.library);
    if (this.name && library) {
      return {
        url: library.resolver(this.name),
        fromLibrary: true,
      };
    }

    return {
      url: this.src ?? this.url,
      fromLibrary: false,
    };
  }

  private handleLabelChange() {
    const hasLabel = typeof this.label === 'string' && this.label.length > 0;

    if (hasLabel) {
      this.setAttribute('role', 'img');
      this.setAttribute('aria-label', this.label);
      this.removeAttribute('aria-hidden');
    } else {
      this.removeAttribute('role');
      this.removeAttribute('aria-label');
      this.setAttribute('aria-hidden', 'true');
    }
  }

  /** @internal Resolves and draws the icon; runs when `name`, `src`, `library` or `url` changes and when its library is registered. */
  public override async setIcon() {
    const { url, fromLibrary } = this.getIconSource();
    const library = fromLibrary ? getIconLibrary(this.library) : undefined;

    if (!url) {
      this.icon = null;
      return;
    }

    let iconResolver = iconCache.get(url);
    if (!iconResolver) {
      iconResolver = this.resolveIcon(url, library);
      iconCache.set(url, iconResolver);
    }

    // If we haven't rendered yet, exit early. This avoids unnecessary work due to watching multiple props.
    if (!this.initialRender) {
      return;
    }

    const svg = await iconResolver;

    if (isIconError(svg) && svg.retry) {
      iconCache.delete(url);
    }

    if (url !== this.getIconSource().url) {
      // If the url has changed while fetching the icon, ignore this request
      return;
    }

    if (isTemplateResult(svg)) {
      this.icon = svg;

      if (library) {
        // Using a templateResult requires the SVG to be written to the DOM first before we can grab the SVGElement
        // to be passed to the library's mutator function.
        await this.updateComplete;

        const shadowSVG = this.shadowRoot!.querySelector("[part='svg']");

        if (typeof library.mutator === 'function' && shadowSVG) {
          library.mutator(shadowSVG as SVGElement);
        }
      }

      return;
    }

    if (isIconError(svg)) {
      this.icon = null;
      this.emit('sl-error');
      this.emit('icon-error', { detail: { status: svg.status } });
      return;
    }

    this.icon = svg.cloneNode(true) as SVGElement;
    library?.mutator?.(this.icon);
    this.emit('sl-load');
    this.emit('icon-load');
  }

  // Renders the resolved SVG (or the sprite sheet template) directly in the shadow root, with no wrapper, as in Shoelace.
  // The value is returned as is (not inside a template), as Shoelace does; core's signature declares a template result.
  protected override render() {
    return this.icon as unknown as TemplateResult;
  }
}

export default VelcroIcon;
