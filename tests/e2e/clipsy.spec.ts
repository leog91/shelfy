import { test, expect } from "./fixtures";

test("Clipsy summary refreshes and recovers without changing the library", async ({
  page,
}) => {
  let available = true;
  await page.route("**/api/clipsy", (route) =>
    route.fulfill({
      status: available ? 200 : 503,
      json: available
        ? {
            connected: true,
            url: "https://clipsy.example",
            summary: {
              videos: 5,
              toWatch: 3,
              watching: 2,
              collections: 1,
              subscriptions: 4,
            },
          }
        : { error: "Unavailable" },
    }),
  );
  await page.goto("/");
  const panel = page.getByRole("region", { name: "Clipsy", exact: true });
  await expect(panel).toContainText("5 videos · 3 to watch · 2 watching");
  await expect(
    panel.getByRole("link", { name: "Open Clipsy" }),
  ).toHaveAttribute("href", "https://clipsy.example");
  available = false;
  await panel.getByRole("button", { name: "Refresh Clipsy" }).click();
  await expect(panel).toContainText("Clipsy is unavailable");
  await expect(panel).not.toContainText("5 videos");
  available = true;
  await panel.getByRole("button", { name: "Retry Clipsy" }).click();
  await expect(panel).toContainText("5 videos");
});

test("unconfigured Clipsy is hidden and its API is private", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Overview", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Clipsy", exact: true }),
  ).toHaveCount(0);
  const response = await page.request.get("/api/clipsy");
  expect(response.status()).toBe(401);
  expect(response.headers()["cache-control"]).toBe("private, no-store");
});

test("Account offers connect, cancellation feedback, and disconnect", async ({
  page,
}) => {
  let connected = false;
  await page.route("**/api/clipsy/status", (route) =>
    route.fulfill({ json: { connected, expired: false } }),
  );
  await page.route("**/api/clipsy/start", (route) =>
    route.fulfill({
      json: { url: "http://localhost:3100/account?clipsy=cancelled" },
    }),
  );
  await page.route("**/api/clipsy/disconnect", (route) => {
    connected = false;
    return route.fulfill({ json: { connected: false } });
  });
  await page.goto("/account");
  let panel = page.getByRole("region", {
    name: "Clipsy connection",
    exact: true,
  });
  await panel
    .getByRole("button", { name: "Connect Clipsy", exact: true })
    .click();
  await expect(page).toHaveURL(/clipsy=cancelled/);
  panel = page.getByRole("region", { name: "Clipsy connection", exact: true });
  await expect(panel).toContainText(
    "Connection cancelled. Nothing was linked.",
  );
  connected = true;
  await page.goto("/account?clipsy=connected");
  await expect(panel).toContainText(
    "Clipsy connected. Counts are available in Overview.",
  );
  await panel
    .getByRole("button", { name: "Disconnect Clipsy", exact: true })
    .click();
  await expect(panel).toContainText(
    "Clipsy disconnected. Its videos were not changed.",
  );
  await expect(
    panel.getByRole("button", { name: "Connect Clipsy", exact: true }),
  ).toBeEnabled();
});
