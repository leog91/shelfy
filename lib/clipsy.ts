import { z } from "zod";

const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const clipsySummarySchema = z
  .object({
    videos: count,
    toWatch: count,
    watching: count,
    collections: count,
    subscriptions: count,
  })
  .strict()
  .refine((value) => value.toWatch + value.watching === value.videos);
export type ClipsySummary = z.infer<typeof clipsySummarySchema>;
