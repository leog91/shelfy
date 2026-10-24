import { Suspense } from "react";
import { ItemDetail } from "@/components/item-editor";
import { AccountGate } from "@/components/account-gate";

async function Detail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <AccountGate>
      <ItemDetail id={id} />
    </AccountGate>
  );
}
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p>Loading item…</p>}>
      <Detail params={params} />
    </Suspense>
  );
}
