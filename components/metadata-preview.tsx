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
}: {
  url: string;
  onChoose: (field: "title" | "description", value: string) => void;
  onChooseTags: (tags: string[]) => void;
}) {
  const { account } = useLibrary();
  const [preview, setPreview] = useState<z.infer<typeof previewSchema> | null>(
    null,
  );
  const [failure, setFailure] = useState("");
  const [busy, setBusy] = useState(false);
  const tags = preview ? suggestTags({ url, ...preview }) : [];
  return (
    <section className="metadata-preview">
      <p className="muted">
        Optional preview contacts this URL’s public website from the server. It
        never changes your item automatically.
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
            if (!response.ok)
              throw new Error(
                response.status === 429
                  ? "Preview limit reached. Try again in a minute."
                  : "Could not safely fetch this page. You can still edit/save manually.",
              );
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
          <p>Suggestions only. Apply a field to your draft, then save.</p>
          {preview.title && (
            <>
              <p>{preview.title}</p>
              <button
                type="button"
                onClick={() => onChoose("title", preview.title!)}
              >
                Use suggested title in draft
              </button>
            </>
          )}
          {preview.description && (
            <>
              <p>{preview.description}</p>
              <button
                type="button"
                onClick={() => onChoose("description", preview.description!)}
              >
                Use suggested description in draft
              </button>
            </>
          )}
          {tags.length > 0 && (
            <>
              <p>Suggested tags: {tags.join(", ")}</p>
              <p className="muted">
                Keyword-based suggestions, not AI. Review before saving.
              </p>
              <button type="button" onClick={() => onChooseTags(tags)}>
                Add suggested tags to draft
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
