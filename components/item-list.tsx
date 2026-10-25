"use client";

import Link from "next/link";
import { Check, ExternalLink, ArrowRight, Archive, Undo2 } from "lucide-react";
import { Item } from "@/lib/items/model";
import { errorMessage, useLibrary } from "./library-provider";
import { useState } from "react";
import { Tooltip, useActionFeedback } from "./tooltip";
import { detectLinkSite } from "@/lib/items/link-sites";
import { SiteIcon } from "./site-icon";

export function ItemList({
  items,
  bulk = false,
}: {
  items: Item[];
  bulk?: boolean;
}) {
  const { repository } = useLibrary();
  const announce = useActionFeedback();
  function restoreFocus(previous: Element | null) {
    requestAnimationFrame(() => {
      if (
        document.activeElement !== document.body &&
        document.activeElement !== previous
      )
        return;
      const row = previous?.closest(".item-row");
      const target =
        (row?.getClientRects().length
          ? row.querySelector<HTMLElement>(".item-title")
          : null) ??
        [...document.querySelectorAll<HTMLElement>(".item-title")].find(
          (element) => element.getClientRects().length > 0,
        ) ??
        document.querySelector<HTMLElement>("#main");
      target?.focus();
    });
  }
  const [failure, setFailure] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [selected, setSelected] = useState<Map<string, string>>(new Map());
  const selectedItems = items.filter((item) => selected.has(item.id));
  async function bulkStatus(status: Item["status"]) {
    const previous = document.activeElement;
    setBusy("bulk");
    setFailure("");
    try {
      await repository.bulkUpdate(
        selectedItems.map((item) => ({
          id: item.id,
          expectedUpdatedAt: selected.get(item.id)!,
        })),
        status,
      );
      setSelected(new Map());
      announce(`${selectedItems.length} items moved to ${status}.`);
      restoreFocus(previous);
    } catch (e) {
      setFailure(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }
  async function change(item: Item, status: Item["status"]) {
    const previous = document.activeElement;
    setBusy(item.id);
    try {
      await repository.update(item.id, { status }, item.updatedAt);
      setFailure("");
      announce(
        `${item.title}: ${status === "archived" ? "archived, kept in library" : status === "done" ? "marked as done" : "moved to Later"}.`,
      );
      restoreFocus(previous);
    } catch (e) {
      setFailure(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }
  async function restore(item: Item) {
    const previous = document.activeElement;
    setBusy(item.id);
    try {
      await repository.restore(item.id, item.updatedAt);
      announce(`${item.title}: restored.`);
      setFailure("");
      restoreFocus(previous);
    } catch (error) {
      setFailure(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }
  return (
    <>
      {bulk && (
        <div className="bulk-toolbar">
          <label className="checkbox-label">
            <input
              type="checkbox"
              aria-label="Select visible items (up to 200)"
              checked={
                items.length > 0 &&
                selectedItems.length >= Math.min(items.length, 200)
              }
              onChange={(e) =>
                setSelected(
                  e.target.checked
                    ? new Map(
                        items
                          .slice(0, 200)
                          .map((item) => [item.id, item.updatedAt] as const),
                      )
                    : new Map(),
                )
              }
            />{" "}
            Select all
          </label>
          {selectedItems.length > 0 && (
            <div className="actions">
              <span>{selectedItems.length} selected</span>
              {(["later", "done", "archived"] as const).map((status) => (
                <button
                  key={status}
                  disabled={Boolean(busy)}
                  onClick={() => bulkStatus(status)}
                >
                  Move selected to {status}
                </button>
              ))}
              <button onClick={() => setSelected(new Map())}>
                Clear selection
              </button>
            </div>
          )}
        </div>
      )}
      {failure && (
        <p role="alert" className="error-text">
          {failure}
        </p>
      )}
      <ul className="item-list">
        {items.map((item) => {
          const site = detectLinkSite(item.url);
          return (
            <li key={item.id} className="item-row">
              {bulk && (
                <label
                  className="item-checkbox"
                  aria-label={`Select: ${item.title}`}
                >
                  <input
                    type="checkbox"
                    aria-label={`Select: ${item.title}`}
                    checked={selected.has(item.id)}
                    disabled={Boolean(busy)}
                    onChange={(e) => {
                      if (e.target.checked && selected.size >= 200) {
                        setFailure("Select up to 200 items at once.");
                        return;
                      }
                      setSelected((current) => {
                        const next = new Map(current);
                        if (e.target.checked) next.set(item.id, item.updatedAt);
                        else next.delete(item.id);
                        return next;
                      });
                    }}
                  />
                </label>
              )}
              <div className={`type-mark type-${item.type}`} aria-hidden="true">
                {site ? (
                  <SiteIcon site={site} />
                ) : (
                  { link: "↗", note: "≡", video: "▷", product: "◇" }[item.type]
                )}
              </div>
              <div className="item-info">
                <Link className="item-title" href={`/items/${item.id}`}>
                  {item.title}
                </Link>
                <div className="item-meta">
                  <span>
                    {site && `${site.label} · `}
                    {item.url
                      ? new URL(item.url).hostname.replace(/^www\./, "")
                      : "Plain note"}
                  </span>
                  <span>
                    {item.type} · {item.intent}
                  </span>
                  <time dateTime={item.createdAt}>
                    {item.createdAt.slice(0, 10)}
                  </time>
                  <span>{item.source}</span>
                  {item.reminderAt && (
                    <time dateTime={item.reminderAt}>
                      Revisit {item.reminderAt.replace("T", " ").slice(0, 16)}{" "}
                      UTC
                    </time>
                  )}
                </div>
                {item.tags.length > 0 && (
                  <div className="tags">
                    {item.tags.map((tag) => (
                      <span key={tag}>#{tag}</span>
                    ))}
                  </div>
                )}
              </div>
              <span className={`status status-${item.status}`}>
                {item.deletedAt ? "deleted" : item.status}
              </span>
              <div className="row-actions">
                {item.url && (
                  <Tooltip label="Open original (new tab)">
                    <a
                      className="icon-button"
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Open original: ${item.title} (new tab)`}
                    >
                      <ExternalLink size={17} aria-hidden="true" />
                      <span className="touch-action-label" aria-hidden="true">
                        Open
                      </span>
                    </a>
                  </Tooltip>
                )}
                {item.deletedAt && (
                  <Tooltip label="Restore item">
                    <button
                      className="icon-button"
                      disabled={busy === item.id}
                      onClick={() => restore(item)}
                      aria-label={`Restore: ${item.title}`}
                    >
                      <Undo2 size={17} aria-hidden="true" />
                      <span className="touch-action-label" aria-hidden="true">
                        Restore
                      </span>
                    </button>
                  </Tooltip>
                )}
                {!item.deletedAt && item.status === "inbox" && (
                  <Tooltip label="Move to Later">
                    <button
                      className="icon-button"
                      disabled={busy === item.id}
                      onClick={() => change(item, "later")}
                      aria-label={`Move to later: ${item.title}`}
                    >
                      <ArrowRight size={17} aria-hidden="true" />
                      <span className="touch-action-label" aria-hidden="true">
                        Later
                      </span>
                    </button>
                  </Tooltip>
                )}
                {!item.deletedAt && item.status !== "done" && (
                  <Tooltip label="Mark as done">
                    <button
                      className="icon-button"
                      disabled={busy === item.id}
                      onClick={() => change(item, "done")}
                      aria-label={`Mark done: ${item.title}`}
                    >
                      <Check size={17} aria-hidden="true" />
                      <span className="touch-action-label" aria-hidden="true">
                        Done
                      </span>
                    </button>
                  </Tooltip>
                )}
                {!item.deletedAt && item.status !== "archived" && (
                  <Tooltip label="Archive (keep in library)">
                    <button
                      className="icon-button"
                      disabled={busy === item.id}
                      onClick={() => change(item, "archived")}
                      aria-label={`Archive: ${item.title}`}
                    >
                      <Archive size={17} aria-hidden="true" />
                      <span className="touch-action-label" aria-hidden="true">
                        Archive
                      </span>
                    </button>
                  </Tooltip>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
