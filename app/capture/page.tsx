import { Suspense } from "react";
import { IncomingCapture } from "@/components/incoming-capture";
import { safeUrl } from "@/lib/items/model";
import { AccountGate } from "@/components/account-gate";

async function Incoming({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const incoming =
    typeof params.text === "string" ? params.text.slice(0, 6000) : "";
  const url =
    typeof params.url === "string" && safeUrl(params.url)
      ? params.url.slice(0, 10000)
      : "";
  const title =
    typeof params.title === "string" ? params.title.slice(0, 500) : "";
  const text =
    url && incoming && incoming !== url
      ? `${title || "Shared page"}\n${incoming}\n\nSource: ${url}`
      : incoming || url;
  return (
    <AccountGate>
      <header className="page-heading">
        <h1>Add item</h1>
        <p>Review before saving. No item has been added yet.</p>
      </header>
      <IncomingCapture initialText={text} />
    </AccountGate>
  );
}
export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<p role="status">Preparing capture…</p>}>
      <Incoming searchParams={searchParams} />
    </Suspense>
  );
}
