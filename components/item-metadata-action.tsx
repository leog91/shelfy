"use client";

import { useRef, useState } from "react";
import { Item } from "@/lib/items/model";
import { mergeSuggestedTags } from "@/lib/items/tag-suggestions";
import { displayTitle } from "@/lib/items/link-title";
import { errorMessage, useLibrary } from "./library-provider";
import { MetadataPreview } from "./metadata-preview";
import { useActionFeedback } from "./tooltip";

export function ItemMetadataAction({ item }: { item: Item }) {
  const { repository } = useLibrary();
  const announce = useActionFeedback();
  const details = useRef<HTMLDetailsElement>(null);
  const saving = useRef(false);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(item.title);
  const [description, setDescription] = useState(item.description ?? "");
  const [tags, setTags] = useState(item.tags);
  const [version, setVersion] = useState(item.updatedAt);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");
  const changed = [
    title !== item.title,
    description !== (item.description ?? ""),
    tags.join("\n") !== item.tags.join("\n"),
  ].filter(Boolean).length;

  function close() {
    if (details.current) {
      details.current.open = false;
      details.current.querySelector("summary")?.focus();
    }
  }

  return (
    <details
      ref={details}
      className="item-metadata-action"
      onToggle={(event) => {
        setOpen(event.currentTarget.open);
        if (event.currentTarget.open) {
          setTitle(item.title);
          setDescription(item.description ?? "");
          setTags(item.tags);
          setVersion(item.updatedAt);
          setFailure("");
        }
      }}
    >
      <summary aria-label={`Get more info: ${displayTitle(item)}`}>
        Get more info
      </summary>
      {open && (
        <div
          onKeyDown={(event) => {
            if (event.key === "Escape" && !busy) {
              event.stopPropagation();
              close();
            }
          }}
        >
          <fieldset disabled={busy} className="metadata-suggestions">
            <MetadataPreview
              compact
              selected={{ title, description, tags }}
              url={item.url!}
              onChoose={(field, value) => {
                if (field === "title") setTitle(value);
                else setDescription(value);
              }}
              onChooseTags={(suggestions) =>
                setTags(mergeSuggestedTags(tags, suggestions))
              }
            />
            <form
              onSubmit={async (event) => {
                event.preventDefault();
                if (saving.current || !changed) return;
                saving.current = true;
                setBusy(true);
                setFailure("");
                try {
                  await repository.update(
                    item.id,
                    {
                      title,
                      description,
                      tags,
                    },
                    version,
                  );
                  announce(`${title}: details saved.`);
                  close();
                } catch (error) {
                  setFailure(errorMessage(error));
                } finally {
                  saving.current = false;
                  setBusy(false);
                }
              }}
            >
              {changed > 0 && (
                <p className="muted">
                  {changed} {changed === 1 ? "suggestion" : "suggestions"}{" "}
                  selected. Save to apply.
                </p>
              )}
              <div className="actions">
                {changed > 0 && (
                  <button className="primary" type="submit">
                    Save suggestions
                  </button>
                )}
                <button type="button" onClick={close}>
                  Cancel
                </button>
              </div>
            </form>
          </fieldset>
          {failure && (
            <p role="alert" className="error-text">
              {failure}
            </p>
          )}
        </div>
      )}
    </details>
  );
}
