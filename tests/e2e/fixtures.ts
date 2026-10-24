import { test as base, expect } from "@playwright/test";

export const test = base.extend<{ signedIn: boolean; accountSetup: void }>({
  signedIn: [true, { option: true }],
  accountSetup: [
    async ({ page, signedIn }, use) => {
      // Isolate the simulated clients' auth rate-limit buckets without disabling limits.
      const bytes = crypto.getRandomValues(new Uint8Array(3));
      await page.context().setExtraHTTPHeaders({
        "X-Forwarded-For": `192.${bytes[0]}.${bytes[1]}.${bytes[2]}`,
      });
      if (signedIn) {
        const response = await page.request.post("/api/auth/sign-up/email", {
          headers: { Origin: "http://localhost:3100" },
          data: {
            name: "Test owner",
            email: `test-${crypto.randomUUID()}@example.test`,
            password: "test-only-password-123",
          },
        });
        expect(response.ok()).toBe(true);
      }
      await use();
    },
    { auto: true },
  ],
});

export { expect };
