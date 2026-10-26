import { expect, test } from "./fixtures";

test("navigation and recent focus reuse items; polling waits five minutes", async ({
  page,
}) => {
  let loads = 0;
  page.on("request", (request) => {
    if (
      new URL(request.url()).pathname === "/api/items" &&
      request.method() === "GET"
    )
      loads++;
  });
  await page.clock.install();
  await page.goto("/inbox");
  await expect(
    page.getByRole("heading", { name: "No items yet.", exact: true }),
  ).toBeVisible();
  expect(loads).toBe(1);
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "To read", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "No items yet.", exact: true }),
  ).toBeVisible();
  await page.clock.fastForward(30_000);
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  expect(loads).toBe(1);

  await page.clock.fastForward(31_000);
  const focused = page.waitForResponse(
    (response) => new URL(response.url()).pathname === "/api/items",
  );
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await focused;
  expect(loads).toBe(2);
  await page.clock.fastForward(60_000);
  expect(loads).toBe(2);

  const polled = page.waitForResponse(
    (response) => new URL(response.url()).pathname === "/api/items",
  );
  await page.clock.fastForward(180_000);
  await polled;
  expect(loads).toBe(3);
});

test(
  "article capture, triage, editing, done, search and refresh",
  { tag: "@mobile" },
  async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/");
    await expect(
      page.getByRole("heading", {
        name: "No items yet.",
      }),
    ).toBeVisible();
    await page
      .getByLabel("URL or note")
      .fill("https://example.com/technical-article?topic=react");
    await page.getByRole("button", { name: "Save to Inbox" }).click();
    await expect(page.getByRole("status")).toContainText("Saved");
    await page
      .getByRole("navigation")
      .getByRole("link", { name: "Inbox", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Move to later: example.com" })
      .click();
    await page
      .getByRole("navigation")
      .getByRole("link", { name: "To read", exact: true })
      .click();
    await expect(
      page.getByRole("link", { name: "Open original: example.com" }),
    ).toHaveAttribute(
      "href",
      "https://example.com/technical-article?topic=react",
    );
    await page
      .getByRole("link", { name: "Edit: example.com", exact: true })
      .click();
    await page
      .getByLabel("Title", { exact: true })
      .fill("React architecture guide");
    await page
      .getByRole("textbox", { name: "Labels", exact: false })
      .fill("Development, React");
    await page
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await expect(page.getByRole("status")).toHaveText("Changes saved.");
    await page.getByRole("button", { name: "Mark done", exact: true }).click();
    await page
      .getByRole("navigation")
      .getByRole("link", { name: "To read", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "To read", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "React architecture guide", exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole("navigation")
      .getByRole("link", { name: "All items", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "Search items" })
      .fill("Development");
    await expect(
      page.getByRole("link", { name: "React architecture guide", exact: true }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("link", { name: "React architecture guide", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".status-done")).toHaveText("done");
    expect(errors).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  },
);

test("note, YouTube, product override, archive, portability and confirmed delete", async ({
  page,
}) => {
  await page.goto("/");
  const capture = page.getByLabel("URL or note");
  await capture.fill("Project idea\nKeep the full second line.");
  await capture.press("Control+Enter");
  await expect(page.getByRole("status")).toContainText("Saved");
  await capture.fill("https://youtu.be/abc123");
  await page.getByRole("button", { name: "Save to Inbox" }).click();
  await expect(capture).toHaveValue("");
  await capture.fill("https://shop.example/lens?offer=1");
  await page
    .getByRole("combobox", { name: "Intent", exact: true })
    .selectOption("buy");
  await page.getByRole("button", { name: "Save to Inbox" }).click();
  await expect(capture).toHaveValue("");
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Shopping", exact: true })
    .click();
  await page
    .getByRole("link", { name: "Edit: shop.example", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Type", exact: true })
    .selectOption("product");
  await page.getByLabel("Title", { exact: true }).fill("Camera lens");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Changes saved.");
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "To watch", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "youtu.be", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Notes", exact: true })
    .click();
  await page.getByRole("link", { name: "Project idea", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Content / note", exact: true }),
  ).toHaveValue("Project idea\nKeep the full second line.");
  await page.getByRole("button", { name: "Archive", exact: true }).click();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "All items", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "All items", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Project idea", exact: true }),
  ).toHaveCount(0);
  await page.locator(".filter-options:visible > summary").click();
  await page
    .getByRole("combobox", { name: "Status", exact: true })
    .selectOption("archived");
  await page.getByRole("link", { name: "Project idea", exact: true }).click();
  await page.getByRole("button", { name: "Delete item…" }).click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Project idea", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Delete item…" }).click();
  await page
    .getByRole("button", { name: "Move to Deleted", exact: true })
    .click();
  await expect(page).toHaveURL(/\/all$/);
  await page.goto("/deleted");
  await page.getByRole("link", { name: "Project idea", exact: true }).click();
  await page
    .getByRole("button", { name: "Delete permanently…", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Yes, delete permanently", exact: true })
    .click();
  await expect(page).toHaveURL(/\/deleted$/);
  await page.goto("/all");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export JSON" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/library-.*\.json/);
  const exported = await page.request.get("/api/items/export");
  expect(exported.ok()).toBe(true);
  const raw = await exported.text();
  const fileChooserPromise = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "Import JSON / bookmarks", exact: true })
    .click();
  await (
    await fileChooserPromise
  ).setFiles({
    name: "library.json",
    mimeType: "application/json",
    buffer: Buffer.from(raw!),
  });
  await page.getByRole("button", { name: "Confirm additive import" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Imported 0 items; skipped 2 identical items",
  );
});

test("legacy corrupt browser storage is ignored and never overwritten", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("personal-library.items", "broken content"),
  );
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "No items yet.", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save to Inbox" }),
  ).toBeEnabled();
  await page.getByLabel("URL or note").fill("Account-only note");
  await page.getByRole("button", { name: "Save to Inbox" }).click();
  await expect(page.getByRole("status")).toContainText("Saved");
  expect(
    await page.evaluate(() => localStorage.getItem("personal-library.items")),
  ).toBe("broken content");
});
