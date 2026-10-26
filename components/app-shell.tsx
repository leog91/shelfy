"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { itemLabels, labelHref } from "@/lib/items/labels";
import {
  BookOpen,
  Inbox,
  LayoutDashboard,
  Library,
  NotebookPen,
  Play,
  ShoppingBag,
  CalendarClock,
  Archive,
  Trash2,
  Tag,
} from "lucide-react";
import { useLibrary } from "./library-provider";
import { Suspense } from "react";
import { ThemeSelect } from "./theme-select";

const navigation = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/all", label: "All items", icon: Library },
  { href: "/read", label: "To read", icon: BookOpen },
  { href: "/watch", label: "To watch", icon: Play },
  { href: "/shopping", label: "Shopping", icon: ShoppingBag },
  { href: "/notes", label: "Notes", icon: NotebookPen },
  { href: "/reminders", label: "Reminders", icon: CalendarClock },
  { href: "/archived", label: "Archived", icon: Archive },
  { href: "/deleted", label: "Deleted", icon: Trash2 },
];
function ActiveNavigation() {
  const pathname = usePathname();
  const label = useSearchParams().get("label") ?? "";
  const { items, account, ready } = useLibrary();
  const labels = itemLabels(items);
  return (
    <>
      <Navigation
        pathname={pathname === "/all" && label ? undefined : pathname}
      />
      {account && ready && (
        <details className="sidebar-labels" open>
          <summary>Labels</summary>
          {labels.length ? (
            <nav aria-label="Labels">
              {labels.map((name) => (
                <Link
                  key={name}
                  href={labelHref(name)}
                  aria-current={
                    pathname === "/all" && label === name ? "page" : undefined
                  }
                >
                  <Tag size={16} aria-hidden="true" />
                  <span>{name}</span>
                </Link>
              ))}
            </nav>
          ) : (
            <p className="muted">Add labels when saving or editing an item.</p>
          )}
        </details>
      )}
    </>
  );
}
function Navigation({ pathname }: { pathname?: string }) {
  return (
    <nav aria-label="Main navigation">
      {navigation.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          aria-current={pathname === href ? "page" : undefined}
        >
          <Icon size={18} aria-hidden="true" />
          {label}
        </Link>
      ))}
    </nav>
  );
}
export function AppShell({ children }: { children: React.ReactNode }) {
  const { error, repository, account } = useLibrary();
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <aside className="sidebar">
        <Link className="brand" href="/" aria-label="Shelfy home">
          <Library size={21} strokeWidth={1.7} aria-hidden="true" /> Shelfy
        </Link>
        <Suspense fallback={<Navigation />}>
          <ActiveNavigation />
        </Suspense>
        <ThemeSelect />
        <div className="local-note">
          {account ? "Account storage" : "Sign in required"}
          <p>{account ? account.email : "Items are saved to your account."}</p>
          <Link href="/account" className="back-link">
            {account ? "Manage account" : "Sign in / create account"}
          </Link>
        </div>
      </aside>
      <main id="main" className="main-content" tabIndex={-1}>
        <div className="topline">
          <span>{account ? "Account storage" : "Sign in required"}</span>
          <Link href="/account">{account ? "Account" : "Sign in"}</Link>
        </div>
        {error && (
          <section className="error-panel" role="alert">
            <p>{error}</p>
            <div className="actions">
              <button
                onClick={() =>
                  account ? void repository.load() : window.location.reload()
                }
              >
                Retry loading
              </button>
            </div>
          </section>
        )}
        {children}
      </main>
    </div>
  );
}
