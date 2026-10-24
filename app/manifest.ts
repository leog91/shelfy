import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Shelfy",
    short_name: "Shelfy",
    description: "Personal links, notes, and saved items.",
    start_url: "/",
    display: "standalone",
    background_color: "#faf9f6",
    theme_color: "#365d46",
    icons: [
      {
        src: "/library-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/library-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/library-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
    share_target: {
      action: "/api/share",
      method: "POST",
      enctype: "application/x-www-form-urlencoded",
      params: { title: "title", text: "text", url: "url" },
    },
  };
}
