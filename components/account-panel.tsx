"use client";

import { useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { errorMessage, useLibrary } from "./library-provider";
import { CaptureTools } from "./capture-tools";

export function AccountPanel() {
  const { account, repository, ready } = useLibrary();
  const [signUp, setSignUp] = useState(false);
  const [failure, setFailure] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <>
      <header className="page-heading">
        <h1>Account</h1>
      </header>
      {!ready ? (
        <p role="status">Checking account…</p>
      ) : account ? (
        <>
          <section className="account-panel">
            <h2>Signed in as {account.email}</h2>
            <p>
              Items are saved to your account, not in browser storage. Other
              devices refresh on focus and every 30 seconds while visible.
            </p>
            <div className="actions">
              <button
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await repository.load();
                    setMessage(
                      "Library refresh finished. Check any error above.",
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Refresh account library
              </button>
              <button
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setFailure("");
                  try {
                    const result = await authClient.signOut();
                    if (result.error)
                      throw new Error(
                        result.error.message ?? "Could not sign out.",
                      );
                    // Full reload deliberately drops all preserved private route state.
                    window.location.reload();
                  } catch (e) {
                    setFailure(errorMessage(e));
                    setBusy(false);
                  }
                }}
              >
                Sign out
              </button>
            </div>
          </section>
        </>
      ) : (
        <section className="account-panel">
          <h2>{signUp ? "Create an account" : "Sign in"}</h2>
          <p>
            Sign in to save and view your items. There is no browser-local
            library.
          </p>
          <form
            className="editor auth-form"
            onSubmit={async (event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              setFailure("");
              setBusy(true);
              try {
                const credentials = {
                  email: String(data.get("email")),
                  password: String(data.get("password")),
                };
                const result = signUp
                  ? await authClient.signUp.email({
                      ...credentials,
                      name: String(data.get("name")),
                    })
                  : await authClient.signIn.email(credentials);
                if (result.error)
                  throw new Error(
                    result.error.message ?? "Authentication failed.",
                  );
                // Re-resolve the workspace only after the new session cookie is set.
                window.location.reload();
              } catch (e) {
                setFailure(errorMessage(e));
                setBusy(false);
              }
            }}
          >
            {signUp && (
              <label>
                Name
                <input
                  name="name"
                  autoComplete="name"
                  required
                  maxLength={100}
                />
              </label>
            )}
            <label>
              Email
              <input
                name="email"
                type="email"
                autoComplete="email"
                required
                maxLength={254}
              />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                autoComplete={signUp ? "new-password" : "current-password"}
                required
                minLength={12}
                maxLength={128}
              />
            </label>
            <p className="muted">
              Use 12–128 characters. Email verification and password recovery
              are not configured yet; keep your credentials safe. Registration
              can be disabled by the server owner.
            </p>
            <div className="actions">
              <button className="primary" disabled={busy}>
                {signUp ? "Create account" : "Sign in"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setSignUp(!signUp);
                  setFailure("");
                }}
              >
                {signUp ? "Use an existing account" : "Create a new account"}
              </button>
            </div>
          </form>
        </section>
      )}
      {message && (
        <p className="feedback" role="status">
          {message}
        </p>
      )}
      {failure && (
        <p className="error-text" role="alert">
          {failure}
        </p>
      )}
      <CaptureTools />
      <Link className="back-link" href="/all">
        Back to library
      </Link>
    </>
  );
}
