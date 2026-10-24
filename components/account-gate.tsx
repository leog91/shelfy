"use client";

import { AccountPanel } from "./account-panel";
import { useLibrary } from "./library-provider";

export function AccountGate({ children }: { children: React.ReactNode }) {
  const { account, sessionReady } = useLibrary();
  if (!sessionReady) return <p role="status">Checking account…</p>;
  return account ? children : <AccountPanel />;
}
