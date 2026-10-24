"use client";

import { useId, useRef, useState } from "react";
import { intents, Item } from "@/lib/items/model";
import { errorMessage, useLibrary } from "./library-provider";
import Link from "next/link";

export function Capture({ initialText = "" }: { initialText?: string }) {
  const inputId = useId();
  const intentHelpId = useId();
  const { repository, ready, error, items } = useLibrary();
  const [text, setText] = useState(initialText);
  const [intent, setIntent] = useState("");
  const [message, setMessage] = useState("");
  const [failure, setFailure] = useState("");
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const duplicate =
    text.trim() &&
    items.find(
      (item) =>
        !item.deletedAt &&
        (item.url === text.trim() ||
          (item.type === "note" && item.content?.trim() === text.trim())),
    );
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
      );
      setText("");
      setIntent("");
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
          disabled={!ready}
          readOnly={saving}
          placeholder="Paste a URL or write a note"
          value={text}
          onChange={(e) => setText(e.target.value)}
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
            Automatic: links default to read, YouTube links to watch, and notes
            to none.
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
        <p className="muted">
          Possibly already saved:{" "}
          <Link href={`/items/${duplicate.id}`} className="duplicate-link">
            {duplicate.title}
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
