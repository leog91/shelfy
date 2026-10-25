"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, ArrowLeft } from "lucide-react";
import {
  intents,
  Item,
  normalizeTags,
  statuses,
  types,
} from "@/lib/items/model";
import { errorMessage, useLibrary } from "./library-provider";
import { MetadataPreview } from "./metadata-preview";
import { fromLocalDateTime, toLocalDateTime } from "@/lib/items/reminders";
import { displayTitle } from "@/lib/items/link-title";

export function ItemDetail({ id }: { id: string }) {
  const { items, ready, error } = useLibrary();
  if (!ready) return <p role="status">Loading item…</p>;
  if (error) return null;
  const item = items.find((item) => item.id === id);
  if (!item)
    return (
      <section className="empty-state">
        <h1>Item not found</h1>
        <p>It may belong to another account, or it was permanently deleted.</p>
        <Link href="/all">Back to library</Link>
      </section>
    );
  return <ItemEditor key={`${id}-${Boolean(item.deletedAt)}`} item={item} />;
}
function ItemEditor({ item }: { item: Item }) {
  const { repository, account } = useLibrary();
  const router = useRouter();
  const [failure, setFailure] = useState("");
  const [message, setMessage] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [baseUpdatedAt, setBaseUpdatedAt] = useState(item.updatedAt);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const editorRef = useRef<HTMLFormElement>(null);
  async function changeStatus(status: Item["status"]) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const updated = await repository.update(
        item.id,
        { status },
        baseUpdatedAt,
      );
      setBaseUpdatedAt(updated.updatedAt);
      setMessage(`Item marked ${status}.`);
      setFailure("");
    } catch (e) {
      setFailure(errorMessage(e));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      <Link
        className="back-link"
        href={
          item.deletedAt
            ? "/deleted"
            : item.status === "archived"
              ? "/archived"
              : "/all"
        }
      >
        <ArrowLeft size={16} aria-hidden="true" />{" "}
        {item.deletedAt ? "Back to Deleted" : "Back to library"}
      </Link>
      <header className="page-heading">
        <h1>{displayTitle(item)}</h1>
        {item.deletedAt && (
          <p>In Deleted. Restore this item before editing it.</p>
        )}
      </header>
      {item.url && (
        <a
          className="source-link"
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open original (new tab) <ExternalLink size={16} aria-hidden="true" />
          <span>{new URL(item.url).hostname}</span>
        </a>
      )}
      {item.deletedAt && (
        <button
          className="primary"
          disabled={busy}
          onClick={async () => {
            if (busyRef.current) return;
            busyRef.current = true;
            setBusy(true);
            try {
              await repository.restore(item.id, baseUpdatedAt);
            } catch (error) {
              setFailure(errorMessage(error));
            } finally {
              busyRef.current = false;
              setBusy(false);
            }
          }}
        >
          Restore item
        </button>
      )}
      <form
        ref={editorRef}
        className="editor"
        onSubmit={async (e) => {
          e.preventDefault();
          if (busyRef.current) return;
          busyRef.current = true;
          setBusy(true);
          const data = new FormData(e.currentTarget);
          const get = (name: string) => String(data.get(name) ?? "");
          try {
            const updated = await repository.update(
              item.id,
              {
                title: get("title"),
                url: get("url").trim() || undefined,
                content: get("content") || undefined,
                description: get("description") || undefined,
                type: get("type") as Item["type"],
                intent: get("intent") as Item["intent"],
                status: get("status") as Item["status"],
                tags: normalizeTags(get("tags").split(",")),
                reminderAt:
                  get("reminderAt") ===
                  (item.reminderAt ? toLocalDateTime(item.reminderAt) : "")
                    ? item.reminderAt
                    : fromLocalDateTime(get("reminderAt")),
              },
              baseUpdatedAt,
            );
            setBaseUpdatedAt(updated.updatedAt);
            setFailure("");
            setMessage("Changes saved.");
          } catch (error) {
            setFailure(errorMessage(error));
            setMessage("");
          } finally {
            busyRef.current = false;
            setBusy(false);
          }
        }}
      >
        <fieldset
          disabled={busy || Boolean(item.deletedAt)}
          className="editor-fields"
        >
          <label>
            Title
            <input
              name="title"
              defaultValue={item.title}
              required
              maxLength={500}
            />
          </label>
          <label>
            URL
            <input
              name="url"
              defaultValue={item.url ?? ""}
              type="url"
              placeholder="https://…"
              maxLength={10000}
            />
          </label>
          <div className="editor-dimensions">
            <label>
              Type
              <select name="type" defaultValue={item.type}>
                {types.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label>
              Intent
              <select name="intent" defaultValue={item.intent}>
                {intents.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label>
              Status
              <select
                key={item.status}
                name="status"
                defaultValue={item.status}
              >
                {statuses.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Content / note
            <textarea
              name="content"
              defaultValue={item.content ?? ""}
              rows={7}
              maxLength={200000}
            />
          </label>
          <label>
            Description / why I saved this
            <textarea
              name="description"
              defaultValue={item.description ?? ""}
              rows={3}
              maxLength={10000}
            />
          </label>
          <label>
            Tags <span className="muted">(comma separated)</span>
            <input
              name="tags"
              defaultValue={item.tags.join(", ")}
              placeholder="Development, AI, Projects"
            />
          </label>
          <label>
            Revisit date/time (your local time; optional)
            <input
              type="datetime-local"
              name="reminderAt"
              defaultValue={
                item.reminderAt ? toLocalDateTime(item.reminderAt) : ""
              }
            />
          </label>
          <p className="muted">
            Dates appear in Reminders while an item is active. No push, email,
            or background notifications are sent.
          </p>
          <div className="actions">
            <button className="primary" disabled={busy}>
              Save changes
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                changeStatus(item.status === "done" ? "later" : "done")
              }
            >
              {item.status === "done" ? "Reopen in Later" : "Mark done"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                changeStatus(item.status === "archived" ? "inbox" : "archived")
              }
            >
              {item.status === "archived" ? "Restore to Inbox" : "Archive"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                const input =
                  editorRef.current?.elements.namedItem("reminderAt");
                const tomorrow = new Date(Date.now() + 86400000);
                if (input instanceof HTMLInputElement)
                  input.value = toLocalDateTime(tomorrow.toISOString());
                setMessage(
                  "A date 24 hours from now applied to draft. Save changes to keep it.",
                );
              }}
            >
              Revisit in 24 hours (draft)
            </button>
          </div>
        </fieldset>
      </form>
      {account && item.url && !item.deletedAt && (
        <MetadataPreview
          key={item.url}
          url={item.url}
          onChoose={(field, value) => {
            const input = editorRef.current?.elements.namedItem(field);
            if (
              input instanceof HTMLInputElement ||
              input instanceof HTMLTextAreaElement
            ) {
              input.value = value;
              input.focus();
            }
            setMessage(
              "Suggestion applied to draft only. Save changes to keep it.",
            );
          }}
        />
      )}
      {message && (
        <p role="status" className="feedback">
          {message}
        </p>
      )}
      {failure && (
        <p role="alert" className="error-text">
          {failure}
        </p>
      )}
      <dl className="timestamps">
        <div>
          <dt>Saved</dt>
          <dd>{item.createdAt}</dd>
        </div>
        <div>
          <dt>Updated</dt>
          <dd>{item.updatedAt}</dd>
        </div>
        {item.completedAt && (
          <div>
            <dt>Completed</dt>
            <dd>{item.completedAt}</dd>
          </div>
        )}
        {item.deletedAt && (
          <div>
            <dt>Deleted</dt>
            <dd>{item.deletedAt}</dd>
          </div>
        )}
        <div>
          <dt>Source</dt>
          <dd>{item.source ?? "—"}</dd>
        </div>
      </dl>
      <section className="delete-area" aria-label="Delete item">
        {!confirmDelete ? (
          <button className="danger" onClick={() => setConfirmDelete(true)}>
            {item.deletedAt ? "Delete permanently…" : "Delete item…"}
          </button>
        ) : (
          <>
            <p>
              {item.deletedAt
                ? "Permanently delete this item? This cannot be undone."
                : "Move this item to Deleted? You can restore it later."}
            </p>
            <div className="actions">
              <button
                className="danger"
                disabled={busy}
                onClick={async () => {
                  if (busyRef.current) return;
                  busyRef.current = true;
                  setBusy(true);
                  try {
                    if (item.deletedAt)
                      await repository.permanentlyDelete(
                        item.id,
                        baseUpdatedAt,
                      );
                    else await repository.delete(item.id, baseUpdatedAt);
                    router.push(item.deletedAt ? "/deleted" : "/all");
                  } catch (e) {
                    setFailure(errorMessage(e));
                  } finally {
                    busyRef.current = false;
                    setBusy(false);
                  }
                }}
              >
                {item.deletedAt ? "Yes, delete permanently" : "Move to Deleted"}
              </button>
              <button autoFocus onClick={() => setConfirmDelete(false)}>
                Cancel
              </button>
            </div>
          </>
        )}
      </section>
    </>
  );
}
