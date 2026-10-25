"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import { initialSnapshot } from "@/lib/items/repository";
import { RemoteItemRepository } from "@/lib/items/remote-repository";
import { authClient } from "@/lib/auth-client";
import { ClipsySummaryCache } from "@/lib/clipsy-cache";

type Repository = RemoteItemRepository;
type Account = { id: string; email: string; name: string };
const RepositoryContext = createContext<{
  repository: Repository;
  account: Account | null;
  sessionReady: boolean;
  sessionError: string;
  clipsyCache: ClipsySummaryCache;
} | null>(null);
export function LibraryProvider({ children }: { children: React.ReactNode }) {
  const [clipsyCache] = useState(() => new ClipsySummaryCache());
  const [state, setState] = useState<{
    repository: Repository;
    account: Account | null;
    sessionReady: boolean;
    sessionError: string;
  }>(() => ({
    repository: new RemoteItemRepository(""),
    account: null,
    sessionReady: false,
    sessionError: "",
  }));
  useEffect(() => {
    let active = true;
    void authClient
      .getSession()
      .then(async ({ data, error }) => {
        if (!active) return;
        if (error) {
          setState((current) => ({
            ...current,
            sessionReady: true,
            sessionError:
              "Could not check your account. Reload after checking server configuration and network; saving is paused to avoid using the wrong library.",
          }));
          return;
        }
        const repository = new RemoteItemRepository(data?.user.id ?? "");
        if (data) await repository.load();
        if (active)
          setState({
            repository,
            account: data?.user ?? null,
            sessionReady: true,
            sessionError: "",
          });
      })
      .catch(() => {
        if (active)
          setState((current) => ({
            ...current,
            sessionReady: true,
            sessionError: "Could not check your account. Reload to retry.",
          }));
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!state.sessionReady || state.sessionError || !state.account) return;
    const reload = () => {
      if (!document.hidden) void state.repository.load();
    };
    window.addEventListener("focus", reload);
    const timer = window.setInterval(reload, 30000);
    return () => {
      window.removeEventListener("focus", reload);
      window.clearInterval(timer);
    };
  }, [state]);
  return (
    <RepositoryContext value={{ ...state, clipsyCache }}>
      {children}
    </RepositoryContext>
  );
}
export function useLibrary() {
  const context = useContext(RepositoryContext);
  if (!context) throw new Error("LibraryProvider is missing.");
  const { repository, account, sessionReady, sessionError, clipsyCache } =
    context;
  const snapshot = useSyncExternalStore(
    repository.subscribe,
    repository.getSnapshot,
    () => initialSnapshot,
  );
  return {
    ...snapshot,
    ready:
      sessionReady && (!account || snapshot.ready || Boolean(sessionError)),
    sessionReady,
    error: sessionError || snapshot.error,
    repository,
    account,
    clipsyCache,
  };
}
export function errorMessage(error: unknown) {
  // Boundary errors should be helpful without dumping entire imported/personal content.
  if (error instanceof Error && error.name === "ZodError")
    return "Please check your fields: title is required; links need a safe URL; notes need text. Check field lengths and tags too.";
  return error instanceof Error
    ? error.message
    : "Something went wrong. Your change was not saved.";
}
export function downloadFile(content: string, filename: string) {
  const url = URL.createObjectURL(
    new Blob([content], { type: "application/json" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
