// Adapted from Shoelace v2.20.1 (src/internal/form.ts), Copyright (c) 2020 A Beautiful Site, LLC, MIT License.
// See THIRD_PARTY_NOTICES.md. Changes: TypeScript types narrowed to what Velcro's form controls expose, the
// `sl-button` check in the formdata handler is done by an option instead of a tag name, and the comments are shortened.
// Behavior is otherwise unchanged, including the overloaded `form.checkValidity()` / `form.reportValidity()`.
import type { ReactiveController, ReactiveControllerHost } from 'lit';

/** The members a host must expose to be driven by the form control controller. */
export interface VelcroFormControl extends HTMLElement {
  name: string;
  value: unknown;
  disabled?: boolean;
  defaultValue?: unknown;
  required?: boolean;
  form?: string;
  readonly validity: ValidityState;
  checkValidity(): boolean;
  reportValidity(): boolean;
  requestUpdate(): void;
  readonly hasUpdated: boolean;
}

/** A submitter whose name, value and `form*` override attributes are passed to the temporary native button. */
export interface FormSubmitter extends Element {
  name: string;
  value: string;
}

// Forms and the Velcro controls attached to them, so a form's validity overloads are restored only by the last control.
export const formCollections: WeakMap<HTMLFormElement, Set<VelcroFormControl>> = new WeakMap();
const reportValidityOverloads: WeakMap<HTMLFormElement, () => boolean> = new WeakMap();
const checkValidityOverloads: WeakMap<HTMLFormElement, () => boolean> = new WeakMap();
// Controls the user has interacted with (drives the data-user-valid / data-user-invalid attributes).
const userInteractedControls: WeakSet<VelcroFormControl> = new WeakSet();
const interactions = new WeakMap<VelcroFormControl, string[]>();

export interface FormControlControllerOptions {
  /** Returns the form that owns the control. */
  form: (input: VelcroFormControl) => HTMLFormElement | null;
  /** Returns the name submitted with the form data. */
  name: (input: VelcroFormControl) => string;
  /** Returns the current value. */
  value: (input: VelcroFormControl) => unknown;
  /** Returns the default value restored on form reset. */
  defaultValue: (input: VelcroFormControl) => unknown;
  /** Returns whether the control is disabled (a disabled control's value is not submitted). */
  disabled: (input: VelcroFormControl) => boolean;
  /** Maps to the control's `reportValidity()`; a false result blocks submission. */
  reportValidity: (input: VelcroFormControl) => boolean;
  /** Maps to the control's `checkValidity()`. */
  checkValidity: (input: VelcroFormControl) => boolean;
  /** Sets the control's value (used on form reset). */
  setValue: (input: VelcroFormControl, value: unknown) => void;
  /** When all of these events have been emitted the control counts as user-interacted. */
  assumeInteractionOn: string[];
  /** When true the control never appends its own name/value in `formdata` (a button only submits as the submitter). */
  submitsOnlyAsSubmitter: boolean;
}

/** A reactive controller that lets a Velcro form control take part in submission, reset and validation. */
export class FormControlController implements ReactiveController {
  public host: VelcroFormControl & ReactiveControllerHost;
  public form?: HTMLFormElement | null;
  public options: FormControlControllerOptions;

  public constructor(host: ReactiveControllerHost & VelcroFormControl, options?: Partial<FormControlControllerOptions>) {
    (this.host = host).addController(this);
    this.options = {
      form: input => {
        // A `form` id (property or attribute; buttons do not reflect it) wins over the closest containing form.
        const formId = input.form;
        if (formId) {
          const root = input.getRootNode() as Document | ShadowRoot | HTMLElement;
          const form = root.querySelector(`#${formId}`);
          if (form) {
            return form as HTMLFormElement;
          }
        }
        return input.closest('form');
      },
      name: input => input.name,
      value: input => input.value,
      defaultValue: input => input.defaultValue,
      disabled: input => input.disabled ?? false,
      reportValidity: input => (typeof input.reportValidity === 'function' ? input.reportValidity() : true),
      checkValidity: input => (typeof input.checkValidity === 'function' ? input.checkValidity() : true),
      setValue: (input, value) => (input.value = value),
      assumeInteractionOn: ['sl-input'],
      submitsOnlyAsSubmitter: false,
      ...options,
    };
  }

