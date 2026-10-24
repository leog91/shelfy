"use client";

import { useEffect, useRef, useState } from "react";

export function CaptureTools() {
  const anchor = useRef<HTMLAnchorElement>(null);
  const [copied, setCopied] = useState(false);
  const [failure, setFailure] = useState("");
  useEffect(() => {
    // React rejects javascript: JSX href values. This intentionally generated, fixed
    // bookmarklet is not user-authored content and is never injected into saved items.
    const script = `javascript:(()=>{const u=location.href;if(!/^https?:/.test(u))return;const s=String(getSelection()).slice(0,4000);const t=s?s+'\\n\\nSource: '+u:u;window.open(${JSON.stringify(window.location.origin + "/capture#text=")}+encodeURIComponent(t),'_blank','noopener,noreferrer')})()`;
    anchor.current?.setAttribute("href", script);
  }, []);
  return (
    <section className="account-panel">
      <h2>Capture from your browser</h2>
      <p>
        Drag this link to your bookmarks bar. On any HTTP(S) page, use it to
        review the current URL—or selected text with a source URL—in Shelfy. You
        must press Save; pages cannot silently add items.
      </p>
      <a
        ref={anchor}
        className="bookmarklet"
        onClick={async (e) => {
          e.preventDefault();
          try {
            if (!anchor.current || !navigator.clipboard)
              throw new Error("Clipboard unavailable");
            await navigator.clipboard.writeText(anchor.current.href);
            setCopied(true);
            setFailure("");
          } catch {
            setFailure(
              "Clipboard unavailable. Drag the link to your bookmarks bar instead.",
            );
          }
        }}
      >
        Save to Shelfy
      </a>
      <p className="muted">
        Click to copy the bookmark URL instead. Some sites block bookmarklets;
        copy/paste is always available. Selection capture includes personal
        selected text in the capture URL fragment (not sent to the server)—avoid
        sharing that URL.
      </p>
      {copied && (
        <p role="status">Bookmark URL copied. Add it as a browser bookmark.</p>
      )}
      {failure && (
        <p role="alert" className="error-text">
          {failure}
        </p>
      )}
    </section>
  );
}
