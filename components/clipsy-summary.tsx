"use client";

import { useEffect, useState } from "react";
import {
  clipsySummarySchema,
  type ClipsySummary as Summary,
} from "@/lib/clipsy";
import { useLibrary } from "./library-provider";

export function ClipsySummary() {
  const { account } = useLibrary();
  const [data, setData] = useState<{ summary: Summary; url: string } | null>(
    null,
  );
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError(false);
      setData(null);
      try {
        const response = await fetch("/api/clipsy", {
          cache: "no-store",
          headers: { "x-workspace-id": account?.id ?? "" },
          signal: controller.signal,
        });
        if (!response.ok) throw new Error();
        const body = await response.json();
        if (body.connected)
          setData({
            summary: clipsySummarySchema.parse(body.summary),
            url: body.url,
          });
      } catch {
        if (!controller.signal.aborted) setError(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [account?.id, attempt]);
  if (!loading && !error && !data) return null;
  return (
    <section className="clipsy-summary" aria-label="Clipsy">
      <h2>Clipsy</h2>
      {loading ? (
        <p role="status">Loading Clipsy…</p>
      ) : error ? (
        <p role="status">
          Clipsy is unavailable. Your Shelfy items are unchanged.
        </p>
      ) : (
        data && (
          <>
            <p>
              {data.summary.videos} videos · {data.summary.toWatch} to watch ·{" "}
              {data.summary.watching} watching
            </p>
            <p>
              {data.summary.collections} collections ·{" "}
              {data.summary.subscriptions} subscriptions
            </p>
            <a href={data.url} target="_blank" rel="noreferrer">
              Open Clipsy
            </a>
          </>
        )
      )}
      {!loading && (
        <button type="button" onClick={() => setAttempt((value) => value + 1)}>
          {error ? "Retry Clipsy" : "Refresh Clipsy"}
        </button>
      )}
    </section>
  );
}
