import { z } from "zod";
import { Item, itemSchema, ItemPatch } from "./model";
import { initialSnapshot, parseLibrary, Snapshot } from "./repository";

const importedSchema = z.object({
  added: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
});
export class RemoteItemRepository {
  constructor(private readonly accountId: string) {}
  private snapshot: Snapshot = initialSnapshot;
  private listeners = new Set<() => void>();
  private loading?: Promise<void>;
  private generation = 0;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  getSnapshot = () => this.snapshot;
  private publish(value: Snapshot) {
    this.snapshot = value;
    this.listeners.forEach((listener) => listener());
  }
  private async request(path: string, method = "GET", body?: unknown) {
    const response = await fetch(`/api/items${path}`, {
      method,
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        "X-Workspace-Id": this.accountId,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!response.ok) {
      if (response.status === 401) {
        this.generation++;
        this.publish({
          items: [],
          ready: true,
          error:
            "Your session expired or account changed in another tab. Reload and sign in again to select the correct library. Browser data has not been changed.",
        });
      }
      const result = await response.json().catch(() => null);
      throw new Error(
        typeof result?.error === "string"
          ? result.error
          : "Account request failed. Your changes were not saved.",
      );
    }
    return response;
  }
  load = (): Promise<void> => {
    if (this.loading) return this.loading;
    const generation = ++this.generation;
    this.loading = (async () => {
      try {
        const response = await this.request("");
        const items = parseLibrary(await response.text());
        if (generation === this.generation)
          this.publish({ items, ready: true });
      } catch (error) {
        if (generation === this.generation)
          this.publish({
            ...this.snapshot,
            ready: true,
            error:
              error instanceof Error
                ? error.message
                : "Could not refresh account library.",
          });
      } finally {
        this.loading = undefined;
      }
    })();
    return this.loading;
  };
  private get(id: string) {
    const item = this.snapshot.items.find((item) => item.id === id);
    if (!item)
      throw new Error("Refresh the library before changing this item.");
    return item;
  }
  private assertReady() {
    if (!this.snapshot.ready || this.snapshot.error)
      throw new Error("Refresh the account library before saving changes.");
  }
  async create(text: string, intent?: Item["intent"]) {
    this.assertReady();
    const response = await this.request("", "POST", { text, intent });
    const { item } = z
      .object({ item: itemSchema })
      .parse(await response.json());
    this.generation++;
    this.publish({
      items: [item, ...this.snapshot.items.filter((i) => i.id !== item.id)],
      ready: true,
    });
    return item;
  }
  async update(id: string, patch: ItemPatch, expectedUpdatedAt?: string) {
    this.assertReady();
    const response = await this.request(`/${id}`, "PATCH", {
      expectedUpdatedAt: expectedUpdatedAt ?? this.get(id).updatedAt,
      patch: Object.fromEntries(
        Object.entries(patch).map(([key, value]) => [
          key,
          value === undefined ? null : value,
        ]),
      ),
    });
    const { item } = z
      .object({ item: itemSchema })
      .parse(await response.json());
    this.generation++;
    this.publish({
      items: this.snapshot.items.map((existing) =>
        existing.id === id ? item : existing,
      ),
      ready: true,
    });
    return item;
  }
  async delete(id: string, expectedUpdatedAt?: string) {
    this.assertReady();
    const response = await this.request(`/${id}`, "DELETE", {
      expectedUpdatedAt: expectedUpdatedAt ?? this.get(id).updatedAt,
    });
    const { item } = z
      .object({ item: itemSchema })
      .parse(await response.json());
    this.generation++;
    this.publish({
      items: this.snapshot.items.map((existing) =>
        existing.id === id ? item : existing,
      ),
      ready: true,
    });
  }
  async restore(id: string, expectedUpdatedAt?: string) {
    this.assertReady();
    const response = await this.request(`/${id}/restore`, "POST", {
      expectedUpdatedAt: expectedUpdatedAt ?? this.get(id).updatedAt,
    });
    const { item } = z
      .object({ item: itemSchema })
      .parse(await response.json());
    this.generation++;
    this.publish({
      items: this.snapshot.items.map((existing) =>
        existing.id === id ? item : existing,
      ),
      ready: true,
    });
    return item;
  }
  async permanentlyDelete(id: string, expectedUpdatedAt?: string) {
    this.assertReady();
    await this.request(`/${id}/permanent`, "DELETE", {
      expectedUpdatedAt: expectedUpdatedAt ?? this.get(id).updatedAt,
    });
    this.generation++;
    this.publish({
      items: this.snapshot.items.filter((item) => item.id !== id),
      ready: true,
    });
  }
  async export() {
    return (await this.request("/export")).text();
  }
  async bulkUpdate(
    selected: { id: string; expectedUpdatedAt: string }[],
    status: Item["status"],
  ) {
    this.assertReady();
    await this.request("/bulk", "POST", { selected, status });
    await this.load();
  }
  async import(raw: string) {
    this.assertReady();
    parseLibrary(raw);
    const response = await this.request("/import", "POST", JSON.parse(raw));
    const result = importedSchema.parse(await response.json());
    await this.load();
    return result;
  }
}
