import type { Metadata, Viewport } from "next";
import { LibraryProvider } from "@/components/library-provider";
import { AppShell } from "@/components/app-shell";
import { InteractionProvider } from "@/components/tooltip";
import "./globals.css";

export const metadata: Metadata = {
  icons: {
    icon: { url: "/icon.svg", type: "image/svg+xml" },
    apple: "/library-192.png",
  },
  title: "Shelfy",
  description: "Personal links, notes, and saved items.",
};
export const viewport: Viewport = { themeColor: "#365d46" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>
        <LibraryProvider>
          <InteractionProvider>
            <AppShell>{children}</AppShell>
          </InteractionProvider>
        </LibraryProvider>
      </body>
    </html>
  );
}
