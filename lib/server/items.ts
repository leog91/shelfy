import { and, desc, eq } from "drizzle-orm";
import type { Database } from "../db/connection";
import { items } from "../db/schema";
import {
  createItem,
  Item,
  itemSchema,
  ItemPatch,
  updateItem,
} from "../items/model";
import { mergeImport } from "../items/repository";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
function fromRow(row: typeof items.$inferSelect): Item {
  const { userId: _owner, ...item } = row;
  void _owner;
  return itemSchema.parse(
    Object.fromEntries(
      Object.entries(item).filter(([, value]) => value !== null),
    ),
  );
}
function toRow(owner: string, item: Item): typeof items.$inferInsert {
  return {
    ...item,
    userId: owner,
    url: item.url ?? null,
    content: item.content ?? null,
    description: item.description ?? null,
    source: item.source ?? null,
    completedAt: item.completedAt ?? null,
    reminderAt: item.reminderAt ?? null,
    deletedAt: item.deletedAt ?? null,
  };
}
export class ServerItems {
  constructor(
    private db: Database,
    private owner: string,
  ) {
    if (!owner)
      throw new HttpError(401, "Sign in to access your account library.");
  }
  async list() {
    return (
      await this.db
        .select()
        .from(items)
        .where(eq(items.userId, this.owner))
        .orderBy(desc(items.createdAt))
    ).map(fromRow);
  }
  async get(id: string) {
    const [row] = await this.db
      .select()
      .from(items)
      .where(and(eq(items.userId, this.owner), eq(items.id, id)));
    if (!row) throw new HttpError(404, "Item not found.");
    return fromRow(row);
  }
  async create(
    text: string,
    intent?: Item["intent"],
    details?: Pick<ItemPatch, "title" | "description">,
  ) {
    let item: Item;
    try {
      item = createItem(text, intent);
      if (details) {
        if (!item.url) throw new Error("Link details require a URL.");
        item = itemSchema.parse({ ...item, ...details });
      }
    } catch {
      throw new HttpError(
        400,
        "Enter a valid HTTP(S) link or a non-empty note.",
      );
    }
    await this.db.insert(items).values(toRow(this.owner, item));
    return item;
  }
  async update(id: string, patch: ItemPatch, expectedUpdatedAt: string) {
    const existing = await this.get(id);
    if (existing.deletedAt)
      throw new HttpError(
        409,
        "Restore this item from Deleted before editing it.",
      );
    return this.save(existing, updateItem(existing, patch), expectedUpdatedAt);
  }
  private async save(existing: Item, updated: Item, expectedUpdatedAt: string) {
    if (existing.updatedAt !== expectedUpdatedAt)
      throw new HttpError(
        409,
        "This item changed on another device. Refresh the library before editing again; your draft has not been saved.",
      );
    // Strictly increasing timestamp doubles as an optimistic-concurrency token.
    updated.updatedAt = new Date(
      Math.max(Date.now(), Date.parse(existing.updatedAt) + 1),
    ).toISOString();
    const changed = await this.db
      .update(items)
      .set(toRow(this.owner, updated))
      .where(
        and(
          eq(items.userId, this.owner),
          eq(items.id, existing.id),
          eq(items.updatedAt, expectedUpdatedAt),
        ),
      )
      .returning({ id: items.id });
    if (!changed.length)
      throw new HttpError(
        409,
        "This item changed. Refresh before saving again.",
      );
    return updated;
  }
  async delete(id: string, expectedUpdatedAt: string) {
    const existing = await this.get(id);
    if (existing.deletedAt)
      throw new HttpError(409, "This item is already in Deleted.");
    return this.save(
      existing,
      { ...existing, deletedAt: new Date().toISOString() },
      expectedUpdatedAt,
    );
  }
  async restore(id: string, expectedUpdatedAt: string) {
    const existing = await this.get(id);
    if (!existing.deletedAt)
      throw new HttpError(409, "This item is not in Deleted.");
    const { deletedAt: _deleted, ...restored } = existing;
    void _deleted;
    return this.save(existing, restored, expectedUpdatedAt);
  }
  async permanentlyDelete(id: string, expectedUpdatedAt: string) {
    const existing = await this.get(id);
    if (!existing.deletedAt)
      throw new HttpError(
        409,
        "Move this item to Deleted before permanently deleting it.",
      );
    const deleted = await this.db
      .delete(items)
      .where(
        and(
          eq(items.userId, this.owner),
          eq(items.id, id),
          eq(items.updatedAt, expectedUpdatedAt),
        ),
      )
      .returning({ id: items.id });
    if (!deleted.length)
      throw new HttpError(
        409,
        "This item changed. Refresh before deleting it.",
      );
  }
  async import(incoming: Item[]) {
    // A write transaction serializes imports; no partial import or destructive replacement.
    return this.db.transaction(async (tx) => {
      const existing = (
        await tx.select().from(items).where(eq(items.userId, this.owner))
      ).map(fromRow);
      const result = mergeImport(existing, incoming);
      for (const item of result.items.slice(existing.length))
        await tx.insert(items).values(toRow(this.owner, item));
      return { added: result.added, skipped: result.skipped };
    });
  }
  async bulkUpdate(
    selected: { id: string; expectedUpdatedAt: string }[],
    status: Item["status"],
  ) {
    await this.db.transaction(async (tx) => {
      for (const token of selected) {
        const [row] = await tx
          .select()
          .from(items)
          .where(and(eq(items.userId, this.owner), eq(items.id, token.id)));
        if (!row) throw new HttpError(404, "A selected item was not found.");
        if (row.deletedAt)
          throw new HttpError(
            409,
            "Restore deleted items before applying bulk actions.",
          );
        if (row.updatedAt !== token.expectedUpdatedAt)
          throw new HttpError(
            409,
            "A selected item changed. Refresh before applying bulk actions.",
          );
        const item = updateItem(fromRow(row), { status });
        item.updatedAt = new Date(
          Math.max(Date.now(), Date.parse(row.updatedAt) + 1),
        ).toISOString();
        await tx
          .update(items)
          .set(toRow(this.owner, item))
          .where(and(eq(items.userId, this.owner), eq(items.id, item.id)));
      }
    });
  }
}
