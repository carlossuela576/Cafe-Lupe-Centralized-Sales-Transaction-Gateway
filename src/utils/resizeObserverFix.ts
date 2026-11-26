/**
 * Stabilizes browser ResizeObserver callbacks by scheduling delivery on the next
 * animation frame and dropping entries for elements that were unobserved or
 * detached before the frame runs. Prevents synchronous DOM/React flushSync loops
 * (such as inside @fullcalendar/react) from triggering Chromium's
 * "ResizeObserver loop completed with undelivered notifications." error.
 */
if (typeof window !== 'undefined' && typeof window.ResizeObserver !== 'undefined') {
  const NativeResizeObserver = window.ResizeObserver;

  class SafeResizeObserver implements ResizeObserver {
    private observer: ResizeObserver;
    private generations = new WeakMap<Element, number>();
    private active = new Set<Element>();
    private rafId: number | null = null;
    private pendingEntries: Array<{ entry: ResizeObserverEntry; gen: number }> = [];

    constructor(callback: ResizeObserverCallback) {
      this.observer = new NativeResizeObserver((entries) => {
        for (const entry of entries) {
          const gen = this.generations.get(entry.target);
          if (gen !== undefined && this.active.has(entry.target)) {
            this.pendingEntries.push({ entry, gen });
          }
        }

        if (this.pendingEntries.length === 0 || this.rafId !== null) {
          return;
        }

        this.rafId = window.requestAnimationFrame(() => {
          this.rafId = null;
          const batch = this.pendingEntries.splice(0, this.pendingEntries.length);

          const latestByTarget = new Map<Element, ResizeObserverEntry>();
          for (const item of batch) {
            if (
              this.active.has(item.entry.target) &&
              this.generations.get(item.entry.target) === item.gen &&
              item.entry.target.isConnected
            ) {
              latestByTarget.set(item.entry.target, item.entry);
            }
          }

          if (latestByTarget.size > 0) {
            callback(Array.from(latestByTarget.values()), this);
          }
        });
      });
    }

    observe(target: Element, options?: ResizeObserverOptions): void {
      const nextGen = (this.generations.get(target) ?? 0) + 1;
      this.generations.set(target, nextGen);
      this.active.add(target);
      this.observer.observe(target, options);
    }

    unobserve(target: Element): void {
      this.active.delete(target);
      this.generations.delete(target);
      this.observer.unobserve(target);
    }

    disconnect(): void {
      this.active.clear();
      this.pendingEntries.length = 0;
      if (this.rafId !== null) {
        window.cancelAnimationFrame(this.rafId);
        this.rafId = null;
      }
      this.observer.disconnect();
    }
  }

  window.ResizeObserver = SafeResizeObserver as unknown as typeof ResizeObserver;

  window.addEventListener(
    'error',
    (event) => {
      if (
        typeof event.message === 'string' &&
        (event.message.includes('ResizeObserver loop completed with undelivered notifications') ||
          event.message.includes('ResizeObserver loop limit exceeded'))
      ) {
        event.stopImmediatePropagation();
        event.preventDefault();
      }
    },
    true
  );
}
