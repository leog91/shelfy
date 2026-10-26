import { expect, test } from "./fixtures";

test("warn before repeated URLs and notes, allow intentional copies @mobile", async ({
  page,
}) => {
  for (const text of ["https://example.com/", "A repeated thought"]) {
    expect(
      (
        await page.request.post("/api/items", {
          headers: { Origin: "http://localhost:3100" },
          data: { text },
        })
      ).ok(),
    ).toBe(true);
  }
  await page.goto("/");
  const input = page.getByRole("textbox", { name: "URL or note" });
  await input.fill("https://EXAMPLE.com");
  const warning = page.locator(".duplicate-warning:visible");
  await expect(warning).toContainText("Possibly already saved:");
  await expect(warning.getByRole("link")).toHaveAttribute("href", /^\/items\//);
  await expect(input).toHaveAttribute(
    "aria-describedby",
    (await warning.getAttribute("id")) as string,
  );
  await input.fill("https://example.com/?different=1");
  await expect(warning).toHaveCount(0);
  await input.fill("  A repeated thought\n");
  await expect(warning).toContainText("A repeated thought");
  await expect(warning).toContainText("Saving again keeps a separate copy.");
  expect(
    (await (await page.request.get("/api/items")).json()).items,
  ).toHaveLength(2);
  await page.getByRole("button", { name: "Save to Inbox" }).click();
  await expect(page.getByRole("status")).toContainText("Saved");
  expect(
    (await (await page.request.get("/api/items")).json()).items,
  ).toHaveLength(3);
  await expect(warning).toHaveCount(0);
});
