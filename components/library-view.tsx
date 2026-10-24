"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Filters,
  pending,
  selectItems,
  View,
  viewNames,
} from "@/lib/items/model";
import { useLibrary } from "./library-provider";
import { Capture } from "./capture";
import { ItemList } from "./item-list";
import { Portability } from "./portability";
import { LibraryFilters } from "./library-filters";

const emptyTitles: Record<View, string> = {
  dashboard: "No recent items.",
  inbox: "Inbox is empty.",
  all: "No items in this view.",
  read: "No items to read.",
  watch: "No items to watch.",
  shopping: "No shopping items.",
  notes: "No notes.",
  reminders: "No reminders.",
  archived: "No archived items.",
  deleted: "No deleted items.",
};

export function LibraryView({ view }: { view: View }) {
  const { items, ready, error } = useLibrary();
  const [filters, setFilters] = useState<Filters>({});
  const defaultSort = view === "reminders" ? "reminder" : "newest";
  const selected = selectItems(items, view, {
    ...filters,
    sort: filters.sort ?? defaultSort,
  });
  const set = (key: keyof Filters, value: string) =>
    setFilters((current) => ({ ...current, [key]: value }));
  const hasFilters = Boolean(
    filters.query?.trim() ||
    filters.type ||
    filters.intent ||
    filters.status ||
    filters.tag ||
    filters.source,
  );
  const tags = [...new Set(items.flatMap((item) => item.tags))].sort();
  const sources = [
    ...new Set(
      items
        .map((item) => item.source)
        .filter((source): source is string => Boolean(source)),
    ),
  ].sort();
  const isDashboard = view === "dashboard";
  const recent = selectItems(items, "all").slice(0, 8);
  const upcoming = selectItems(items, "reminders", { sort: "reminder" }).slice(
    0,
    3,
  );
  const counts = [
    {
      href: "/inbox",
      label: "Inbox",
      value: items.filter((item) => !item.deletedAt && item.status === "inbox")
        .length,
    },
    {
      href: "/read",
      label: "To read",
      value: items.filter((item) => pending(item) && item.intent === "read")
        .length,
    },
    {
      href: "/watch",
      label: "To watch",
      value: items.filter((item) => pending(item) && item.intent === "watch")
        .length,
    },
    {
      href: "/shopping",
      label: "Shopping",
      value: items.filter((item) => pending(item) && item.intent === "buy")
        .length,
    },
    {
      href: "/notes",
      label: "Active notes",
      value: items.filter((item) => pending(item) && item.type === "note")
        .length,
    },
  ];
  return (
    <>
      <header className="page-heading">
        <h1>{viewNames[view]}</h1>
        {view === "reminders" && (
          <p>Revisit dates only. No notifications are sent.</p>
        )}
        {view === "deleted" && (
          <p>
            Restore items or permanently delete them. Nothing is emptied
            automatically.
          </p>
        )}
      </header>
      {view !== "deleted" && view !== "archived" && <Capture />}
      {!ready ? (
        <p role="status" className="loading">
          Loading items…
        </p>
      ) : error ? (
        <p className="muted">Resolve the library error above to continue.</p>
      ) : (
        <>
          {isDashboard ? (
            <>
              <section className="counts" aria-label="Pending items">
                {counts.map((count) => (
                  <Link key={count.href} href={count.href}>
                    <span>{count.label}</span>
                    <strong>{count.value}</strong>
                  </Link>
                ))}
              </section>
              {upcoming.length > 0 && (
                <section aria-label="Upcoming reminders">
                  <div className="section-heading">
                    <h2>Reminders</h2>
                    <Link href="/reminders">View all</Link>
                  </div>
                  <ul className="reminder-summary">
                    {upcoming.map((item) => (
                      <li key={item.id}>
                        <Link href={`/items/${item.id}`}>{item.title}</Link>
                        <time dateTime={item.reminderAt}>
                          {item.reminderAt?.replace("T", " ").slice(0, 16)} UTC
                        </time>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              <div className="section-heading">
                <h2>Recent items</h2>
                <Link href="/all">All items</Link>
              </div>
              {recent.length ? (
                <ItemList items={recent} />
              ) : (
                <EmptyState
                  view={view}
                  isEmpty={items.length === 0}
                  hasFilters={false}
                />
              )}
            </>
          ) : (
            <>
              <LibraryFilters
                filters={filters}
                tags={tags}
                sources={sources}
                count={selected.length}
                defaultSort={defaultSort}
                fixedStatus={view === "archived" || view === "deleted"}
                onChange={set}
                onClear={() => setFilters({})}
              />
              {selected.length ? (
                <ItemList items={selected} bulk={view !== "deleted"} />
              ) : (
                <EmptyState
                  view={view}
                  isEmpty={items.length === 0}
                  hasFilters={hasFilters}
                />
              )}
            </>
          )}
          {view === "watch" && (
            <details className="integration-note">
              <summary>Clipsy: not connected</summary>
              <p>Clipsy watch count is unavailable.</p>
              <a
                href="https://clipsy-web-sepia.vercel.app"
                target="_blank"
                rel="noopener noreferrer"
              >
                Open Clipsy ↗
              </a>
            </details>
          )}
          <Portability />
        </>
      )}
    </>
  );
}

function EmptyState({
  view,
  isEmpty,
  hasFilters,
}: {
  view: View;
  isEmpty: boolean;
  hasFilters: boolean;
}) {
  return (
    <div className="empty-state">
      <h3>
        {hasFilters
          ? "No matching items."
          : isEmpty && view !== "archived" && view !== "deleted"
            ? "No items yet."
            : emptyTitles[view]}
      </h3>
      {hasFilters ? (
        <p>Change or clear the filters.</p>
      ) : view === "archived" || view === "deleted" ? null : isEmpty ? (
        <p>Add a URL or note above.</p>
      ) : view === "all" || view === "dashboard" ? (
        <p>
          Archived items are available in <Link href="/archived">Archived</Link>
          .
        </p>
      ) : null}
    </div>
  );
}
