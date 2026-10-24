import { getRuntime } from "@/lib/server/runtime";
import { json } from "@/lib/server/item-api";

async function handle(request: Request) {
  try {
    const response = await getRuntime().auth.handler(request);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch {
    return json(
      {
        message:
          "Account service is unavailable. Check server configuration and database migrations.",
      },
      503,
    );
  }
}
export { handle as GET, handle as POST };
