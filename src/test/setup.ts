import '@testing-library/jest-dom/vitest';

// jsdom has no ResizeObserver, which @tanstack/react-virtual (used by
// EmployeeDirectory's row list) needs to measure its scroll container and
// compute which rows are in the visible range. Without this, every
// virtualized list renders zero rows in tests.
if (typeof globalThis.ResizeObserver === 'undefined') {
  class ResizeObserverMock {
    private callback: ResizeObserverCallback;
    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
    }
    observe(target: Element) {
      // Report a plausible non-zero viewport synchronously so the
      // virtualizer computes a visible range instead of defaulting to its
      // zero-height initialRect (which renders no rows at all in jsdom).
      this.callback(
        [
          {
            target,
            contentRect: { width: 800, height: 500 },
            borderBoxSize: [{ inlineSize: 800, blockSize: 500 }],
          } as unknown as ResizeObserverEntry,
        ],
        this as unknown as ResizeObserver
      );
    }
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;
}

// jsdom doesn't implement scrollIntoView at all -- OnboardingChecklist calls
// it (via a setTimeout) to scroll the active task into view whenever there's
// more than one non-completed task, which throws an unhandled TypeError in
// any test rendering that scenario.
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
