"use client";

import { useState } from "react";
import { normalizeTags } from "@/lib/items/model";
import { changeLabels } from "@/lib/items/labels";

export function LabelPicker({
  value,
  onChange,
  options,
  disabled = false,
  expanded = false,
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  disabled?: boolean;
  expanded?: boolean;
}) {
  const [query, setQuery] = useState("");
  const selected = normalizeTags(value.split(","));
  const selectedKeys = new Set(selected.map((label) => label.toLowerCase()));
  const labels = [
    ...new Map(
      [...options, ...selected].map((label) => [label.toLowerCase(), label]),
    ).values(),
  ].sort((a, b) => a.localeCompare(b));
  const matches = labels.filter((label) =>
    label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  );
  const candidate = query.trim();
  const canCreate =
    candidate.length > 0 &&
    candidate.length <= 80 &&
    !candidate.includes(",") &&
    !labels.some(
      (label) => label.toLocaleLowerCase() === candidate.toLocaleLowerCase(),
    );
  function add(label: string) {
    onChange(changeLabels(selected, [label], "add").join(", "));
  }
  return (
    <div className="label-picker">
      <label>
        Labels <span className="muted">(comma separated)</span>
        <input
          name="tags"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
        />
      </label>
      <details open={expanded || undefined}>
        <summary>Choose labels</summary>
        <fieldset disabled={disabled}>
          <label>
            Find or create label
            <input
              value={query}
              maxLength={80}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  if (canCreate && selected.length < 50) {
                    add(candidate);
                    setQuery("");
                  }
                }
              }}
            />
          </label>
          <div className="label-options">
            {matches.map((label) => (
              <label key={label} className="checkbox-label">
                <input
                  type="checkbox"
                  checked={selectedKeys.has(label.toLowerCase())}
                  disabled={
                    !selectedKeys.has(label.toLowerCase()) &&
                    selected.length >= 50
                  }
                  onChange={(event) => {
                    if (event.target.checked) add(label);
                    else
                      onChange(
                        changeLabels(selected, [label], "remove").join(", "),
                      );
                  }}
                />
                {label}
              </label>
            ))}
          </div>
          {canCreate && (
            <button
              type="button"
              disabled={selected.length >= 50}
              onClick={() => {
                add(candidate);
                setQuery("");
              }}
            >
              Create label “{candidate}”
            </button>
          )}
          {!matches.length && !canCreate && (
            <p className="muted">
              {candidate
                ? "No matching labels."
                : "Find or create a label above."}
            </p>
          )}
          <p className="muted">
            Up to 50 labels. Changes apply only when you save.
          </p>
        </fieldset>
      </details>
    </div>
  );
}
