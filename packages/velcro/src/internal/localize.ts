// Modelled on the behavior of @shoelace-style/localize (Copyright (c) 2020 A Beautiful Site, LLC, MIT License) as used by
// Shoelace v2.20.1 (src/utilities/localize.ts). See THIRD_PARTY_NOTICES.md. No Shoelace or @shoelace-style/localize source
// or runtime is included; this is a small original implementation of the same resolution rules.
import type { ReactiveController, ReactiveControllerHost } from 'lit';

/**
 * Minimal localization controller shared by the formatting components (format-bytes, format-date, format-number and
 * relative-time).
 *
 * Resolution matches @shoelace-style/localize: the host's `lang` (and `dir`) when set, otherwise the `lang` / `dir` of the
 * document element, otherwise the browser language (`navigator.language`) / `ltr`. An unset host `lang` (undefined, as in
 * Shoelace, or null after its attribute is removed) falls through the same way, as does an empty string. The host is
 * re-rendered when the document element's `lang` or `dir` attribute changes (one shared observer, attached while any host is connected). A change
 * of the host's own `lang` property already re-renders it through Lit.
 *
 * Gap: there is no translation registry (no `registerTranslation`, no `term()`), so strings such as accessible names are
 * not localized. Only the `Intl` based helpers exist.
 */
export type LocalizeHost = ReactiveControllerHost & HTMLElement & { lang?: string; dir?: string };

const connected = new Set<LocalizeController>();
let observer: MutationObserver | undefined;

function sync(): void {
  if (connected.size > 0 && !observer && typeof MutationObserver !== 'undefined') {
    observer = new MutationObserver(() => connected.forEach(controller => controller.host.requestUpdate()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['dir', 'lang'] });
  } else if (connected.size === 0 && observer) {
    observer.disconnect();
    observer = undefined;
  }
}

export class LocalizeController implements ReactiveController {
  public readonly host: LocalizeHost;

  public constructor(host: LocalizeHost) {
    this.host = host;
    host.addController(this);
  }

  public hostConnected(): void {
    connected.add(this);
    sync();
  }

  public hostDisconnected(): void {
    connected.delete(this);
    sync();
  }

  /** The resolved language, lower-cased: the host's `lang`, else the document's, else the browser language. */
  public lang(): string {
    const documentLang = document.documentElement.lang || navigator.language;
    return (this.host.lang || documentLang).toLowerCase();
  }

  /** The resolved direction: the host's `dir` ATTRIBUTE only (not the `dir` property, which core's getter resolves through computed style), else the document's, else `ltr`. */
  public dir(): string {
    const hostDir = this.host.getAttribute('dir') || '';
    return (hostDir || document.documentElement.dir || 'ltr').toLowerCase();
  }

  /** Formats a date with `Intl.DateTimeFormat`; an invalid date gives an empty string. */
  public date(dateToFormat: Date | string, options?: Intl.DateTimeFormatOptions): string {
    const date = new Date(dateToFormat);
    return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat(this.lang(), options).format(date);
  }

  /** Formats a number with `Intl.NumberFormat`; a non-numeric value gives an empty string. */
  public number(numberToFormat: number | string, options?: Intl.NumberFormatOptions): string {
    const value = Number(numberToFormat);
    return Number.isNaN(value) ? '' : new Intl.NumberFormat(this.lang(), options).format(value);
  }

  /** Formats a relative time with `Intl.RelativeTimeFormat`. */
  public relativeTime(value: number, unit: Intl.RelativeTimeFormatUnit, options?: Intl.RelativeTimeFormatOptions): string {
    return new Intl.RelativeTimeFormat(this.lang(), options).format(value, unit);
  }
}
