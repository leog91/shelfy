import { expect, test } from "./fixtures";

test("readable link titles and explicitly applied capture details survive reload", async ({
  page,
}) => {
  let previews = 0;
  await page.route("**/api/metadata", async (route) => {
    previews++;
    await route.fulfill({
      json: {
        title: "Gone Is Gone — band",
        description: "An American rock supergroup.",
      },
    });
  });
  await page.goto("/");
  await page
    .getByLabel("URL or note")
    .fill("https://en.wikipedia.org/wiki/Gone_Is_Gone?");
  await expect(
    page.getByText("Link details · Gone Is Gone", { exact: true }),
  ).toBeVisible();
  expect(previews).toBe(0);
  await page.getByText("Link details · Gone Is Gone", { exact: true }).click();
  await page
    .getByRole("button", { name: "Fetch optional link details" })
    .click();
  await expect(
    page.getByText("Gone Is Gone — band", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue(
    "Gone Is Gone",
  );
  await page
    .getByRole("button", { name: "Use suggested title in draft" })
    .click();
  await page
    .getByRole("button", { name: "Use suggested description in draft" })
    .click();
  await page.getByRole("button", { name: "Save to Inbox" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Saved “Gone Is Gone — band”",
  );
  await page.reload();
  await expect(
    page.getByRole("link", { name: "Gone Is Gone — band", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("An American rock supergroup.", { exact: true }),
  ).toBeVisible();
  expect(previews).toBe(1);
});

test("legacy domain titles improve in lists without rewriting saved data", async ({
  page,
}) => {
  const response = await page.request.post("/api/items", {
    headers: { Origin: "http://localhost:3100" },
    data: { text: "https://en.wikipedia.org/wiki/Gone_Is_Gone" },
  });
  expect(response.ok()).toBe(true);
  const { item } = await response.json();
  const patch = await page.request.patch(`/api/items/${item.id}`, {
    headers: { Origin: "http://localhost:3100" },
    data: {
      expectedUpdatedAt: item.updatedAt,
      patch: { title: "en.wikipedia.org" },
    },
  });
  expect(patch.ok()).toBe(true);
  await page.goto("/");
  await expect(
    page.getByRole("link", { name: "Gone Is Gone", exact: true }),
  ).toBeVisible();
  const saved = await page.request.get(`/api/items/${item.id}`);
  expect((await saved.json()).item.title).toBe("en.wikipedia.org");
});
