import { expect, test } from "./fixtures";

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
