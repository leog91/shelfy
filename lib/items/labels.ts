import { Item } from "./model";

export type LabelOperation = "add" | "remove";

export function changeLabels(
  current: string[],
  labels: string[],
  operation: LabelOperation,
): string[] {
  if (operation === "add") {
    // Do not silently truncate a bulk operation: the item schema rejects overflow.
    const existing = new Set(current.map((label) => label.toLowerCase()));
    return [
      ...current,
      ...labels.filter((label) => {
        const key = label.toLowerCase();
        if (existing.has(key)) return false;
        existing.add(key);
        return true;
      }),
    ];
  }
  const removed = new Set(labels.map((label) => label.toLowerCase()));
  return current.filter((label) => !removed.has(label.toLowerCase()));
}

// Labels are existing tags: keep saved data and portable formats unchanged.
export function itemLabels(items: Item[]): string[] {
  return [
    ...new Set(
      items.filter((item) => !item.deletedAt).flatMap((item) => item.tags),
    ),
  ].sort((a, b) => a.localeCompare(b));
}

export function labelHref(label: string): string {
  return `/all?${new URLSearchParams({ label })}`;
}
