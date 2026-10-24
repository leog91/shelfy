import { LibraryView } from "@/components/library-view";
import { AccountGate } from "@/components/account-gate";

export default function Page() {
  return (
    <AccountGate>
      <LibraryView view="dashboard" />
    </AccountGate>
  );
}
