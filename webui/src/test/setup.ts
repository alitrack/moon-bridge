import "@testing-library/jest-dom/vitest";

type TestElementInternals = {
  checkValidity: () => boolean;
  reportValidity: () => boolean;
  setFormValue: (value: unknown, state?: unknown) => void;
  setValidity: (flags?: ValidityStateFlags, message?: string, anchor?: HTMLElement) => void;
  validationMessage: string;
  validity: ValidityState;
  willValidate: boolean;
};

const validValidityState = {
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
  valueMissing: false
} as ValidityState;

if (typeof ElementInternals !== "undefined") {
  if (typeof ElementInternals.prototype.setFormValue !== "function") {
    Object.defineProperty(ElementInternals.prototype, "setFormValue", {
      configurable: true,
      value: () => undefined
    });
  }

  if (typeof ElementInternals.prototype.setValidity !== "function") {
    Object.defineProperty(ElementInternals.prototype, "setValidity", {
      configurable: true,
      value: () => undefined
    });
  }

  if (typeof ElementInternals.prototype.checkValidity !== "function") {
    Object.defineProperty(ElementInternals.prototype, "checkValidity", {
      configurable: true,
      value: () => true
    });
  }

  if (typeof ElementInternals.prototype.reportValidity !== "function") {
    Object.defineProperty(ElementInternals.prototype, "reportValidity", {
      configurable: true,
      value: () => true
    });
  }

  if (!("validity" in ElementInternals.prototype)) {
    Object.defineProperty(ElementInternals.prototype, "validity", {
      configurable: true,
      get: () => validValidityState
    });
  }

  if (!("validationMessage" in ElementInternals.prototype)) {
    Object.defineProperty(ElementInternals.prototype, "validationMessage", {
      configurable: true,
      get: () => ""
    });
  }

  if (!("willValidate" in ElementInternals.prototype)) {
    Object.defineProperty(ElementInternals.prototype, "willValidate", {
      configurable: true,
      get: () => true
    });
  }
}

if (!HTMLElement.prototype.attachInternals) {
  Object.defineProperty(HTMLElement.prototype, "attachInternals", {
    configurable: true,
    value: function attachInternals(): TestElementInternals {
      return {
        checkValidity: () => true,
        reportValidity: () => true,
        setFormValue: () => undefined,
        setValidity: () => undefined,
        validationMessage: "",
        validity: validValidityState,
        willValidate: true
      };
    }
  });
}

if (!Element.prototype.animate) {
  Object.defineProperty(Element.prototype, "animate", {
    configurable: true,
    value: () =>
      ({
        addEventListener: () => undefined,
        cancel: () => undefined,
        commitStyles: () => undefined,
        finish: () => undefined,
        finished: Promise.resolve(),
        pause: () => undefined,
        persist: () => undefined,
        play: () => undefined,
        ready: Promise.resolve(),
        removeEventListener: () => undefined,
        reverse: () => undefined,
        updatePlaybackRate: () => undefined
      }) as unknown as Animation
  });
}

// md-dialog (and other Material Web surfaces) observe scrolling/sizing with
// IntersectionObserver/ResizeObserver, which jsdom does not implement.
if (!globalThis.IntersectionObserver) {
  class IntersectionObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  }
  Object.defineProperty(globalThis, "IntersectionObserver", {
    configurable: true,
    writable: true,
    value: IntersectionObserverStub
  });
}

if (!globalThis.ResizeObserver) {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Object.defineProperty(globalThis, "ResizeObserver", {
    configurable: true,
    writable: true,
    value: ResizeObserverStub
  });
}

if (!globalThis.localStorage) {
  const store = new Map<string, string>();

  const storage: Storage = {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key) => store.get(key) ?? null,
    key: (index) => Array.from(store.keys())[index] ?? null,
    removeItem: (key) => store.delete(key),
    setItem: (key, value) => store.set(key, value)
  };

  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: storage
  });

  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: storage
  });
}
