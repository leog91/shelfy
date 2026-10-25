import "server-only";
import { getRuntime } from "./runtime";
import { createClipsyApi } from "./clipsy-api";
import { json } from "./item-api";

export async function handleClipsy(request: Request, action: string) {
  try {
    const { db, auth, origin } = getRuntime();
    return await createClipsyApi({
      db,
      origin,
      secret: process.env.BETTER_AUTH_SECRET ?? "",
      clipsyUrl: process.env.CLIPSY_URL,
      resolveSession: (request) =>
        auth.api.getSession({ headers: request.headers }),
    })(request, action);
  } catch {
    return json(
      { error: "Clipsy connection is unavailable. Try again later." },
      503,
    );
  }
}
