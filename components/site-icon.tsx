import { ShoppingBag } from "lucide-react";
import type { LinkSite } from "@/lib/items/link-sites";

// Local SVGs only: no remote favicon requests or saved-URL disclosure.
// The adjacent site label supplies the accessible name.
export function SiteIcon({ site }: { site: LinkSite }) {
  if (site.icon === "shop") return <ShoppingBag size={18} aria-hidden="true" />;
  if (site.icon === "youtube")
    return (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        aria-hidden="true"
      >
        <rect x="2" y="5" width="20" height="14" rx="4" />
        <path d="m10 9 6 3-6 3V9Z" />
      </svg>
    );
  if (site.icon === "reddit")
    return (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        aria-hidden="true"
      >
        <path d="m12 9 2-6 4 1 M5 11c-4-2-5 3-2 4 M19 11c4-2 5 3 2 4" />
        <circle cx="19.5" cy="4" r="1.5" />
        <ellipse cx="12" cy="15" rx="9" ry="6" />
        <circle cx="8.5" cy="14" r=".8" fill="currentColor" />
        <circle cx="15.5" cy="14" r=".8" fill="currentColor" />
        <path d="M8 17c2 2 6 2 8 0" />
      </svg>
    );
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
    >
      <path d="M4 3h4.5L20 21h-4.5L4 3Z M20 3 4 21" />
    </svg>
  );
}
