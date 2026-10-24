import { z } from "zod";

export const types = ["link", "note", "video", "product"] as const;
export const intents = [
  "read",
  "watch",
  "buy",
  "reference",
  "task",
  "none",
] as const;
export const statuses = ["inbox", "later", "done", "archived"] as const;

export function safeUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

export const itemSchema = z
  .object({
    id: z.uuid(),
    type: z.enum(types),
    intent: z.enum(intents),
    status: z.enum(statuses),
    title: z.string().trim().min(1).max(500),
    url: z
      .string()
      .max(10000)
      .refine(safeUrl, "Use an HTTP(S) URL without credentials.")
      .optional(),
    content: z.string().max(200000).optional(),
    description: z.string().max(10000).optional(),
    tags: z
      .array(z.string().trim().min(1).max(80))
      .max(50)
      .transform(normalizeTags),
    source: z.string().max(200).optional(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    completedAt: z.iso.datetime().optional(),
    reminderAt: z.iso.datetime().optional(),
    deletedAt: z.iso.datetime().optional(),
  })
  .strict()
  .superRefine((item, ctx) => {
    if (item.type !== "note" && !item.url)
      ctx.addIssue({
        code: "custom",
        message: "Links, videos and products need a URL.",
        path: ["url"],
      });
    if (item.type === "note" && !item.content?.trim())
      ctx.addIssue({
        code: "custom",
        message: "Notes need some text.",
        path: ["content"],
      });
    if ((item.status === "done") !== Boolean(item.completedAt))
      ctx.addIssue({
        code: "custom",
        message: "Completion date must match done status.",
      });
  });
export type Item = z.infer<typeof itemSchema>;
export type ItemPatch = Partial<
  Omit<Item, "id" | "createdAt" | "updatedAt" | "completedAt" | "deletedAt">
>;

export const envelopeSchema = z
  .object({
    version: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    items: z.array(itemSchema),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (new Set(data.items.map((item) => item.id)).size !== data.items.length)
      ctx.addIssue({ code: "custom", message: "Duplicate item IDs in file." });
  });

export function normalizeTags(tags: string[]): string[] {
  return [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))];
}

export function createItem(text: string, intent?: Item["intent"]): Item {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Paste a link or write a note first.");
  const isUrl = !/\s/.test(trimmed) && safeUrl(trimmed);
  // Explicit URL-looking input must not become a clickable unsafe link or a misleading save.
  if (!isUrl && !/\s/.test(trimmed) && /^\S+:\/\//.test(trimmed))
    throw new Error(
      "Use an HTTP(S) URL without credentials, or write a plain note.",
    );
  const host = isUrl ? new URL(trimmed).hostname : "";
  const video = [
    "youtube.com",
    "www.youtube.com",
    "m.youtube.com",
    "youtu.be",
  ].includes(host);
  const now = new Date().toISOString();
  return itemSchema.parse({
    id: crypto.randomUUID(),
    type: isUrl ? (video ? "video" : "link") : "note",
    intent: intent ?? (isUrl ? (video ? "watch" : "read") : "none"),
    status: "inbox",
    title: isUrl
      ? host.replace(/^www\./, "")
      : trimmed.split(/\r?\n/)[0].slice(0, 500),
    ...(isUrl ? { url: trimmed } : { content: text }),
    tags: [],
    source: "web",
    createdAt: now,
    updatedAt: now,
  });
}

export function updateItem(item: Item, patch: ItemPatch): Item {
  const now = new Date().toISOString();
  const status = patch.status ?? item.status;
  return itemSchema.parse({
    ...item,
    ...patch,
    tags: normalizeTags(patch.tags ?? item.tags),
    updatedAt: now,
    completedAt: status === "done" ? (item.completedAt ?? now) : undefined,
  });
}

export const views = [
  "dashboard",
  "inbox",
  "all",
  "read",
  "watch",
  "shopping",
  "notes",
  "reminders",
  "archived",
  "deleted",
] as const;
export type View = (typeof views)[number];
export const viewNames: Record<View, string> = {
  dashboard: "Overview",
  inbox: "Inbox",
  all: "All items",
  read: "To read",
  watch: "To watch",
  shopping: "Shopping",
  notes: "Notes",
  reminders: "Reminders",
  archived: "Archived",
  deleted: "Deleted",
};
export function pending(item: Item) {
  return (
    !item.deletedAt && (item.status === "inbox" || item.status === "later")
  );
}
export function inView(item: Item, view: View): boolean {
  if (view === "deleted") return Boolean(item.deletedAt);
  if (item.deletedAt) return false;
  if (view === "archived") return item.status === "archived";
  if (view === "reminders") return pending(item) && Boolean(item.reminderAt);
  if (view === "inbox") return item.status === "inbox";
  if (view === "read" || view === "watch" || view === "shopping")
    return (
      pending(item) && item.intent === (view === "shopping" ? "buy" : view)
    );
  if (view === "notes")
    return item.type === "note" && item.status !== "archived";
  return true;
}
export type Filters = {
  query?: string;
  type?: string;
  intent?: string;
  status?: string;
  tag?: string;
  source?: string;
  sort?: string;
};
export function selectItems(
  items: Item[],
  view: View,
  filters: Filters = {},
): Item[] {
  const query = filters.query?.trim().toLocaleLowerCase();
  return items
    .filter((item) => inView(item, view))
    .filter(
      (item) =>
        filters.status === "any" ||
        (filters.status
          ? item.status === filters.status
          : view === "archived" ||
            view === "deleted" ||
            item.status !== "archived"),
    )
    .filter((item) => !filters.type || item.type === filters.type)
    .filter((item) => !filters.intent || item.intent === filters.intent)
    .filter((item) => !filters.tag || item.tags.includes(filters.tag))
    .filter((item) => !filters.source || item.source === filters.source)
    .filter(
      (item) =>
        !query ||
        [item.title, item.url, item.content, item.description, ...item.tags]
          .filter(Boolean)
          .join(" ")
          .toLocaleLowerCase()
          .includes(query),
    )
    .sort((a, b) =>
      filters.sort === "reminder"
        ? (a.reminderAt ?? "9999").localeCompare(b.reminderAt ?? "9999")
        : filters.sort === "title"
          ? a.title.localeCompare(b.title)
          : filters.sort === "oldest"
            ? a.createdAt.localeCompare(b.createdAt)
            : b.createdAt.localeCompare(a.createdAt),
    );
}
