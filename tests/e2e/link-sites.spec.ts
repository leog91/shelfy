import { expect, test } from "./fixtures";

test("legacy products behave as links and Buy alone controls Shopping @mobile", async ({
  page,
}) => {
  const created = await page.request.post("/api/items", {
    headers: { Origin: "http://localhost:3100" },
    data: { text: "https://example.com/lens", intent: "buy" },
  });
  expect(created.ok()).toBe(true);
  const { item } = await created.json();
  const legacy = await page.request.patch(`/api/items/${item.id}`, {
    headers: { Origin: "http://localhost:3100" },
    data: { expectedUpdatedAt: item.updatedAt, patch: { type: "product" } },
  });
  expect(legacy.ok()).toBe(true);
  await page.goto("/all");
  await expect(page.locator(".item-row:visible")).toContainText("link · buy");
  await expect(page.locator(".item-row:visible .type-mark")).toHaveText("↗");
  await page.locator(".filter-options > summary").click();
  const typeFilter = page.getByRole("combobox", { name: "Type", exact: true });
  await expect(typeFilter.locator("option")).toHaveText([
    "All",
    "link",
    "note",
    "video",
  ]);
  await typeFilter.selectOption("link");
  await expect(page.locator(".item-row:visible")).toHaveCount(1);
  await page.goto(`/items/${item.id}`);
  const typeEditor = page.getByRole("combobox", { name: "Type", exact: true });
  await expect(typeEditor.locator("option")).toHaveText([
    "link",
    "note",
    "video",
  ]);
  await expect(typeEditor.locator("option:checked")).toHaveText("link");
  await page.getByLabel("Title", { exact: true }).fill("My lens");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page).toHaveURL(/\/all$/);
  const saved = (await (await page.request.get(`/api/items/${item.id}`)).json())
    .item;
  expect(saved.type).toBe("product");
  expect(saved.intent).toBe("buy");
  await page.goto("/shopping");
  await expect(page.locator(".item-row:visible")).toContainText("My lens");
  await page.goto(`/items/${item.id}`);
  await page
    .getByRole("combobox", { name: "Intent", exact: true })
    .selectOption("read");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page).toHaveURL(/\/all$/);
  await page.goto("/shopping");
  await expect(page.locator(".item-row:visible")).toHaveCount(0);
});

test("shop detection respects intent overrides and site icons stay local", async ({
  page,
}) => {
  const externalRequests: string[] = [];
  await page.route("https://**/*", (route) => {
    externalRequests.push(route.request().url());
    return route.abort();
  });
  await page.goto("/");
  const capture = page.getByRole("region", {
    name: "Quick capture",
    exact: true,
  });
  for (const [url, intent] of [
    ["https://www.amazon.de/dp/example", ""],
    ["https://www.zalando.at/shoes/example", ""],
    ["https://www.blue-tomato.com/en-GB/product/example", ""],
    ["https://www.amazon.co.uk/help/example", "reference"],
    ["https://x.com/example/status/1", ""],
    ["https://old.reddit.com/r/example/comments/1", ""],
    ["https://example.com/article", ""],
    ["https://en.wikipedia.org/wiki/Python", ""],
    ["https://www.google.com/search?q=rag", ""],
  ]) {
    await capture
      .getByRole("textbox", { name: "URL or note", exact: true })
      .fill(url);
    await capture
      .getByRole("combobox", { name: "Intent", exact: true })
      .selectOption(intent);
    await capture
      .getByRole("button", { name: "Save to Inbox", exact: true })
      .click();
    await expect(capture.getByRole("status")).toContainText("Saved");
  }
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "All items", exact: true })
    .click();
  const rows = page.locator(".item-row:visible");
  await expect(rows).toHaveCount(9);
  for (const [title, label] of [
    ["amazon.de", "Amazon"],
    ["zalando.at", "Zalando"],
    ["blue-tomato.com", "Blue Tomato"],
    ["amazon.co.uk", "Amazon"],
    ["Post by @example", "X (Twitter)"],
    ["old.reddit.com", "Reddit"],
    ["Python", "Wikipedia"],
    ["google.com", "Google Search"],
  ]) {
    const row = rows.filter({
      has: page.getByRole("link", { name: title, exact: true }),
    });
    await expect(row.locator(".item-meta")).toContainText(label);
    await expect(row.locator('.type-mark svg[aria-hidden="true"]')).toHaveCount(
      1,
    );
  }
  await expect(
    rows
      .filter({
        has: page.getByRole("link", { name: "example.com", exact: true }),
      })
      .locator(".type-mark"),
  ).toHaveText("↗");
  await expect(
    rows.filter({
      has: page.getByRole("link", { name: "amazon.co.uk", exact: true }),
    }),
  ).toContainText("link · reference");
  await expect(
    rows.filter({
      has: page.getByRole("link", { name: "Post by @example", exact: true }),
    }),
  ).toContainText("link · read");
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Shopping", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Shopping", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".item-row:visible")).toHaveCount(3);
  await expect(
    page.locator(".item-row:visible").filter({ hasText: "link · buy" }),
  ).toHaveCount(3);
  expect(externalRequests).toEqual([]);
});
