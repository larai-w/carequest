import type { MetadataRoute } from "next";

// output: "export" では metadata route に force-static の明示が必要です。
export const dynamic = "force-static";

// 静的エクスポート + basePath 配下のため、URL は /carequest/ を明示します。
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Care Quest",
    short_name: "Care Quest",
    description: "家族介護者のためのやさしい支援アプリ",
    lang: "ja",
    start_url: "/carequest/",
    scope: "/carequest/",
    display: "standalone",
    background_color: "#fff7ed",
    theme_color: "#f59e0b",
    icons: [
      {
        src: "/carequest/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/carequest/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/carequest/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
