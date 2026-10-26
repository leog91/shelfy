import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./fixtures";

test("Archived and Deleted navigation, restore, refresh and permanent deletion", async ({
  page,
}) => {
  await page.goto("/");
  const capture = page.getByRole("textbox", {
    name: "URL or note",
    exact: true,
  });
  await expect(capture).toBeEditable();
  await capture.fill("Keep this archived note");
  await page.getByRole("button", { name: "Save to Inbox" }).click();
  await page
    .getByRole("button", {
      name: "Archive: Keep this archived note",
      exact: true,
    })
    .click();
  const archivedLink = page
    .getByRole("navigation")
    .getByRole("link", { name: "Archived", exact: true });
  await archivedLink.click();
  await expect(archivedLink).toHaveAttribute("aria-current", "page");
  await expect(
    page.getByRole("heading", { name: "Archived", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Keep this archived note", exact: true }),
  ).toBeVisible();
  await page.getByRole("textbox", { name: "Search items" }).fill("missing");
  await expect(
    page.getByRole("heading", { name: "No matching items.", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  await page
    .getByRole("link", { name: "Keep this archived note", exact: true })
    .click();
  await page.getByRole("button", { name: "Delete item…", exact: true }).click();
  await page
    .getByRole("button", { name: "Move to Deleted", exact: true })
    .click();
  await expect(page).toHaveURL(/\/all$/);
  const deletedLink = page
    .getByRole("navigation")
    .getByRole("link", { name: "Deleted", exact: true });
  await deletedLink.click();
  await expect(deletedLink).toHaveAttribute("aria-current", "page");
  await expect(
    page.getByRole("heading", { name: "Deleted", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("link", { name: "Keep this archived note", exact: true }),
  ).toBeVisible();
  await page.getByRole("textbox", { name: "Search items" }).fill("missing");
  await page
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Restore: Keep this archived note",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("heading", { name: "No deleted items.", exact: true }),
  ).toBeVisible();
  await page.goto("/archived");
  await page
    .getByRole("link", { name: "Keep this archived note", exact: true })
    .click();
  await expect(
    page.getByRole("combobox", { name: "Status", exact: true }),
  ).toHaveValue("archived");
  await page.getByRole("button", { name: "Delete item…", exact: true }).click();
  await page
    .getByRole("button", { name: "Move to Deleted", exact: true })
    .click();
  await page.goto("/deleted");
  await page
    .getByRole("link", { name: "Keep this archived note", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Save changes", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Delete permanently…", exact: true })
    .click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Restore item", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Delete permanently…", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Yes, delete permanently", exact: true })
    .click();
  await expect(page).toHaveURL(/\/deleted$/);
  await expect(
    page.getByRole("heading", { name: "No deleted items.", exact: true }),
  ).toBeVisible();
  expect(
    (await (await page.request.get("/api/items/export")).json()).items,
  ).toEqual([]);
});

test(
  "theme follows system, remembers overrides and remains accessible",
  { tag: "@mobile" },
  async ({ page }, testInfo) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/");
    const theme = page.getByRole("combobox", { name: "Theme", exact: true });
    await expect(theme).toHaveValue("system");
    await expect(page.locator("body")).toHaveCSS(
      "background-color",
      "rgb(24, 28, 26)",
    );
    const capture = page.getByRole("textbox", {
      name: "URL or note",
      exact: true,
    });
    await expect(capture).toBeEditable();
    await capture.fill("Dark theme note");
    await page.getByRole("button", { name: "Save to Inbox" }).click();
    await expect(page.locator(".item-row:visible")).toHaveCount(1);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await theme.selectOption("light");
    await expect(page.locator("body")).toHaveCSS(
      "background-color",
      "rgb(255, 255, 255)",
    );
    await theme.selectOption("dark");
    await page.emulateMedia({ colorScheme: "light" });
    await page.reload();
    await expect(theme).toHaveValue("dark");
    await expect(page.locator("body")).toHaveCSS(
      "background-color",
      "rgb(24, 28, 26)",
    );
    await page.goto("/archived");
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.goto("/all");
    await page
      .getByRole("link", { name: "Dark theme note", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Save changes", exact: true }),
    ).toBeVisible();
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page
      .getByRole("button", { name: "Delete item…", exact: true })
      .click();
    await page.screenshot({
      path: testInfo.outputPath("dark-editor.png"),
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Move to Deleted", exact: true })
      .click();
    await expect(page).toHaveURL(/\/all$/);
    await page.goto("/deleted");
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page
      .getByRole("link", { name: "Dark theme note", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Restore item", exact: true }),
    ).toBeVisible();
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page
      .getByRole("button", { name: "Restore item", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Save changes", exact: true }),
    ).toBeEnabled();
    await theme.selectOption("system");
    await expect(page.locator("body")).toHaveCSS(
      "background-color",
      "rgb(255, 255, 255)",
    );
    expect(
      await page.evaluate(() => localStorage.getItem("personal-library.items")),
    ).toBeNull();
  },
);
