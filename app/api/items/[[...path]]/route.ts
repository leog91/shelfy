import { getRuntime } from "@/lib/server/runtime";
import { apiError, createItemApi } from "@/lib/server/item-api";

async function handle(request: Request) {
  try {
    const { db, auth, origin } = getRuntime();
    return createItemApi({
      db,
      origin,
      resolveUser: async (request) =>
        (await auth.api.getSession({ headers: request.headers }))?.user.id ??
        null,
    })(request);
  } catch (error) {
    return apiError(error);
  }
}
export { handle as GET, handle as POST, handle as PATCH, handle as DELETE };
