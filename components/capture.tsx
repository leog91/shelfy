"use client";

import { useId, useRef, useState } from "react";
import { intents, Item, safeUrl, normalizeTags } from "@/lib/items/model";
import { mergeSuggestedTags } from "@/lib/items/tag-suggestions";
import { linkTitle, displayTitle } from "@/lib/items/link-title";
import { MetadataPreview } from "./metadata-preview";
import { errorMessage, useLibrary } from "./library-provider";
import Link from "next/link";
import { LabelPicker } from "./label-picker";
import { itemLabels } from "@/lib/items/labels";
import { findDuplicate } from "@/lib/items/duplicates";

export function Capture({ initialText = "" }: { initialText?: string }) {
  const inputId = useId();
  const intentHelpId = useId();
  const duplicateHelpId = useId();
  const { repository, ready, error, items } = useLibrary();
  const [text, setText] = useState(initialText);
  const [intent, setIntent] = useState("");
  const [message, setMessage] = useState("");
  const [failure, setFailure] = useState("");
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const [details, setDetails] = useState<{
    url: string;
    title?: string;
    description?: string;
    tags?: string;
  } | null>(null);
  const url =
    !/\s/.test(text.trim()) && safeUrl(text.trim()) ? text.trim() : "";
  const duplicate = findDuplicate(items, text);
  async function save() {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setFailure("");
    setMessage("");
    try {
      const item = await repository.create(
        text,
        intent ? (intent as Item["intent"]) : undefined,
        details?.url === url
          ? {
              title: details.title,
              description: details.description,
              tags: normalizeTags((details.tags ?? "").split(",")),
            }
          : undefined,
      );
      setText("");
      setIntent("");
      setDetails(null);
      setMessage(`Saved “${item.title}” to Inbox.`);
      input.current?.focus();
    } catch (e) {
      setFailure(errorMessage(e));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }
  return (
    <section className="capture" aria-label="Quick capture">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <label className="sr-only" htmlFor={inputId}>
          URL or note
        </label>
        <textarea
          id={inputId}
          ref={input}
          aria-describedby={duplicate ? duplicateHelpId : undefined}
          disabled={!ready}
          readOnly={saving}
          placeholder="Paste a URL or write a note"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setDetails(null);
          }}
          rows={2}
          required
          maxLength={200000}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              if (ready && !error) save();
            }
            if (e.key === "Escape") e.currentTarget.blur();
          }}
        />
        {text.trim() && (
          <details key={url} className="capture-details">
            <summary>
              {url
                ? `Link details · ${details?.title || linkTitle(url)}`
                : "Note details & labels"}
            </summary>
            <fieldset disabled={saving}>
              {url && (
                <>
                  <label>
                    Title
                    <input
                      value={details?.title ?? (url ? linkTitle(url) : "")}
                      maxLength={500}
                      onChange={(e) =>
                        setDetails((current) => ({
                          ...current,
                          url,
                          title: e.target.value,
                        }))
                      }
                    />
                  </label>
                  <label>
                    Description
                    <textarea
                      value={details?.description ?? ""}
                      maxLength={10000}
                      onChange={(e) =>
                        setDetails((current) => ({
                          ...current,
                          url,
                          description: e.target.value,
                        }))
                      }
                    />
                  </label>
                </>
              )}
              <LabelPicker
                value={details?.tags ?? ""}
                options={itemLabels(items)}
                disabled={saving}
                onChange={(tags) =>
                  setDetails((current) => ({ ...current, url, tags }))
                }
              />
              {url && (
                <MetadataPreview
                  key={url}
                  url={url}
                  onChoose={(field, value) =>
                    setDetails((current) => ({
                      ...current,
                      url,
                      [field]: value,
                    }))
                  }
                  onChooseTags={(tags) =>
                    setDetails((current) => ({
                      ...current,
                      url,
                      tags: mergeSuggestedTags(
                        normalizeTags((current?.tags ?? "").split(",")),
                        tags,
                      ).join(", "),
                    }))
                  }
                />
              )}
            </fieldset>
          </details>
        )}
        <div className="capture-bottom">
          <label>
            Intent{" "}
            <select
              value={intent}
              disabled={saving}
              aria-describedby={intentHelpId}
              onChange={(e) => setIntent(e.target.value)}
            >
              <option value="">Automatic</option>
              {intents.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <span id={intentHelpId} className="sr-only">
            Automatic: recognized shops default to buy (Shopping), YouTube links
            to watch, other links to read, and notes to none. Choosing an intent
            overrides detection.
          </span>
          <span className="shortcut">⌘ / Ctrl + Enter to save</span>
          <button
            className="primary"
            disabled={!ready || Boolean(error) || saving}
          >
            Save to Inbox
          </button>
        </div>
      </form>
      {duplicate && (
        <p className="duplicate-warning" id={duplicateHelpId} role="status">
          Possibly already saved:{" "}
          <Link href={`/items/${duplicate.id}`} className="duplicate-link">
            {displayTitle(duplicate)}
          </Link>
          . Saving again keeps a separate copy.
        </p>
      )}
      {message && (
        <p className="feedback" role="status">
          {message}
        </p>
      )}
      {failure && (
        <p className="error-text" role="alert">
          {failure}
        </p>
      )}
    </section>
  );
}
