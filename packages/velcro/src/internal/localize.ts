// Adapted from @shoelace-style/localize 3.2.1 (A Beautiful Site, LLC, MIT License), the version Shoelace v2.20.1 pins and
// bundles (its src/utilities/localize.ts builds on it). See THIRD_PARTY_NOTICES.md. The registry, the document-locale
// snapshot, the lookup and the controller follow its structure; the changes are TypeScript types, the controller set, a
// `documentDir()` read of the snapshot and reading the host's dir attribute rather than its property (see `dir()`).
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

// As upstream, the document's lang and dir are a snapshot, taken when this module is evaluated and refreshed only by
// `update()`: when the observer below reports a change of `<html lang|dir>`, and on every registration. A controller
// reads the snapshot, so a change made in the current task is not seen until the observer's callback runs.
let documentDirection = 'ltr';
let documentLanguage = 'en';
const isClient = typeof MutationObserver !== 'undefined' && typeof document !== 'undefined' && typeof document.documentElement !== 'undefined';

/** Refreshes the document-locale snapshot and re-renders every connected localized element. */
export function update(): void {
  if (isClient) {
    documentDirection = document.documentElement.dir || 'ltr';
    documentLanguage = document.documentElement.lang || navigator.language;
  }
  connected.forEach(controller => controller.host.requestUpdate());
}

/**
 * The current document-direction snapshot (`<html dir>` when the snapshot was last refreshed, else `ltr`), not
 * lower-cased. For components that resolve a direction from their `dir` property, as Shoelace's controller does,
 * rather than from the attribute `LocalizeController.dir()` reads.
 */
export function documentDir(): string {
  return documentDirection;
}

// As upstream, one observer watches `<html lang dir>` from the moment this module is evaluated, for the page's lifetime.
if (isClient) {
  const documentElementObserver = new MutationObserver(update);
  documentDirection = document.documentElement.dir || 'ltr';
  documentLanguage = document.documentElement.lang || navigator.language;
  documentElementObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['dir', 'lang'] });
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
 * Resolution: the host's `lang` (and `dir`) when set, otherwise the snapshot of the document element's `lang` / `dir`
 * (refreshed by `update()`), otherwise the browser language (`navigator.language`) / `ltr`. An unset host `lang` (undefined, as in Shoelace, or null after its
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
  }

  public hostDisconnected(): void {
    connected.delete(this as LocalizeController<Translation>);
  }

  /** The resolved language, lower-cased: the host's `lang`, else the document snapshot (`<html lang>`, else the browser language). */
  public lang(): string {
    return `${this.host.lang || documentLanguage}`.toLowerCase();
  }

  /**
   * The resolved direction, lower-cased: the host's `dir` attribute, else the document snapshot (`<html dir>`, else `ltr`).
   * Upstream reads the host's `dir` property; Velcro reads the attribute because core's `dir` getter resolves the computed
   * style, so a direction set only through the property is not seen.
   */
  public dir(): string {
    const hostDir = this.host.getAttribute('dir') || '';
    return `${hostDir || documentDirection}`.toLowerCase();
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
