"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { useLibrary } from "./library-provider";

export function ClipsySummary() {
  const { account, clipsyCache } = useLibrary();
  const pathname = usePathname();
  const data = useSyncExternalStore(
    clipsyCache.subscribe,
    () => clipsyCache.getSnapshot(account?.id ?? ""),
    () => null,
  );
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const handledAttempt = useRef(0);
  useEffect(() => {
    if (pathname !== "/") return;
    const controller = new AbortController();
    const force = attempt !== handledAttempt.current;
    handledAttempt.current = attempt;
    async function load() {
      setLoading(true);
      setError(false);
      try {
        if (account)
          await clipsyCache.load(account.id, {
            force,
          });
      } catch {
        if (!controller.signal.aborted) setError(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [account, attempt, clipsyCache, pathname]);
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
            <p className="muted">
              Updated{" "}
              <time dateTime={new Date(data.fetchedAt).toISOString()}>
                {new Date(data.fetchedAt).toLocaleString()}
              </time>{" "}
              · cached for up to 6 hours
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
