import AxeBuilder from "@axe-core/playwright";
import { type Page } from "@playwright/test";
import { expect, test } from "./fixtures";

async function audit(page: Page) {
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(result.violations).toEqual([]);
}

test(
  "main screens have no automated accessibility violations",
  { tag: "@mobile" },
  async ({ page, isMobile }) => {
    await page.goto("/");
    const capture = page.getByRole("textbox", {
      name: "URL or note",
      exact: true,
    });
    await expect(capture).toBeEditable();
    await capture.fill("https://example.com/accessibility");
    await page.getByRole("button", { name: "Save to Inbox" }).click();
    await expect(page.locator(".item-row")).toHaveCount(1);
    await audit(page);
    if (!isMobile) {
      await page
        .getByRole("link", {
          name: "Open original: example.com (new tab)",
          exact: true,
        })
        .hover();
      await expect(page.getByRole("tooltip")).toHaveText(
        "Open original (new tab)",
      );
      await audit(page);
      await page.keyboard.press("Escape");
    }
    await page
      .getByRole("navigation")
      .getByRole("link", { name: "All items", exact: true })
      .click();
    await expect(page.locator(".item-row")).toHaveCount(1);
    await audit(page);
    await page.locator(".filter-options:visible > summary").click();
    await audit(page);
    await page.locator(".item-title:visible").click();
    await expect(
      page.getByRole("button", { name: "Save changes" }),
    ).toBeVisible();
    await audit(page);
    await page.goto("/account");
    await expect(
      page.getByRole("button", { name: "Sign out", exact: true }),
    ).toBeVisible();
    await audit(page);
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Sign in", exact: true }),
    ).toBeVisible();
    await audit(page);
  },
);

test(
  "icon actions explain hover, focus, touch and preserve focus after triage",
  { tag: "@mobile" },
  async ({ page, isMobile }) => {
    await page.goto("/inbox");
    const capture = page.getByRole("textbox", {
      name: "URL or note",
      exact: true,
    });
    await expect(capture).toBeEditable();
    await capture.fill("Tooltip test note");
    await page.getByRole("button", { name: "Save to Inbox" }).click();
    const later = page.getByRole("button", {
      name: "Move to later: Tooltip test note",
      exact: true,
    });
    await expect(later).toBeVisible();
    for (const button of await page.locator(".icon-button").all()) {
      const box = await button.boundingBox();
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
    if (isMobile) {
      await expect(later.locator(".touch-action-label")).toBeVisible();
    } else {
      for (const [name, text] of [
        ["Move to later", "Move to Later"],
        ["Mark done", "Mark as done"],
        ["Archive", "Archive (keep in library)"],
      ]) {
        const button = page.getByRole("button", {
          name: `${name}: Tooltip test note`,
          exact: true,
        });
        await button.hover();
        await expect(page.getByRole("tooltip")).toHaveText(text);
        await page.getByRole("tooltip").hover();
        await expect(page.getByRole("tooltip")).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(page.getByRole("tooltip")).toHaveCount(0);
      }
      await page.mouse.move(0, 0);
      await later.focus();
      await expect(page.getByRole("tooltip")).toHaveText("Move to Later");
      await page.keyboard.press("Escape");
      await expect(page.getByRole("tooltip")).toHaveCount(0);
    }
    await later.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".item-row")).toHaveCount(0);
    await expect(page.locator("#main")).toBeFocused();
    await expect(page.locator('[aria-live="polite"]').last()).toContainText(
      "moved to Later",
    );
  },
);
