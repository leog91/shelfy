import {
  createItem,
  envelopeSchema,
  Item,
  ItemPatch,
  updateItem,
} from "./model";

export const STORAGE_KEY = "personal-library.items";
export type StoragePort = Pick<Storage, "getItem" | "setItem">;
export type Snapshot = { items: Item[]; ready: boolean; error?: string };
export const initialSnapshot: Snapshot = { items: [], ready: false };

export function parseLibrary(raw: string): Item[] {
  const result = envelopeSchema.safeParse(JSON.parse(raw));
  if (!result.success)
    throw new Error(
      "Library format is invalid or from an unsupported version. Existing data has not been changed.",
    );
  return result.data.items;
}
export function serializeLibrary(items: Item[]): string {
  return JSON.stringify(envelopeSchema.parse({ version: 3, items }), null, 2);
}
export function mergeImport(
  existing: Item[],
  incoming: Item[],
): { items: Item[]; added: number; skipped: number } {
  const items = [...existing];
  const byId = new Map(existing.map((item) => [item.id, item]));
  let skipped = 0;
  for (const item of incoming) {
    const collision = byId.get(item.id);
    if (collision && JSON.stringify(collision) === JSON.stringify(item)) {
      skipped++;
      continue;
    }
    const added = collision ? { ...item, id: crypto.randomUUID() } : item;
    items.push(added);
    byId.set(added.id, added);
  }
  return { items, added: items.length - existing.length, skipped };
}

export class ItemRepository {
  private snapshot: Snapshot = initialSnapshot;
  private listeners = new Set<() => void>();
  constructor(private storage: () => StoragePort) {}
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  getSnapshot = () => this.snapshot;
  private publish(snapshot: Snapshot) {
    this.snapshot = snapshot;
    this.listeners.forEach((listener) => listener());
  }
  load = () => {
    try {
      const raw = this.storage().getItem(STORAGE_KEY);
      this.publish({
        items: raw === null ? [] : parseLibrary(raw),
        ready: true,
      });
    } catch {
      this.publish({
        ...this.snapshot,
        ready: true,
        error:
          "Cannot read this browser library. It may be blocked, damaged, or a newer version. Saving is paused; download recovery data before repair.",
      });
    }
  };
  private current(): Item[] {
    if (!this.snapshot.ready || this.snapshot.error)
      throw new Error(
        "Library is unavailable. Retry loading before making changes.",
      );
    const raw = this.storage().getItem(STORAGE_KEY);
    return raw === null ? [] : parseLibrary(raw);
  }
  private commit(items: Item[]) {
    try {
      this.storage().setItem(STORAGE_KEY, serializeLibrary(items));
    } catch {
      throw new Error(
        "Could not save to browser storage. Check available space and browser permissions; your changes were not saved.",
      );
    }
    this.publish({ items, ready: true });
  }
  list() {
    return this.snapshot.items;
  }
  get(id: string) {
    return this.snapshot.items.find((item) => item.id === id);
  }
  create(text: string, intent?: Item["intent"]) {
    const items = this.current();
    const item = createItem(text, intent);
    this.commit([item, ...items]);
    return item;
  }
  update(id: string, patch: ItemPatch, expectedUpdatedAt?: string) {
    const items = this.current();
    const item = items.find((item) => item.id === id);
    if (!item)
      throw new Error("This item no longer exists. Reload the library.");
    if (expectedUpdatedAt && expectedUpdatedAt !== item.updatedAt)
      throw new Error(
        "This item changed in another tab. Refresh before saving again.",
      );
    const updated = updateItem(item, patch);
    this.commit(items.map((item) => (item.id === id ? updated : item)));
    return updated;
  }
  delete(id: string, expectedUpdatedAt?: string) {
    if (
      expectedUpdatedAt &&
      this.current().find((item) => item.id === id)?.updatedAt !==
        expectedUpdatedAt
    )
      throw new Error("This item changed. Refresh before deleting it.");
    this.commit(this.current().filter((item) => item.id !== id));
  }
  export() {
    return serializeLibrary(this.current());
  }
  bulkUpdate(
    selected: { id: string; expectedUpdatedAt: string }[],
    status: Item["status"],
  ) {
    const items = this.current();
    if (selected.length > 200)
      throw new Error("Select up to 200 items at once.");
    const tokens = new Map(
      selected.map((item) => [item.id, item.expectedUpdatedAt]),
    );
    for (const [id, token] of tokens)
      if (items.find((item) => item.id === id)?.updatedAt !== token)
        throw new Error(
          "A selected item changed. Refresh before trying again.",
        );
    this.commit(
      items.map((item) =>
        tokens.has(item.id) ? updateItem(item, { status }) : item,
      ),
    );
  }
  recovery() {
    return this.storage().getItem(STORAGE_KEY) ?? "";
  }
  import(raw: string) {
    const incoming = parseLibrary(raw);
    const result = mergeImport(this.current(), incoming);
    this.commit(result.items);
    return result;
  }
}