  public hostConnected() {
    const form = this.options.form(this.host);
    if (form) {
      this.attachForm(form);
    }
    interactions.set(this.host, []);
    this.options.assumeInteractionOn.forEach(event => this.host.addEventListener(event, this.handleInteraction));
  }

  public hostDisconnected() {
    this.detachForm();
    interactions.delete(this.host);
    this.options.assumeInteractionOn.forEach(event => this.host.removeEventListener(event, this.handleInteraction));
  }

  public hostUpdated() {
    const form = this.options.form(this.host);
    if (!form) {
      this.detachForm();
    }
    if (form && this.form !== form) {
      this.detachForm();
      this.attachForm(form);
    }
    if (this.host.hasUpdated) {
      this.setValidity(this.host.validity.valid);
    }
  }

  private attachForm(form?: HTMLFormElement) {
    if (form) {
      this.form = form;
      if (formCollections.has(this.form)) {
        formCollections.get(this.form)!.add(this.host);
      } else {
        formCollections.set(this.form, new Set<VelcroFormControl>([this.host]));
      }
      this.form.addEventListener('formdata', this.handleFormData);
      this.form.addEventListener('submit', this.handleFormSubmit);
      this.form.addEventListener('reset', this.handleFormReset);

      // Overload the form's reportValidity() / checkValidity() so they also look at Velcro controls.
      if (!reportValidityOverloads.has(this.form)) {
        reportValidityOverloads.set(this.form, this.form.reportValidity);
        this.form.reportValidity = () => this.reportFormValidity();
      }
      if (!checkValidityOverloads.has(this.form)) {
        checkValidityOverloads.set(this.form, this.form.checkValidity);
        this.form.checkValidity = () => this.checkFormValidity();
      }
    } else {
      this.form = undefined;
    }
  }

  private detachForm() {
    if (!this.form) return;
    const formCollection = formCollections.get(this.form);
    if (!formCollection) {
      return;
    }
    formCollection.delete(this.host);
    // Only the last control restores the form; otherwise the remaining controls would lose their validity checks.
    if (formCollection.size <= 0) {
      this.form.removeEventListener('formdata', this.handleFormData);
      this.form.removeEventListener('submit', this.handleFormSubmit);
      this.form.removeEventListener('reset', this.handleFormReset);
      if (reportValidityOverloads.has(this.form)) {
        this.form.reportValidity = reportValidityOverloads.get(this.form)!;
        reportValidityOverloads.delete(this.form);
      }
      if (checkValidityOverloads.has(this.form)) {
        this.form.checkValidity = checkValidityOverloads.get(this.form)!;
        checkValidityOverloads.delete(this.form);
      }
      this.form = undefined;
    }
  }

  private handleFormData = (event: FormDataEvent) => {
    const disabled = this.options.disabled(this.host);
    const name = this.options.name(this.host);
    const value = this.options.value(this.host);
    if (
      this.host.isConnected &&
      !disabled &&
      !this.options.submitsOnlyAsSubmitter &&
      typeof name === 'string' &&
      name.length > 0 &&
      typeof value !== 'undefined'
    ) {
      if (Array.isArray(value)) {
        (value as unknown[]).forEach(val => event.formData.append(name, String(val)));
      } else {
        event.formData.append(name, String(value));
      }
    }
  };

