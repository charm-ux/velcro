// Reflected-default restoration is adapted from Shoelace v2.20.1 (src/internal/shoelace-element.ts),
// Copyright (c) 2020 A Beautiful Site, LLC, MIT License. See THIRD_PARTY_NOTICES.md.
import type { PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import type { CharmElement } from '@charm-ux/core/dist/base/charm-element/charm-element.js';

interface CompatOptions {
  lang?: boolean;
  /** Components keep their decorated forwarding accessor for reactivity. */
  dir?: boolean;
  /** Read non-reflected getters only for components whose original snapshot did so. */
  reflected?: boolean | 'read-all';
}

const initialValues = new WeakMap<HTMLElement, { values: Map<PropertyKey, unknown>; recorded: boolean }>();
const directions = new WeakMap<CharmElement, string>();

/**
 * Preserves each component's existing Shoelace base semantics without replacing its Charm parent.
 * Dependency registration deliberately stays in component constructors, after their own initializers.
 */
export function ShoelaceCompat<T extends typeof CharmElement>(Base: T, options: CompatOptions): T {
  class CompatElement extends (Base as typeof CharmElement) {}

  // Keep the exact @property() defaults, including converter and change detection.
  if (options.lang) property()(CompatElement.prototype, 'lang');

  if (options.reflected) {
    Object.defineProperty(CompatElement.prototype, 'attributeChangedCallback', {
      configurable: true,
      writable: true,
      value(this: CharmElement, name: string, previous: string | null, next: string | null) {
        let initial = initialValues.get(this);
        if (!initial) {
          // A failed capture retains its partial map and retries on the next callback.
          initial = { values: new Map<PropertyKey, unknown>(), recorded: false };
          initialValues.set(this, initial);
        }
        if (!initial.recorded) {
          (this.constructor as typeof CharmElement).elementProperties.forEach((declaration, key) => {
            if (!declaration.reflect && options.reflected !== 'read-all') return;
            const value: unknown = Reflect.get(this, key);
            if (declaration.reflect && value != null) initial.values.set(key, value);
          });
          initial.recorded = true;
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
 * An absent changed map keeps icon's optional lifecycle call a no-op.
 */
export function restoreReflectedProperties(element: HTMLElement, changed?: PropertyValues): void {
  const properties = element as HTMLElement & Record<PropertyKey, unknown>;
  initialValues.get(element)?.values.forEach((value, key) => {
    if (changed?.has(key) && properties[key] == null) properties[key] = value;
  });
}
