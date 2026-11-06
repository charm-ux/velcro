// Modelled on the behavior of @shoelace-style/localize 3.2 (Copyright (c) 2020 A Beautiful Site, LLC, MIT License) as used by
// Shoelace v2.20.1 (src/utilities/localize.ts). See THIRD_PARTY_NOTICES.md. No source or runtime of @shoelace-style/localize
// is included; this is a small original implementation of the same registry and resolution rules.
import type { ReactiveController, ReactiveControllerHost } from 'lit';

/**
 * The shape every translation shares: a language code, a display name and a text direction. Shoelace's own term list is
 * declared by `Translation` in `../utilities/localize.ts`, which extends this.
 */
export interface Translation {
  $code: string; // e.g. en, en-GB
  $name: string; // e.g. English, Español
  $dir: 'ltr' | 'rtl';
}

/** A translation with any terms, the controller's default type parameter (as in @shoelace-style/localize). */
export interface DefaultTranslation extends Translation {
  [key: string]: any;
}

export interface ExistsOptions {
  lang: string;
  includeFallback: boolean;
}

/** The parameters of a function term, or none for a string term. */
export type FunctionParams<T> = T extends (...args: infer U) => any ? U : [];

export type LocalizeHost = ReactiveControllerHost & HTMLElement & { lang?: string; dir?: string };

// One registry per module instance. As in Shoelace, a translation registered through a different copy of this module is
// not seen by components that use this one.
const translations = new Map<string, Translation>();
let fallback: Translation | undefined;

const connected = new Set<LocalizeController>();
let observer: MutationObserver | undefined;

/** Re-renders every connected localized element (after a registration, or when `<html lang|dir>` changes). */
export function update(): void {
  connected.forEach(controller => controller.host.requestUpdate());
}

// Shoelace's library observes `<html lang dir>` from the moment it is imported; here the one shared observer is attached
// while any localized element is connected, which has the same visible effect.
function sync(): void {
  if (connected.size > 0 && !observer && typeof MutationObserver !== 'undefined') {
    observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['dir', 'lang'] });
  } else if (connected.size === 0 && observer) {
    observer.disconnect();
    observer = undefined;
  }
}

/**
 * Registers one or more translations. The code is matched case-insensitively; registering a code again merges the new
 * terms over the existing ones. The first translation ever registered is the fallback (English, registered by
 * `../utilities/localize.ts`). Connected localized elements re-render.
 */
export function registerTranslation(...translation: Translation[]): void {
  translation.forEach(t => {
    const code = t.$code.toLowerCase();
    const existing = translations.get(code);
    translations.set(code, existing ? { ...existing, ...t } : t);
    if (!fallback) fallback = t;
  });
  update();
}

/**
 * Localization controller with the API of @shoelace-style/localize's: `term`, `exists`, `lang`, `dir` and the `Intl`
 * based `date`, `number` and `relativeTime` helpers.
 *
 * Resolution: the host's `lang` (and `dir`) when set, otherwise the `lang` / `dir` of the document element, otherwise the
 * browser language (`navigator.language`) / `ltr`. An unset host `lang` (undefined, as in Shoelace, or null after its
 * attribute is removed) falls through the same way, as does an empty string. A term is looked up in the translation for
 * the full `language-region` code, then the language alone, then the fallback; a term found nowhere logs an error and
 * renders its key. The host re-renders when the document element's `lang` or `dir` changes and when a translation is
 * registered. A change of the host's own `lang` re-renders it only when the host declares `lang` as a reactive property,
 * as Shoelace's base element does.
 */
export class LocalizeController<UserTranslation extends Translation = DefaultTranslation> implements ReactiveController {
  public readonly host: LocalizeHost;

  public constructor(host: LocalizeHost) {
    this.host = host;
    host.addController(this);
  }

  public hostConnected(): void {
    connected.add(this as LocalizeController<Translation>);
    sync();
  }

  public hostDisconnected(): void {
    connected.delete(this as LocalizeController<Translation>);
    sync();
  }

  /** The resolved language, lower-cased: the host's `lang`, else the document's, else the browser language. */
  public lang(): string {
    const documentLang = document.documentElement.lang || navigator.language;
    return `${this.host.lang || documentLang}`.toLowerCase();
  }

  /** The resolved direction: the host's `dir` ATTRIBUTE only (not the `dir` property, which core's getter resolves through computed style), else the document's, else `ltr`. */
  public dir(): string {
    const hostDir = this.host.getAttribute('dir') || '';
    return `${hostDir || document.documentElement.dir || 'ltr'}`.toLowerCase();
  }

  private getTranslationData(lang: string) {
    // "en_US" is accepted as "en-US". An invalid tag throws a RangeError from Intl.Locale, as upstream.
    const locale = new Intl.Locale(lang.replace(/_/g, '-'));
    const language = locale.language.toLowerCase();
    const region = locale.region?.toLowerCase() ?? '';
    const primary = translations.get(`${language}-${region}`) as UserTranslation | undefined;
    const secondary = translations.get(language) as UserTranslation | undefined;
    return { locale, language, region, primary, secondary };
  }

  /** Whether a term exists for the given (or the resolved) language, optionally also counting the fallback. */
  public exists<K extends keyof UserTranslation>(key: K, options: Partial<ExistsOptions>): boolean {
    const { primary, secondary } = this.getTranslationData(options.lang ?? this.lang());
    const includeFallback = options.includeFallback ?? false;
    return Boolean(
      primary?.[key] ||
        secondary?.[key] ||
        (includeFallback && fallback && (fallback as unknown as UserTranslation)[key]),
    );
  }

  /** A translated term: from the `language-region` translation, else the language's, else the fallback, else the key. */
  public term<K extends keyof UserTranslation>(key: K, ...args: FunctionParams<UserTranslation[K]>): string {
    const { primary, secondary } = this.getTranslationData(this.lang());
    let term: unknown;

    if (primary?.[key]) {
      term = primary[key];
    } else if (secondary?.[key]) {
      term = secondary[key];
    } else if (fallback && (fallback as unknown as UserTranslation)[key]) {
      term = (fallback as unknown as UserTranslation)[key];
    } else {
      console.error(`No translation found for: ${String(key)}`);
      return String(key);
    }

    if (typeof term === 'function') {
      return (term as (...params: unknown[]) => string)(...args);
    }
    return term as string;
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
