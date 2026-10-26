import { expect, test } from "./fixtures";
import AxeBuilder from "@axe-core/playwright";

test("card picker creates labels, cancels drafts, keeps added dates and labels selections @mobile", async ({
  page,
}) => {
  for (const [text, tags] of [
    ["First labelled note", ["Work", "Keep"]],
    ["Second labelled note", ["Personal"]],
  ] as const) {
    expect(
      (
        await page.request.post("/api/items", {
          headers: { Origin: "http://localhost:3100" },
          data: { text, details: { tags } },
        })
      ).ok(),
    ).toBe(true);
  }
  await page.goto("/notes");
  const first = page.locator(".item-row:visible").filter({
    has: page.getByRole("link", { name: "First labelled note", exact: true }),
  });
  const added = await first.locator("time").getAttribute("datetime");
  await expect(first.locator("time")).toContainText("Added");
  const action = first.locator(".item-label-action");
  await action.getByText("Label", { exact: true }).click();
  await action.getByRole("checkbox", { name: "Personal", exact: true }).check();
  await action.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    first.getByRole("link", { name: "View label: Personal", exact: true }),
  ).toHaveCount(0);
  await action.getByText("Label", { exact: true }).click();
  await expect(
    action.getByRole("checkbox", { name: "Personal", exact: true }),
  ).not.toBeChecked();
  await action
    .getByRole("textbox", { name: "Find or create label", exact: true })
    .fill("Ideas");
  await action
    .getByRole("button", { name: "Create label “Ideas”", exact: true })
    .click();
  await action
    .getByRole("button", { name: "Save labels", exact: true })
    .click();
  await expect(
    first.getByRole("link", { name: "View label: Ideas", exact: true }),
  ).toBeVisible();
  await expect(first.locator("time")).toHaveAttribute("datetime", added!);
  await page
    .getByRole("checkbox", { name: "Select visible items (up to 200)" })
    .check();
  const bulk = page.locator(".bulk-labels:visible");
  await bulk.locator(":scope > summary").click();
  await bulk.getByRole("checkbox", { name: "Ideas", exact: true }).check();
  await bulk
    .getByRole("textbox", { name: "Find or create label", exact: true })
    .fill("Project");
  await bulk
    .getByRole("textbox", { name: "Find or create label", exact: true })
    .press("Enter");
  const results = await new AxeBuilder({ page })
    .include(".bulk-labels")
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations).toEqual([]);
  await bulk
    .getByRole("button", { name: "Add labels to selected", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "View label: Project", exact: true }),
  ).toHaveCount(2);
  await expect(
    first.getByRole("link", { name: "View label: Keep", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("checkbox", { name: "Select visible items (up to 200)" })
    .check();
  await bulk.locator(":scope > summary").click();
  await bulk.getByRole("checkbox", { name: "Ideas", exact: true }).check();
  await bulk
    .getByRole("button", { name: "Remove labels from selected", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "View label: Ideas", exact: true }),
  ).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("link", { name: "View label: Project", exact: true }),
  ).toHaveCount(2);
  await expect(
    first.getByRole("link", { name: "View label: Keep", exact: true }),
  ).toBeVisible();
  await expect(first.locator("time")).toHaveAttribute("datetime", added!);
});

test("capture picker selects existing labels without saving until submit @mobile", async ({
  page,
}) => {
  expect(
    (
      await page.request.post("/api/items", {
        headers: { Origin: "http://localhost:3100" },
        data: { text: "Existing", details: { tags: ["Work"] } },
      })
    ).ok(),
  ).toBe(true);
  await page.goto("/");
  await page
    .getByRole("textbox", { name: "URL or note" })
    .fill("Draft with chosen labels");
  await page.locator(".capture-details > summary").click();
  const picker = page.locator(".capture .label-picker");
  await picker.locator("summary").click();
  await picker.getByRole("checkbox", { name: "Work", exact: true }).check();
  await picker
    .getByRole("textbox", { name: "Find or create label", exact: true })
    .fill("New label");
  await picker
    .getByRole("button", { name: "Create label “New label”", exact: true })
    .click();
  expect(
    (await (await page.request.get("/api/items")).json()).items,
  ).toHaveLength(1);
  await page.getByRole("button", { name: "Save to Inbox" }).click();
  await expect(page.getByRole("status")).toContainText("Saved");
  const exported = (await (await page.request.get("/api/items")).json()).items;
  expect(
    exported.find(
      (item: { content: string }) =>
        item.content === "Draft with chosen labels",
    ).tags,
  ).toEqual(["Work", "New label"]);
});

test("browse overlapping labels via sidebar and chips, reload and history @mobile", async ({
  page,
  context,
}) => {
  const label = "Work / café & C++";
  for (const [text, tags] of [
    ["Shared note", [label, "Design"]],
    ["Design only", ["Design"]],
    ["Deleted only", ["Trash only"]],
  ] as const) {
    const response = await page.request.post("/api/items", {
      headers: { Origin: "http://localhost:3100" },
      data: { text, details: { tags } },
    });
    expect(response.ok()).toBe(true);
    if (text === "Deleted only") {
      const { item } = await response.json();
      const deleted = await page.request.delete(`/api/items/${item.id}`, {
        headers: { Origin: "http://localhost:3100" },
        data: { expectedUpdatedAt: item.updatedAt },
      });
      expect(deleted.ok()).toBe(true);
    }
  }
  await page.goto("/all");
  const nav = page.getByRole("navigation", { name: "Labels", exact: true });
  await expect(
    nav.getByRole("link", { name: "Trash only", exact: true }),
  ).toHaveCount(0);
  await page.locator(".sidebar-labels > summary").click();
  await expect(nav).not.toBeVisible();
  await page.locator(".sidebar-labels > summary").click();
  await nav.getByRole("link", { name: label, exact: true }).click();
  await expect(
    page.getByRole("heading", { name: `Label: ${label}`, exact: true }),
  ).toBeVisible();
  await expect(page.locator(".item-row:visible")).toHaveCount(1);
  await expect(
    nav.getByRole("link", { name: label, exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await page.reload();
  await expect(page.locator(".item-row:visible")).toHaveCount(1);
  await page
    .getByRole("link", { name: "View label: Design", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".item-row:visible")).toHaveCount(2);
  expect(context.pages()).toHaveLength(1);
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: `Label: ${label}`, exact: true }),
  ).toBeVisible();
  await expect(page.locator(".item-row:visible")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  await expect(page).toHaveURL(/\/all$/);
  await expect(page.locator(".item-row:visible")).toHaveCount(2);
});

test("capture and edit multiple note labels @mobile", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("URL or note").fill("Labelled capture");
  await page.locator(".capture-details > summary").click();
  await page
    .getByRole("textbox", { name: "Labels", exact: false })
    .fill("Work, Personal");
  await page.getByRole("button", { name: "Save to Inbox" }).click();
  await expect(page.getByRole("status")).toContainText("Saved");
  await page
    .getByRole("link", { name: "Edit: Labelled capture", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Labels", exact: false }),
  ).toHaveValue("Work, Personal");
  await page
    .getByRole("textbox", { name: "Labels", exact: false })
    .fill("Personal, Ideas");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Changes saved.");
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "Labels", exact: false }),
  ).toHaveValue("Personal, Ideas");
  const nav = page.getByRole("navigation", { name: "Labels", exact: true });
  await expect(
    nav.getByRole("link", { name: "Work", exact: true }),
  ).toHaveCount(0);
  await expect(
    nav.getByRole("link", { name: "Ideas", exact: true }),
  ).toBeVisible();
});
