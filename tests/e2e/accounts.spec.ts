import { expect, test } from "./fixtures";

test.use({ signedIn: false });

test("signed-out routes and failed session checks never enable local saving", async ({
  page,
}) => {
  await page.addInitScript(() => {
    // No app flow should even access browser library storage now.
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new Error("Browser storage must not be used");
      },
    });
  });
  for (const path of [
    "/",
    "/all",
    "/archived",
    "/deleted",
    "/inbox",
    "/items/00000000-0000-4000-8000-000000000000",
    "/capture#text=Unsaved%20note",
  ]) {
    await page.goto(path);
    await expect(
      page.getByRole("heading", { name: "Sign in", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("textbox", { name: "URL or note" }),
    ).toHaveCount(0);
  }
  await page.route("**/api/auth/get-session**", (route) =>
    route.fulfill({ status: 503, json: { error: "Unavailable" } }),
  );
  await page.goto("/all");
  await expect(
    page.getByRole("alert").filter({ hasText: "Could not check your account" }),
  ).toBeVisible();
  await expect(page.getByRole("textbox", { name: "URL or note" })).toHaveCount(
    0,
  );
});

test("shared capture waits for sign-in and retains its draft", async ({
  page,
}) => {
  await page.goto("/capture#text=Shared%20note%20after%20sign-in");
  await expect(
    page.getByRole("heading", { name: "Sign in", exact: true }),
  ).toBeVisible();
  const response = await page.request.post("/api/auth/sign-up/email", {
    headers: { Origin: "http://localhost:3100" },
    data: {
      name: "Share test",
      email: `share-${crypto.randomUUID()}@example.test`,
      password: "test-only-password-123",
    },
  });
  expect(response.ok()).toBe(true);
  await page.reload();
  await expect(page.getByRole("textbox", { name: "URL or note" })).toHaveValue(
    "Shared note after sign-in",
  );
  const exported = await page.request.get("/api/items/export");
  expect((await exported.json()).items).toEqual([]);
});

test("account-only gate, separate device access, conflicts, and logout privacy", async ({
  page,
  browser,
}) => {
  const email = `owner-${crypto.randomUUID()}@example.test`;
  const password = "test-only-password-123";
  await page.addInitScript(() =>
    localStorage.setItem("personal-library.items", "legacy browser data"),
  );
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Sign in", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("textbox", { name: "URL or note" })).toHaveCount(
    0,
  );
  expect((await page.request.get("/api/items")).status()).toBe(401);
  const originalLocal = await page.evaluate(() =>
    localStorage.getItem("personal-library.items"),
  );
  await page.goto("/account");
  await page
    .getByRole("button", { name: "Create a new account", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Name", exact: true })
    .fill("Personal owner");
  await page.getByRole("textbox", { name: "Email", exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: `Signed in as ${email}` }),
  ).toBeVisible();
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "No items yet.", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "URL or note" })
    .fill("Keep this account note\nOriginal context.");
  await page.getByRole("button", { name: "Save to Inbox" }).click();
  await expect(page.getByRole("status")).toContainText("Saved");
  expect(
    await page.evaluate(() => localStorage.getItem("personal-library.items")),
  ).toBe(originalLocal);
  await page.goto("/all");
  await page
    .getByRole("link", { name: "Keep this account note", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Content / note" }),
  ).toHaveValue("Keep this account note\nOriginal context.");

  // A completely independent browser context simulates a second device; no localStorage/cookies shared.
  const secondDevice = await browser.newContext();
  const phone = await secondDevice.newPage();
  await phone.goto("http://localhost:3100/account");
  await phone.getByRole("textbox", { name: "Email", exact: true }).fill(email);
  await phone.getByLabel("Password", { exact: true }).fill(password);
  await phone.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    phone.getByRole("heading", { name: `Signed in as ${email}` }),
  ).toBeVisible();
  await phone.goto("http://localhost:3100/all");
  await phone
    .getByRole("link", { name: "Keep this account note", exact: true })
    .click();
  await phone
    .getByRole("textbox", { name: "Title", exact: true })
    .fill("Updated on second device");
  await phone
    .getByRole("button", { name: "Save changes", exact: true })
    .click();
  await expect(phone.getByRole("status")).toHaveText("Changes saved.");
  await page
    .getByRole("textbox", { name: "Title", exact: true })
    .fill("Stale draft from first device");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "changed" }),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Title", exact: true }),
  ).toHaveValue("Stale draft from first device");
  await page.reload();
  await expect(
    page.getByRole("heading", {
      name: "Updated on second device",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByLabel("Revisit date/time", { exact: false })
    .fill("2030-06-10T12:30");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Changes saved.");
  await page.goto("/reminders");
  await expect(
    page.getByRole("link", { name: "Updated on second device", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Mark done: Updated on second device",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("link", { name: "Updated on second device", exact: true }),
  ).toHaveCount(0);
  const blockedPreview = await page.request.post("/api/metadata", {
    headers: { Origin: "http://localhost:3100" },
    data: { url: "http://127.0.0.1/private" },
  });
  expect(blockedPreview.status()).toBe(422);
  await page.goto("/");
  await page
    .getByRole("textbox", { name: "URL or note" })
    .fill("https://example.com/preview");
  await page.getByRole("button", { name: "Save to Inbox" }).click();
  await expect(page.getByRole("status")).toContainText("Saved");
  await page.getByRole("link", { name: "example.com", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Title", exact: true })
    .fill("My manual title");
  await page.route("**/api/metadata", (route) =>
    route.fulfill({
      json: { title: "Metadata title", description: "Preview context" },
    }),
  );
  await page
    .getByRole("button", { name: "Fetch optional link details" })
    .click();
  await expect(
    page.getByRole("button", { name: "Use suggested description in draft" }),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Title", exact: true }),
  ).toHaveValue("My manual title");
  await page
    .getByRole("button", { name: "Use suggested description in draft" })
    .click();
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Changes saved.");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "My manual title", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Description / why I saved this" }),
  ).toHaveValue("Preview context");
  await phone.goto("http://localhost:3100/account");
  await phone.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    phone.getByRole("heading", { name: "Sign in", exact: true }),
  ).toBeVisible();
  await phone.goto("http://localhost:3100/all");
  await expect(
    phone.getByRole("heading", {
      name: "Sign in",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    phone.getByRole("link", { name: "Updated on second device", exact: true }),
  ).toHaveCount(0);
  await secondDevice.close();
});
