import { notFound } from "next/navigation";
import { LibraryView } from "@/components/library-view";
import { views } from "@/lib/items/model";
import { Suspense } from "react";
import { AccountGate } from "@/components/account-gate";

export function generateStaticParams() {
  return views.filter((view) => view !== "dashboard").map((view) => ({ view }));
}
async function SelectedView({ params }: { params: Promise<{ view: string }> }) {
  const { view } = await params;
  const validView = views.find(
    (value) => value === view && value !== "dashboard",
  );
  if (!validView) notFound();
  return (
    <AccountGate>
      <LibraryView key={validView} view={validView} />
    </AccountGate>
  );
}
export default function Page({
  params,
}: {
  params: Promise<{ view: string }>;
}) {
  return (
    <Suspense fallback={<p role="status">Loading view…</p>}>
      <SelectedView params={params} />
    </Suspense>
  );
}
