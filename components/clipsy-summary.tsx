"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { useLibrary } from "./library-provider";

function CachedTime({ fetchedAt }: { fetchedAt: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const update = () => setNow(Date.now());
    const timer = window.setInterval(update, 60_000);
    window.addEventListener("focus", update);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", update);
    };
  }, []);
  const minutes = Math.max(0, Math.floor((now - fetchedAt) / 60_000));
  return (
    <time
      dateTime={new Date(fetchedAt).toISOString()}
      title={new Date(fetchedAt).toLocaleString()}
    >
      {minutes === 0
        ? "just now"
        : `${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`}
    </time>
  );
}

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
              <CachedTime key={data.fetchedAt} fetchedAt={data.fetchedAt} /> ·
              cached for up to 6 hours
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
