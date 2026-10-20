import type { Metadata, Viewport } from "next";
import "./globals.css";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import { PRODUCT_NAME } from "@/lib/brand";

export const metadata: Metadata = {
  title: PRODUCT_NAME,
  description: "家族介護者のためのやさしい支援アプリ",
  // アプリ本体は検索インデックス対象外(集客は /apps/carequest/ の紹介ページで行う)
  robots: { index: false, follow: false },
  icons: {
    // metadata の icons には basePath が付与されないため、本番パスを明示します。
    icon: [{ url: "/carequest/favicon.png", sizes: "64x64", type: "image/png" }],
    apple: "/carequest/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    title: PRODUCT_NAME,
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#f59e0b",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
