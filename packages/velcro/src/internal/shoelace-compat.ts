// Reflected-default restoration is adapted from Shoelace v2.20.1 (src/internal/shoelace-element.ts),
// Copyright (c) 2020 A Beautiful Site, LLC, MIT License. See THIRD_PARTY_NOTICES.md.
import type { PropertyValues } from 'lit';
import type { CharmElement } from '@charm-ux/core/dist/base/charm-element/charm-element.js';

interface CompatOptions {
  lang?: boolean;
  dir?: boolean;
  reflected?: boolean;
}

const initialValues = new WeakMap<CharmElement, Map<PropertyKey, unknown>>();
const directions = new WeakMap<CharmElement, string>();

/**
 * Preserves each component's existing Shoelace base semantics without replacing its Charm parent.
 * Dependency registration deliberately stays in component constructors, after their own initializers.
 */
export function ShoelaceCompat<T extends typeof CharmElement>(Base: T, options: CompatOptions): T {
  class CompatElement extends (Base as typeof CharmElement) {
    public static override properties = {
      ...(options.lang ? { lang: {} } : {}),
    };
  }

  if (options.reflected) {
    Object.defineProperty(CompatElement.prototype, 'attributeChangedCallback', {
      configurable: true,
      writable: true,
      value(this: CharmElement, name: string, previous: string | null, next: string | null) {
        if (!initialValues.has(this)) {
          const values = new Map<PropertyKey, unknown>();
          (this.constructor as typeof CharmElement).elementProperties.forEach((declaration, key) => {
            if (!declaration.reflect) return;
            const value: unknown = Reflect.get(this, key);
            if (value != null) values.set(key, value);
          });
          initialValues.set(this, values);
        }
        Base.prototype.attributeChangedCallback.call(this, name, previous, next);
      },
    });
  }

  if (options.dir) {
    // Components retain the decorated forwarding accessor for their wider setter type and existing manifest docs.
    Object.defineProperty(CompatElement.prototype, 'dir', {
      configurable: true,
      get(this: CharmElement) {
        return directions.get(this);
      },
      set(this: CharmElement, value: string) {
        directions.set(this, value);
      },
    });
  }

  return CompatElement as T;
}

/**
 * Called at the component's existing willUpdate restoration point. Some components intentionally bypass their
 * Core parent's willUpdate; keeping this explicit preserves that ordering and does not re-enable suppressed logic.
 */
export function restoreReflectedProperties(element: CharmElement, changed: PropertyValues): void {
  const properties = element as CharmElement & Record<PropertyKey, unknown>;
  initialValues.get(element)?.forEach((value, key) => {
    if (changed.has(key) && properties[key] == null) properties[key] = value;
  });
}
