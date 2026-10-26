import { Item, safeUrl } from "./model";

// Normalize URL syntax only; query strings and fragments may identify distinct content.
export function findDuplicate(items: Item[], text: string): Item | undefined {
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  const url =
    !/\s/.test(trimmed) && safeUrl(trimmed) ? new URL(trimmed).href : undefined;
  return items.find(
    (item) =>
      !item.deletedAt &&
      (url
        ? item.url !== undefined && new URL(item.url).href === url
        : item.type === "note" && item.content?.trim() === trimmed),
  );
}
