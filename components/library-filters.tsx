"use client";

import { Search } from "lucide-react";
import { Filters, intents, statuses, types } from "@/lib/items/model";

export function LibraryFilters({
  filters,
  tags,
  sources,
  count,
  defaultSort,
  onChange,
  onClear,
  fixedStatus,
}: {
  filters: Filters;
  tags: string[];
  sources: string[];
  count: number;
  defaultSort: string;
  onChange: (key: keyof Filters, value: string) => void;
  onClear: () => void;
  fixedStatus?: boolean;
}) {
  const filterCount = [
    filters.type,
    filters.intent,
    filters.status,
    filters.tag,
    filters.source,
  ].filter(Boolean).length;
  const hasFilters = Boolean(
    filterCount ||
    filters.query ||
    (filters.sort && filters.sort !== defaultSort),
  );
  return (
    <section className="filters" aria-label="Search and filters">
      <div className="library-toolbar">
        <label className="search-label">
          <Search size={17} aria-hidden="true" />
          <span className="sr-only">Search items</span>
          <input
            placeholder="Search items"
            value={filters.query ?? ""}
            onChange={(e) => onChange("query", e.target.value)}
          />
        </label>
        <span className="result-count">
          {count} {count === 1 ? "item" : "items"}
        </span>
      </div>
      <details className="filter-options">
        <summary>
          Filters &amp; sort{filterCount > 0 ? ` (${filterCount})` : ""}
        </summary>
        <div className="filter-controls">
          <Filter
            label="Type"
            value={filters.type}
            options={types}
            onChange={(value) => onChange("type", value)}
          />
          <Filter
            label="Intent"
            value={filters.intent}
            options={intents}
            onChange={(value) => onChange("intent", value)}
          />
          {!fixedStatus && (
            <label>
              Status
              <select
                value={filters.status ?? ""}
                onChange={(e) => onChange("status", e.target.value)}
              >
                <option value="">Exclude archived</option>
                <option value="any">Any status</option>
                {statuses.map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>
            </label>
          )}
          <Filter
            label="Tag"
            value={filters.tag}
            options={tags}
            onChange={(value) => onChange("tag", value)}
          />
          <Filter
            label="Source"
            value={filters.source}
            options={sources}
            onChange={(value) => onChange("source", value)}
          />
          <label>
            Sort
            <select
              value={filters.sort ?? defaultSort}
              onChange={(e) => onChange("sort", e.target.value)}
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="title">Title A–Z</option>
              <option value="reminder">Reminder date</option>
            </select>
          </label>
        </div>
      </details>
      {hasFilters && (
        <button className="clear-filters" onClick={onClear}>
          Clear filters
        </button>
      )}
    </section>
  );
}

function Filter({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value?: string;
  options: readonly string[];
  onChange: (value: string) => void;
}) {
  return (
    <label>
      {label}
      <select value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
        <option value="">All</option>
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}