  private handleFormSubmit = (event: Event) => {
    const disabled = this.options.disabled(this.host);
    const reportValidity = this.options.reportValidity;
    if (this.form && !this.form.noValidate) {
      formCollections.get(this.form)?.forEach(control => this.setUserInteracted(control, true));
    }
    if (this.form && !this.form.noValidate && !disabled && !reportValidity(this.host)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  };

  private handleFormReset = () => {
    this.options.setValue(this.host, this.options.defaultValue(this.host));
    this.setUserInteracted(this.host, false);
    interactions.set(this.host, []);
  };

  private handleInteraction = (event: Event) => {
    const emittedEvents = interactions.get(this.host)!;
    if (!emittedEvents.includes(event.type)) {
      emittedEvents.push(event.type);
    }
    if (emittedEvents.length === this.options.assumeInteractionOn.length) {
      this.setUserInteracted(this.host, true);
    }
  };

  // Like reportFormValidity, without showing the browser's validation UI. Honors the form's `novalidate`.
  private checkFormValidity = () => {
    if (this.form && !this.form.noValidate) {
      const elements = this.form.querySelectorAll<HTMLInputElement>('*');
      for (const element of elements) {
        if (typeof element.checkValidity === 'function' && !element.checkValidity()) {
          return false;
        }
      }
    }
    return true;
  };

  // Checks every element in the form that has reportValidity(), native and Velcro alike. Honors `novalidate`.
  private reportFormValidity = () => {
    if (this.form && !this.form.noValidate) {
      const elements = this.form.querySelectorAll<HTMLInputElement>('*');
      for (const element of elements) {
        if (typeof element.reportValidity === 'function' && !element.reportValidity()) {
          return false;
        }
      }
    }
    return true;
  };

  private setUserInteracted(el: VelcroFormControl, hasInteracted: boolean) {
    if (hasInteracted) {
      userInteractedControls.add(el);
    } else {
      userInteractedControls.delete(el);
    }
    el.requestUpdate();
  }

  // `form.submit()` skips the submit event, constraint validation and the submitter, so a temporary native button is
  // appended to the form, clicked and removed instead. It carries the submitter's name, value and `form*` overrides.
  private doAction(type: 'submit' | 'reset', submitter?: FormSubmitter) {
    if (this.form) {
      const button = document.createElement('button');
      button.type = type;
      button.style.position = 'absolute';
      button.style.width = '0';
      button.style.height = '0';
      button.style.clipPath = 'inset(50%)';
      button.style.overflow = 'hidden';
      button.style.whiteSpace = 'nowrap';
      if (submitter) {
        button.name = submitter.name;
        button.value = submitter.value;
        ['formaction', 'formenctype', 'formmethod', 'formnovalidate', 'formtarget'].forEach(attr => {
          if (submitter.hasAttribute(attr)) {
            button.setAttribute(attr, submitter.getAttribute(attr)!);
          }
        });
      }
      this.form.append(button);
      button.click();
      button.remove();
    }
  }

  /** Returns the associated `<form>` element, if one exists. */
  public getForm() {
    return this.form ?? null;
  }

  /** Resets the form, restoring all the controls to their default value. */
  public reset(submitter?: FormSubmitter) {
    this.doAction('reset', submitter);
  }

  /** Submits the form through a temporary native submit button, so the submit event and validation run. */
  public submit(submitter?: FormSubmitter) {
    this.doAction('submit', submitter);
  }

  /** Synchronously sets the control's validity data attributes (before Lit's next update). */
  public setValidity(isValid: boolean) {
    const host = this.host;
    const hasInteracted = Boolean(userInteractedControls.has(host));
    const required = Boolean(host.required);
    host.toggleAttribute('data-required', required);
    host.toggleAttribute('data-optional', !required);
    host.toggleAttribute('data-invalid', !isValid);
    host.toggleAttribute('data-valid', isValid);
    host.toggleAttribute('data-user-invalid', !isValid && hasInteracted);
    host.toggleAttribute('data-user-valid', isValid && hasInteracted);
  }

  /** Updates the validity data attributes from `host.validity.valid`. */
  public updateValidity() {
    this.setValidity(this.host.validity.valid);
  }

  /**
   * Dispatches a non-bubbling, cancelable `sl-invalid` event. Cancelling it also cancels the original `invalid` event,
   * when there is one; without an original event the `sl-invalid` event is dispatched already cancelled.
   */
  public emitInvalidEvent(originalInvalidEvent?: Event) {
    const slInvalidEvent = new CustomEvent<Record<PropertyKey, never>>('sl-invalid', {
      bubbles: false,
      composed: false,
      cancelable: true,
      detail: {},
    });
    if (!originalInvalidEvent) {
      slInvalidEvent.preventDefault();
    }
    if (!this.host.dispatchEvent(slInvalidEvent)) {
      originalInvalidEvent?.preventDefault();
    }
  }
}

/** A read-only validity state that represents `valid` (used where a control is barred from validation, e.g. a link). */
export const validValidityState: ValidityState = Object.freeze({
  badInput: false,
  customError: false,
  patternMismatch: false,
  rangeOverflow: false,
  rangeUnderflow: false,
  stepMismatch: false,
  tooLong: false,
  tooShort: false,
  typeMismatch: false,
  valid: true,
  valueMissing: false,
});

/** A read-only validity state that represents a missing required value. */
export const valueMissingValidityState: ValidityState = Object.freeze({
  ...validValidityState,
  valid: false,
  valueMissing: true,
});

/** A read-only validity state that represents a custom error. */
export const customErrorValidityState: ValidityState = Object.freeze({
  ...validValidityState,
  valid: false,
  customError: true,
});
