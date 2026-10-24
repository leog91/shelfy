"use client";

import { useSyncExternalStore } from "react";
import { Capture } from "./capture";

const subscribe = (listener: () => void) => {
  window.addEventListener("hashchange", listener);
  return () => window.removeEventListener("hashchange", listener);
};
export function IncomingCapture({ initialText }: { initialText: string }) {
  const hash = useSyncExternalStore(
    subscribe,
    () => window.location.hash,
    () => "",
  );
  const text =
    new URLSearchParams(hash.slice(1)).get("text")?.slice(0, 20000) ??
    initialText;
  return <Capture key={text} initialText={text} />;
}
