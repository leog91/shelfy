import { clipsySummarySchema, type ClipsySummary } from "./clipsy";

export const CLIPSY_CACHE_TTL = 6 * 60 * 60 * 1000;
type CachedSummary = {
  owner: string;
  summary: ClipsySummary;
  url: string;
  fetchedAt: number;
};

// One instance per LibraryProvider, never shared across server requests or tabs.
// Counts only: no tokens, persistent browser storage or HTTP response caching.
export class ClipsySummaryCache {
  private value: CachedSummary | null = null;
  private generation = 0;
  private listeners = new Set<() => void>();
  private pending: {
    owner: string;
    controller: AbortController;
    promise: Promise<CachedSummary | null>;
  } | null = null;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  getSnapshot = (owner: string) =>
    this.value?.owner === owner ? this.value : null;
  private emit() {
    this.listeners.forEach((listener) => listener());
  }
  clear() {
    this.generation++;
    this.pending?.controller.abort();
    this.pending = null;
    this.value = null;
    this.emit();
  }
  async load(
    owner: string,
    options: {
      force?: boolean;
      fetcher?: typeof fetch;
    } = {},
  ) {
    const cached = this.getSnapshot(owner);
    const age = cached ? Date.now() - cached.fetchedAt : -1;
    if (!options.force && cached && age >= 0 && age < CLIPSY_CACHE_TTL)
      return cached;
    if (!options.force && this.pending?.owner === owner)
      return this.pending.promise;
    this.clear();
    const generation = this.generation;
    const controller = new AbortController();
    const current = () => generation === this.generation;
    // The provider owns requests too, so a quick route change or effect remount
    // reuses the in-flight read rather than aborting it and billing another one.
    const promise = (async () => {
      try {
        const response = await (options.fetcher ?? fetch)("/api/clipsy", {
          cache: "no-store",
          headers: { "x-workspace-id": owner },
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Clipsy unavailable");
        const body = await response.json();
        if (!current() || !body.connected) return null;
        const summary = clipsySummarySchema.parse(body.summary);
        const url = new URL(body.url);
        if (
          !["http:", "https:"].includes(url.protocol) ||
          url.username ||
          url.password
        )
          throw new Error("Invalid Clipsy URL");
        this.value = { owner, summary, url: url.origin, fetchedAt: Date.now() };
        this.emit();
        return this.value;
      } catch (error) {
        if (!current()) return null;
        throw error;
      } finally {
        if (current()) this.pending = null;
      }
    })();
    this.pending = { owner, controller, promise };
    return promise;
  }
}
