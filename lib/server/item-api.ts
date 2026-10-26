import { z, ZodError } from "zod";
import type { Database } from "../db/connection";
import { envelopeSchema, intents, itemSchema, ItemPatch } from "../items/model";
import { serializeLibrary } from "../items/repository";
import { HttpError, ServerItems } from "./items";

const shape = itemSchema.shape;
const patchSchema = z
  .object({
    title: shape.title,
    type: shape.type,
    intent: shape.intent,
    status: shape.status,
    url: shape.url.nullable(),
    content: shape.content.nullable(),
    description: shape.description.nullable(),
    tags: shape.tags,
    source: shape.source.nullable(),
    reminderAt: shape.reminderAt.nullable(),
  })
  .partial()
  .strict();
const editSchema = z
  .object({ patch: patchSchema, expectedUpdatedAt: z.iso.datetime() })
  .strict();
const captureSchema = z
  .object({
    text: z.string().min(1).max(200000),
    intent: z.enum(intents).optional(),
    details: z
      .object({
        title: shape.title.optional(),
        description: shape.description,
        tags: shape.tags.optional(),
      })
      .strict()
      .optional(),
  })
  .strict();
const deleteSchema = z.object({ expectedUpdatedAt: z.iso.datetime() }).strict();
const selectionSchema = z
  .array(
    z.object({ id: z.uuid(), expectedUpdatedAt: z.iso.datetime() }).strict(),
  )
  .min(1)
  .max(200)
  .refine(
    (selected) =>
      new Set(selected.map((item) => item.id)).size === selected.length,
    "Select distinct items.",
  );

export async function readJson(
  request: Request,
  maxBytes = 1024 * 1024,
): Promise<unknown> {
  if (
    !request.headers
      .get("content-type")
      ?.toLowerCase()
      .startsWith("application/json")
  )
    throw new HttpError(415, "Send application/json.");
  if (Number(request.headers.get("content-length")) > maxBytes)
    throw new HttpError(413, "Request is too large.");
  if (!request.body) throw new HttpError(400, "JSON body is required.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new HttpError(413, "Request is too large.");
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, "Invalid JSON. No items were changed.");
  }
}
export function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      Vary: "Cookie",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
export function apiError(error: unknown) {
  if (error instanceof HttpError)
    return json({ error: error.message }, error.status);
  if (error instanceof ZodError)
    return json(
      {
        error:
          "Invalid fields or library format. Check title, URL, note content, timestamps and field limits. No changes were saved.",
      },
      400,
    );
  // Deliberately omit DB errors, tokens and personal content from responses/logs.
  return json(
    {
      error:
        "Account storage is unavailable. Your changes were not saved. Retry later.",
    },
    503,
  );
}
export function createItemApi(options: {
  db: Database;
  origin: string;
  resolveUser: (request: Request) => Promise<string | null>;
}) {
  return async function handle(request: Request): Promise<Response> {
    try {
      if (
        !["GET", "HEAD"].includes(request.method) &&
        request.headers.get("origin") !== options.origin
      )
        throw new HttpError(
          403,
          "Use the configured app origin for account changes.",
        );
      const owner = await options.resolveUser(request);
      if (!owner)
        throw new HttpError(401, "Sign in to access your account library.");
      const expectedAccount = request.headers.get("x-workspace-id");
      if (expectedAccount && expectedAccount !== owner)
        throw new HttpError(
          401,
          "Your account changed in another tab. Reload to select the correct workspace.",
        );
      const service = new ServerItems(options.db, owner);
      const path = new URL(request.url).pathname.replace(
        /^\/api\/items\/?/,
        "",
      );
      if (path === "" && request.method === "GET")
        return json({ version: 3, items: await service.list() });
      if (path === "" && request.method === "POST") {
        const input = captureSchema.parse(await readJson(request));
        return json(
          {
            item: await service.create(input.text, input.intent, input.details),
          },
          201,
        );
      }
      if (path === "export" && request.method === "GET")
        return new Response(serializeLibrary(await service.list()), {
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "private, no-store",
            Vary: "Cookie",
            "Content-Disposition": 'attachment; filename="library.json"',
          },
        });
      if (path === "import" && request.method === "POST") {
        const library = envelopeSchema.parse(
          await readJson(request, 10 * 1024 * 1024),
        );
        if (library.items.length > 5000)
          throw new HttpError(413, "Import at most 5,000 items at a time.");
        return json(await service.import(library.items));
      }
      if (path === "bulk" && request.method === "POST") {
        const input = z
          .object({
            selected: selectionSchema,
            status: shape.status,
          })
          .strict()
          .parse(await readJson(request));
        if (
          new Set(input.selected.map((item) => item.id)).size !==
          input.selected.length
        )
          throw new HttpError(400, "Select distinct items.");
        await service.bulkUpdate(input.selected, input.status);
        return json({ updated: input.selected.length });
      }
      if (path === "bulk-labels" && request.method === "POST") {
        const input = z
          .object({
            selected: selectionSchema,
            labels: shape.tags.refine(
              (labels) => labels.length > 0,
              "Choose at least one label.",
            ),
            operation: z.enum(["add", "remove"]),
          })
          .strict()
          .parse(await readJson(request));
        return json({
          items: await service.bulkLabels(
            input.selected,
            input.labels,
            input.operation,
          ),
        });
      }
      const [itemId, action, ...extra] = path.split("/");
      const id = z.uuid().safeParse(itemId);
      if (!id.success) throw new HttpError(404, "Endpoint not found.");
      if (action) {
        if (extra.length || !["restore", "permanent"].includes(action))
          throw new HttpError(404, "Endpoint not found.");
        if (
          (action === "restore" && request.method !== "POST") ||
          (action === "permanent" && request.method !== "DELETE")
        )
          throw new HttpError(405, "Method not allowed.");
        const input = deleteSchema.parse(await readJson(request));
        if (action === "restore")
          return json({
            item: await service.restore(id.data, input.expectedUpdatedAt),
          });
        await service.permanentlyDelete(id.data, input.expectedUpdatedAt);
        return json({ deleted: true });
      }
      if (request.method === "GET")
        return json({ item: await service.get(id.data) });
      if (request.method === "PATCH") {
        const input = editSchema.parse(await readJson(request));
        const patch = Object.fromEntries(
          Object.entries(input.patch).map(([key, value]) => [
            key,
            value === null ? undefined : value,
          ]),
        ) as ItemPatch;
        return json({
          item: await service.update(id.data, patch, input.expectedUpdatedAt),
        });
      }
      if (request.method === "DELETE") {
        const input = deleteSchema.parse(await readJson(request));
        return json({
          item: await service.delete(id.data, input.expectedUpdatedAt),
        });
      }
      throw new HttpError(405, "Method not allowed.");
    } catch (error) {
      return apiError(error);
    }
  };
}
