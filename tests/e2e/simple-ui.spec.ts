import { expect, test } from "./fixtures";

test("plain personal UI, capture focus, compact library, filters and book favicon", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveTitle("Shelfy");
  await expect(
    page.getByRole("heading", { name: "Overview", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "No items yet.", exact: true }),
  ).toBeVisible();
  await expect(page.locator("footer, .eyebrow")).toHaveCount(0);
  await expect(
    page.getByRole("combobox", { name: "Intent", exact: true }),
  ).toHaveValue("");
  await expect(
    page
      .getByRole("combobox", { name: "Intent", exact: true })
      .getByRole("option", { name: "Automatic", exact: true }),
  ).toHaveCount(1);
  const capture = page.getByRole("textbox", {
    name: "URL or note",
    exact: true,
  });
  await capture.fill("Personal test note\nSecond line.");
  await page.getByRole("button", { name: "Save to Inbox" }).click();
  await expect(page.getByRole("status")).toContainText("Saved");
  await expect(capture).toBeFocused();
  await capture.fill("Another test note");
  await capture.press("Control+Enter");
  await expect(page.getByRole("status")).toContainText("Another test note");
  await expect(capture).toBeFocused();

  await page
    .getByRole("navigation")
    .getByRole("link", { name: "All items", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "All items", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".filter-options:visible")).not.toHaveAttribute(
    "open",
  );
  const row = await page.locator(".item-row:visible").first().boundingBox();
  expect(row).not.toBeNull();
  expect(row!.y).toBeLessThan(page.viewportSize()!.height - 44);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("textbox", { name: "Search items" })
    .fill("missing term");
  await expect(
    page.getByRole("heading", { name: "No matching items.", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "Personal test note", exact: true }),
  ).toBeVisible();
  await page.locator(".filter-options:visible > summary").click();
  await page
    .getByRole("combobox", { name: "Status", exact: true })
    .selectOption("done");
  await expect(
    page.getByRole("heading", { name: "No matching items.", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "Personal test note", exact: true }),
  ).toBeVisible();

  const iconHref = await page
    .locator('link[rel="icon"][type="image/svg+xml"]')
    .getAttribute("href");
  const icon = await page.request.get(iconHref!);
  expect(icon.ok()).toBe(true);
  expect(await icon.text()).toContain("m16 6 4 14");
  const favicon = await page.request.get("/favicon.ico");
  expect(favicon.ok()).toBe(true);
  expect((await favicon.body()).subarray(0, 6)).toEqual(
    Buffer.from([0, 0, 1, 0, 1, 0]),
  );
});
