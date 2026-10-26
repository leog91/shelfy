import { expect, test } from "./fixtures";

test(
  "incoming capture requires confirmation, warns duplicates, imports bookmarks and bulk-triages",
  { tag: "@mobile" },
  async ({ page }) => {
    await page.goto(
      "/capture#text=" +
        encodeURIComponent("https://example.com/article?keep=1"),
    );
    await expect(
      page.getByRole("textbox", { name: "URL or note" }),
    ).toHaveValue("https://example.com/article?keep=1");
    expect(
      await page.evaluate(() => localStorage.getItem("personal-library.items")),
    ).toBeNull();
    await page.getByRole("button", { name: "Save to Inbox" }).click();
    await expect(page.getByRole("status")).toContainText("Saved");
    await page
      .getByRole("textbox", { name: "URL or note" })
      .fill("https://example.com/article?keep=1");
    await expect(
      page.getByText("Possibly already saved:", { exact: false }),
    ).toBeVisible();
    await page.goto("/all");
    const chooser = page.waitForEvent("filechooser");
    await page
      .getByRole("button", { name: "Import JSON / bookmarks", exact: true })
      .click();
    await (
      await chooser
    ).setFiles({
      name: "bookmarks.html",
      mimeType: "text/html",
      buffer: Buffer.from(
        '<!DOCTYPE NETSCAPE-Bookmark-file-1><DL><DT><A HREF="https://example.com/article?keep=1">Authored bookmark title</A><DT><A HREF="javascript:alert(1)">Unsafe</A><DT><A HREF="https://youtu.be/example">A video</A></DL>',
      ),
    });
    await expect(page.locator(".import-preview")).toContainText(
      "2 valid items, 1 possibly repeated URLs, 1 unsafe/invalid bookmarks skipped",
    );
    await expect(
      page.getByRole("link", { name: "Authored bookmark title", exact: true }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "Confirm additive import" }).click();
    await expect(page.getByRole("status")).toContainText("Imported 2 items");
    await page
      .getByRole("checkbox", { name: "Select visible items (up to 200)" })
      .check();
    await page.getByRole("button", { name: "Move selected to done" }).click();
    await expect(page.locator(".status-done")).toHaveCount(3);
    await page.locator(".filter-options:visible > summary").click();
    await page
      .getByRole("combobox", { name: "Status", exact: true })
      .selectOption("done");
    await expect(
      page.getByRole("link", { name: "Authored bookmark title", exact: true }),
    ).toBeVisible();
    await page.reload();
    await expect(page.locator(".status-done")).toHaveCount(3);
    const manifest = await page.request.get("/manifest.webmanifest");
    expect((await manifest.json()).share_target.action).toBe("/api/share");
    const share = await page.request.post("/api/share", {
      form: {
        title: "A thought",
        text: "Keep selected text",
        url: "https://example.com/source",
      },
      maxRedirects: 0,
    });
    expect(share.status()).toBe(303);
    expect(share.headers().location).toContain("/capture#text=");
    await page.goto("/account");
    await expect(
      page.getByRole("link", { name: "Save to Shelfy", exact: true }),
    ).toHaveAttribute("href", /^javascript:/);
    await expect(
      page.getByRole("link", { name: "Save to Shelfy", exact: true }),
    ).toHaveCSS("background-color", "rgb(54, 93, 70)");
    await expect(page.locator(".account-panel").first()).toHaveCSS(
      "padding-top",
      "20px",
    );
  },
);
