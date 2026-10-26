"use client";

import { useRef, useState } from "react";
import { Item, normalizeTags } from "@/lib/items/model";
import { mergeSuggestedTags } from "@/lib/items/tag-suggestions";
import { itemLabels } from "@/lib/items/labels";
import { displayTitle } from "@/lib/items/link-title";
import { errorMessage, useLibrary } from "./library-provider";
import { MetadataPreview } from "./metadata-preview";
import { LabelPicker } from "./label-picker";
import { useActionFeedback } from "./tooltip";

export function ItemMetadataAction({ item }: { item: Item }) {
  const { repository, items } = useLibrary();
  const announce = useActionFeedback();
  const details = useRef<HTMLDetailsElement>(null);
  const saving = useRef(false);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(item.title);
  const [description, setDescription] = useState(item.description ?? "");
  const [tags, setTags] = useState(item.tags.join(", "));
  const [version, setVersion] = useState(item.updatedAt);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");

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
          setTags(item.tags.join(", "));
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
          <fieldset disabled={busy} className="editor-fields">
            <MetadataPreview
              url={item.url!}
              onChoose={(field, value) => {
                if (field === "title") setTitle(value);
                else setDescription(value);
              }}
              onChooseTags={(suggestions) =>
                setTags(
                  mergeSuggestedTags(
                    normalizeTags(tags.split(",")),
                    suggestions,
                  ).join(", "),
                )
              }
            />
            <form
              className="editor"
              onSubmit={async (event) => {
                event.preventDefault();
                if (saving.current) return;
                saving.current = true;
                setBusy(true);
                setFailure("");
                try {
                  await repository.update(
                    item.id,
                    {
                      title,
                      description,
                      tags: normalizeTags(tags.split(",")),
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
              <label>
                Title
                <input
                  required
                  maxLength={500}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>
              <label>
                Description / why I saved this
                <textarea
                  rows={3}
                  maxLength={10000}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </label>
              <LabelPicker
                value={tags}
                onChange={setTags}
                options={itemLabels(items)}
                disabled={busy}
              />
              <div className="actions">
                <button className="primary" type="submit">
                  Save changes
                </button>
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
