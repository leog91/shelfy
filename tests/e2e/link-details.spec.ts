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

test("keyword tags stay optional, merge into drafts and persist only on save", async ({
  page,
}) => {
  await page.route("**/api/metadata", (route) =>
    route.fulfill({
      json: {
        title: "Code a simple RAG from scratch",
        description:
          "Build a retrieval-augmented generation system using Python and Ollama.",
      },
    }),
  );
  await page.goto("/");
  await page
    .getByLabel("URL or note")
    .fill("https://huggingface.co/blog/ngxson/make-your-own-rag");
  await page.locator(".capture-details > summary").click();
  const tags = page.getByRole("textbox", { name: "Labels", exact: false });
  await tags.fill("Projects, ai");
  await page.getByLabel("Title", { exact: true }).fill("My custom title");
  await page
    .getByRole("button", { name: "Fetch optional link details" })
    .click();
  await expect(
    page.getByText("Suggested labels: AI, RAG, Python, Tutorials", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(tags).toHaveValue("Projects, ai");
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue(
    "My custom title",
  );
  await page
    .getByRole("button", { name: "Add suggested labels to draft" })
    .click();
  await page
    .getByRole("button", { name: "Add suggested labels to draft" })
    .click();
  await expect(tags).toHaveValue("Projects, ai, RAG, Python, Tutorials");
  expect(
    (await (await page.request.get("/api/items/export")).json()).items,
  ).toEqual([]);
  await page.getByRole("button", { name: "Save to Inbox" }).click();
  await expect(page.getByRole("status")).toContainText("Saved");
  await page.reload();
  const exported = (await (await page.request.get("/api/items/export")).json())
    .items;
  expect(exported[0].tags).toEqual([
    "Projects",
    "ai",
    "RAG",
    "Python",
    "Tutorials",
  ]);
  expect(exported[0].title).toBe("My custom title");
  await page
    .getByRole("link", { name: "Edit: My custom title", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Labels", exact: false })
    .fill("Keep, python");
  await page
    .getByRole("button", { name: "Fetch optional link details" })
    .click();
  await page
    .getByRole("button", { name: "Add suggested labels to draft" })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Labels", exact: false }),
  ).toHaveValue("Keep, python, AI, RAG, Tutorials");
  expect(
    (await (await page.request.get("/api/items/export")).json()).items[0].tags,
  ).toEqual(exported[0].tags);
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Changes saved.");
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "Labels", exact: false }),
  ).toHaveValue("Keep, python, AI, RAG, Tutorials");
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
