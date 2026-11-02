"use client";

import { useState } from "react";
import { z } from "zod";
import { errorMessage, useLibrary } from "./library-provider";
import { suggestTags } from "@/lib/items/tag-suggestions";

const previewSchema = z.object({
  title: z.string().max(500).optional(),
  description: z.string().max(10000).optional(),
});
export function MetadataPreview({
  url,
  onChoose,
  onChooseTags,
  compact = false,
  selected,
}: {
  url: string;
  onChoose: (field: "title" | "description", value: string) => void;
  onChooseTags: (tags: string[]) => void;
  compact?: boolean;
  selected?: { title: string; description: string; tags: string[] };
}) {
  const { account } = useLibrary();
  const [preview, setPreview] = useState<z.infer<typeof previewSchema> | null>(
    null,
  );
  const [failure, setFailure] = useState("");
  const [busy, setBusy] = useState(false);
  const tags = preview ? suggestTags({ url, ...preview }) : [];
  return (
    <section
      className={`metadata-preview${compact ? " metadata-preview-compact" : ""}`}
    >
      <p className="muted">
        {compact
          ? "Fetches the public page from the server. Nothing changes until you save."
          : "Optional preview contacts this URL’s public website from the server. It never changes your item automatically."}
      </p>
      <button
        disabled={busy}
        type="button"
        onClick={async () => {
          setBusy(true);
          setFailure("");
          setPreview(null);
          try {
            const response = await fetch("/api/metadata", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-Workspace-Id": account?.id ?? "",
              },
              body: JSON.stringify({ url }),
            });
            if (!response.ok) {
              const failure = z
                .object({ error: z.string().max(1000) })
                .safeParse(await response.json().catch(() => null));
              throw new Error(
                failure.success
                  ? failure.data.error
                  : response.status === 429
                    ? "Preview limit reached. Try again in a minute."
                    : "Could not safely fetch this page. You can still edit/save manually.",
              );
            }
            setPreview(previewSchema.parse(await response.json()));
          } catch (e) {
            setFailure(errorMessage(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Fetching preview…" : "Fetch optional link details"}
      </button>
      {preview && (
        <div className="import-preview">
          {!compact && (
            <p>Suggestions only. Apply a field to your draft, then save.</p>
          )}
          {preview.title && (
            <>
              <p>{preview.title}</p>
              <button
                type="button"
                aria-pressed={
                  selected ? selected.title === preview.title : undefined
                }
                onClick={() => onChoose("title", preview.title!)}
              >
                {compact ? "Use title" : "Use suggested title in draft"}
              </button>
            </>
          )}
          {preview.description && (
            <>
              <p>{preview.description}</p>
              <button
                type="button"
                aria-pressed={
                  selected
                    ? selected.description === preview.description
                    : undefined
                }
                onClick={() => onChoose("description", preview.description!)}
              >
                {compact
                  ? "Use description"
                  : "Use suggested description in draft"}
              </button>
            </>
          )}
          {tags.length > 0 && (
            <>
              <p>Suggested labels: {tags.join(", ")}</p>
              {!compact && (
                <p className="muted">
                  Keyword-based suggestions, not AI. Review before saving.
                </p>
              )}
              <button
                type="button"
                aria-pressed={
                  selected
                    ? tags.every((tag) =>
                        selected.tags.some(
                          (existing) =>
                            existing.toLowerCase() === tag.toLowerCase(),
                        ),
                      )
                    : undefined
                }
                onClick={() => onChooseTags(tags)}
              >
                {compact ? "Add labels" : "Add suggested labels to draft"}
              </button>
            </>
          )}
          {!preview.title && !preview.description && tags.length === 0 && (
            <p>No useful details found. Your original item is unchanged.</p>
          )}
        </div>
      )}
      {failure && (
        <p className="error-text" role="alert">
          {failure}
        </p>
      )}
    </section>
  );
}
