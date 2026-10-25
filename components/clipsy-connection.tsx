"use client";

import { useEffect, useState } from "react";
import { useLibrary } from "./library-provider";

export function ClipsyConnection() {
  const { account } = useLibrary();
  const [status, setStatus] = useState<{
    connected: boolean;
    expired: boolean;
  } | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const messages: Record<string, string> = {
      connected: "Clipsy connected. Counts are available in Overview.",
      cancelled: "Connection cancelled. Nothing was linked.",
      failed: "Connection failed or expired. Try Connect Clipsy again.",
    };
    const controller = new AbortController();
    void fetch("/api/clipsy/status", {
      cache: "no-store",
      headers: { "x-workspace-id": account?.id ?? "" },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        return response.json();
      })
      .then((body) => {
        if (!controller.signal.aborted) {
          setStatus(body);
          setNotice(
            messages[
              new URLSearchParams(window.location.search).get("clipsy") ?? ""
            ] ?? "",
          );
        }
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError("Could not check your Clipsy connection.");
      });
    return () => controller.abort();
  }, [account?.id, attempt]);

  async function act(action: "start" | "disconnect") {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/clipsy/${action}`, {
        method: "POST",
        headers: { "x-workspace-id": account?.id ?? "" },
      });
      if (!response.ok) throw new Error();
      const body = await response.json();
      if (action === "start") window.location.assign(body.url);
      else {
        setStatus({ connected: false, expired: false });
        setNotice("Clipsy disconnected. Its videos were not changed.");
      }
    } catch {
      setError(
        action === "disconnect"
          ? "Could not revoke access. Your connection was kept so you can retry. You can also disconnect in Clipsy Settings."
          : "Could not start the connection. Try again later.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="account-panel" aria-label="Clipsy connection">
      <h2>Clipsy</h2>
      <p>
        Connect your own Clipsy account to see video, collection and
        subscription counts. No videos are copied or edited.
      </p>
      {status ? (
        <>
          <p>
            {status.connected
              ? status.expired
                ? "Access expired. Disconnect and connect again to renew it."
                : "Connected. You can disconnect here or in Clipsy Settings."
              : "Not connected."}
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void act(status.connected ? "disconnect" : "start")}
          >
            {busy
              ? "Please wait…"
              : status.connected
                ? "Disconnect Clipsy"
                : "Connect Clipsy"}
          </button>
        </>
      ) : (
        !error && <p role="status">Checking Clipsy connection…</p>
      )}
      {notice && <p role="status">{notice}</p>}
      {error && (
        <>
          <p role="alert">{error}</p>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setError("");
              setStatus(null);
              setAttempt((value) => value + 1);
            }}
          >
            Retry connection check
          </button>
        </>
      )}
    </section>
  );
}
