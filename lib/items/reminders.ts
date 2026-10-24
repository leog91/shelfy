export function toLocalDateTime(iso: string): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime()))
    throw new Error("Choose a valid revisit date/time.");
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
export function fromLocalDateTime(value: string): string | undefined {
  if (!value) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))
    throw new Error("Choose a valid revisit date/time.");
  const date = new Date(value);
  if (
    !Number.isFinite(date.getTime()) ||
    toLocalDateTime(date.toISOString()) !== value
  )
    throw new Error(
      "This local date/time does not exist (possibly a daylight-saving clock change). Choose another time.",
    );
  // During an ambiguous fall-back hour, JavaScript chooses the earlier occurrence.
  return date.toISOString();
}
