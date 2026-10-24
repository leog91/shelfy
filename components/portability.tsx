"use client";

import { useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import { parseBookmarks } from "@/lib/items/bookmarks";
import { parseLibrary, serializeLibrary } from "@/lib/items/repository";
import { downloadFile, errorMessage, useLibrary } from "./library-provider";

export function Portability() {
  const { repository, ready, error, items } = useLibrary();
  const [message, setMessage] = useState("");
  const [failure, setFailure] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{
    raw: string;
    count: number;
    duplicateUrls: number;
    skipped: number;
  } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  return (
    <section className="portability" aria-label="Data portability">
      <div className="actions">
        <button
          disabled={!ready || Boolean(error) || busy}
          onClick={async () => {
            setBusy(true);
            try {
              downloadFile(
                await repository.export(),
                `library-${new Date().toISOString().slice(0, 10)}.json`,
              );
              setFailure("");
            } catch (e) {
              setFailure(errorMessage(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          <Download size={16} aria-hidden="true" /> Export JSON
        </button>
        <button
          disabled={!ready || Boolean(error) || busy}
          onClick={() => fileInput.current?.click()}
        >
          <Upload size={16} aria-hidden="true" /> Import JSON / bookmarks
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json,text/html,.html,.htm"
          hidden
          aria-label="Import library or bookmark file"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            setFailure("");
            setMessage("");
            setPreview(null);
            setBusy(true);
            try {
              if (file.size > 10 * 1024 * 1024)
                throw new Error("Choose a file smaller than 10 MiB.");
              const raw = await file.text();
              const result =
                /\.html?$/i.test(file.name) || file.type === "text/html"
                  ? parseBookmarks(raw)
                  : { items: parseLibrary(raw), skipped: 0 };
              if (result.items.length > 5000)
                throw new Error("Import at most 5,000 items at once.");
              const urls = new Set(
                items.map((item) => item.url).filter(Boolean),
              );
              let duplicateUrls = 0;
              for (const item of result.items)
                if (item.url) {
                  if (urls.has(item.url)) duplicateUrls++;
                  urls.add(item.url);
                }
              setPreview({
                raw: serializeLibrary(result.items),
                count: result.items.length,
                duplicateUrls,
                skipped: result.skipped,
              });
            } catch (e) {
              setFailure(errorMessage(e));
            } finally {
              setBusy(false);
            }
          }}
        />
      </div>
      <p>JSON and browser bookmark HTML. Imports keep existing items.</p>
      {preview && (
        <div className="import-preview">
          <p>
            Review: {preview.count} valid items, {preview.duplicateUrls}{" "}
            possibly repeated URLs, {preview.skipped} unsafe/invalid bookmarks
            skipped. Same-ID identical content is skipped; conflicting content
            is retained separately. Same-URL items are kept.
          </p>
          <div className="actions">
            <button
              className="primary"
              disabled={busy || !preview.count}
              onClick={async () => {
                setBusy(true);
                setFailure("");
                try {
                  const result = await repository.import(preview.raw);
                  setMessage(
                    `Imported ${result.added} items; skipped ${result.skipped} identical items. Existing content retained.`,
                  );
                  setPreview(null);
                } catch (e) {
                  setFailure(errorMessage(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Confirm additive import
            </button>
            <button disabled={busy} onClick={() => setPreview(null)}>
              Cancel import
            </button>
          </div>
        </div>
      )}
      {message && <p role="status">{message}</p>}
      {failure && (
        <p className="error-text" role="alert">
          {failure}
        </p>
      )}
    </section>
  );
}
