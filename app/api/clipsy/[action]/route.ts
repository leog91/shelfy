import { handleClipsy } from "@/lib/server/clipsy-runtime";

type Context = { params: Promise<{ action: string }> };
export async function GET(request: Request, context: Context) {
  return handleClipsy(request, (await context.params).action);
}
export async function POST(request: Request, context: Context) {
  return handleClipsy(request, (await context.params).action);
}
