import { handleClipsy } from "@/lib/server/clipsy-runtime";

export async function GET(request: Request) {
  return handleClipsy(request, "summary");
}
