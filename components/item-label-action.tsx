"use client";

import { useRef, useState } from "react";
import { Tag } from "lucide-react";
import { Item, normalizeTags } from "@/lib/items/model";
import { itemLabels } from "@/lib/items/labels";
import { errorMessage, useLibrary } from "./library-provider";
import { LabelPicker } from "./label-picker";
import { useActionFeedback } from "./tooltip";
import { displayTitle } from "@/lib/items/link-title";

export function ItemLabelAction({ item }: { item: Item }) {
  const { repository, items } = useLibrary();
  const announce = useActionFeedback();
  const details = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(item.tags.join(", "));
  const [version, setVersion] = useState(item.updatedAt);
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const [failure, setFailure] = useState("");
  function close() {
    if (details.current) {
      details.current.open = false;
      details.current.querySelector("summary")?.focus();
    } else {
      requestAnimationFrame(() => {
        if (document.activeElement === document.body)
          document.querySelector<HTMLElement>("#main")?.focus();
      });
    }
  }
  return (
    <details
      ref={details}
      className="item-label-action"
      onToggle={(event) => {
        setOpen(event.currentTarget.open);
        if (event.currentTarget.open) {
          setDraft(item.tags.join(", "));
          setVersion(item.updatedAt);
          setFailure("");
        }
      }}
    >
      <summary aria-label={`Label: ${displayTitle(item)}`}>
        <Tag size={16} aria-hidden="true" />
        Label
      </summary>
      {open && (
        <div
          className="label-panel"
          onKeyDown={(event) => {
            if (event.key === "Escape" && !busy) {
              event.stopPropagation();
              close();
            }
          }}
        >
          <LabelPicker
            value={draft}
            onChange={setDraft}
            options={itemLabels(items)}
            disabled={busy}
            expanded
          />
          {failure && (
            <p role="alert" className="error-text">
              {failure}
            </p>
          )}
          <div className="actions">
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                if (saving.current) return;
                saving.current = true;
                setBusy(true);
                try {
                  await repository.update(
                    item.id,
                    { tags: normalizeTags(draft.split(",")) },
                    version,
                  );
                  announce(`${displayTitle(item)}: labels saved.`);
                  close();
                } catch (error) {
                  setFailure(errorMessage(error));
                } finally {
                  saving.current = false;
                  setBusy(false);
                }
              }}
            >
              Save labels
            </button>
            <button type="button" disabled={busy} onClick={close}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </details>
  );
}
