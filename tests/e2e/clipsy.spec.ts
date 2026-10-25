import { test, expect } from "./fixtures";

test("Clipsy cache reuses counts for six hours; refresh, expiry and reload fetch again", async ({
  page,
}) => {
  const now = Date.now();
  await page.clock.setFixedTime(new Date(now));
  let requests = 0;
  await page.route("**/api/clipsy", (route) => {
    requests++;
    return route.fulfill({
      json: {
        connected: true,
        url: "https://clipsy.example",
        summary: {
          videos: requests + 4,
          toWatch: requests + 2,
          watching: 2,
          collections: 1,
          subscriptions: 4,
        },
      },
    });
  });
  await page.goto("/");
  const panel = page.getByRole("region", { name: "Clipsy", exact: true });
  await expect(panel).toContainText("5 videos");
  await expect(panel).toContainText("cached for up to 6 hours");
  await expect(panel.locator("time")).toHaveText("just now");
  const timestamp = await panel.locator("time").getAttribute("datetime");
  const navigateBack = async () => {
    await page
      .getByRole("navigation")
      .getByRole("link", { name: "All items", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "All items", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("navigation")
      .getByRole("link", { name: "Overview", exact: true })
      .click();
    await expect(
      panel.getByRole("button", { name: "Refresh Clipsy", exact: true }),
    ).toBeVisible();
  };
  await navigateBack();
  expect(requests).toBe(1);
  await page.clock.setFixedTime(new Date(now + 60_000));
  await panel
    .getByRole("button", { name: "Refresh Clipsy", exact: true })
    .click();
  await expect(panel).toContainText("6 videos");
  expect(await panel.locator("time").getAttribute("datetime")).not.toBe(
    timestamp,
  );
  await navigateBack();
  expect(requests).toBe(2);
  await page.clock.setFixedTime(new Date(now + 60_000 + 6 * 60 * 60 * 1000));
  await navigateBack();
  await expect(panel).toContainText("7 videos");
  expect(requests).toBe(3);
  await page.reload();
  await expect(panel).toContainText("8 videos");
  expect(requests).toBe(4);
});

test("disconnect clears cached Clipsy counts before returning to Overview", async ({
  page,
}) => {
  let connected = true;
  let requests = 0;
  await page.route("**/api/clipsy", (route) => {
    requests++;
    return route.fulfill({
      json: connected
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
        : { connected: false },
    });
  });
  await page.route("**/api/clipsy/status", (route) =>
    route.fulfill({ json: { connected, expired: false } }),
  );
  await page.route("**/api/clipsy/disconnect", (route) => {
    connected = false;
    return route.fulfill({ json: { connected: false } });
  });
  await page.goto("/");
  await expect(
    page.getByRole("region", { name: "Clipsy", exact: true }),
  ).toContainText("5 videos");
  await page.getByRole("link", { name: "Account", exact: true }).click();
  await page
    .getByRole("button", { name: "Disconnect Clipsy", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Clipsy connection", exact: true }),
  ).toContainText("Clipsy disconnected.");
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Overview", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Overview", exact: true }),
  ).toBeVisible();
  await expect.poll(() => requests).toBe(2);
  await expect(
    page.getByRole("region", { name: "Clipsy", exact: true }),
  ).toHaveCount(0);
});

test("Clipsy summary refreshes and recovers without changing the library", async ({
  page,
}) => {
  let available = true;
  let requests = 0;
  await page.clock.install();
  await page.route("**/api/clipsy", (route) => {
    requests++;
    return route.fulfill({
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
    });
  });
  await page.goto("/");
  const panel = page.getByRole("region", { name: "Clipsy", exact: true });
  await expect(panel).toContainText("5 videos · 3 to watch · 2 watching");
  await expect(
    panel.getByRole("link", { name: "Open Clipsy" }),
  ).toHaveAttribute("href", "https://clipsy.example");
  await expect(panel.locator("time")).toHaveText("just now");
  await expect(panel.locator("time")).toHaveAttribute("title", /\d/);
  await page.clock.fastForward(60_000);
  await expect(panel.locator("time")).toHaveText("1 minute ago");
  await page.clock.fastForward(4 * 60_000);
  await expect(panel.locator("time")).toHaveText("5 minutes ago");
  expect(requests).toBe(1);
  available = false;
  await panel.getByRole("button", { name: "Refresh Clipsy" }).click();
  await expect(panel).toContainText("Clipsy is unavailable");
  await expect(panel).not.toContainText("5 videos");
  available = true;
  await panel.getByRole("button", { name: "Retry Clipsy" }).click();
  await expect(panel).toContainText("5 videos");
  await expect(panel.locator("time")).toHaveText("just now");
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
