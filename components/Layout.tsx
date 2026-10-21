"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { PRODUCT_NAME } from "@/lib/brand";

type NavIcon = "home" | "quest" | "community" | "reflection" | "about";

const navItems: { href: string; label: string; icon: NavIcon }[] = [
  { href: "/", label: "ホーム", icon: "home" },
  { href: "/quest", label: "クエスト", icon: "quest" },
  { href: "/community", label: "あゆみ", icon: "community" },
  { href: "/reflection", label: "ふりかえり", icon: "reflection" },
  { href: "/about", label: "About", icon: "about" },
];

// 線だけの簡単なアイコン。意味はラベルの文字で伝えるので、読み上げからは外す。
const iconPaths: Record<NavIcon, ReactNode> = {
  home: (
    <>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V20h14V9.5" />
      <path d="M10 20v-6h4v6" />
    </>
  ),
  quest: (
    <>
      <path d="M5 21V4" />
      <path d="M5 4h12l-2.5 4L17 12H5" />
    </>
  ),
  community: <path d="M3 20h5v-4h4v-4h4V8h5" />,
  reflection: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M9 8h6M9 12h6M9 16h3" />
    </>
  ),
  about: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <path d="M12 7.5h.01" />
    </>
  ),
};

export default function Layout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#fff7ed,_#fdf2f8_60%,_#fef3c7)] text-stone-700">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-4 pb-[var(--bottom-nav-space)] pt-6 sm:px-6 lg:px-8">
        <header className="mb-6 rounded-[28px] border border-white/70 bg-white/80 px-4 py-4 shadow-sm backdrop-blur">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-700">
                {PRODUCT_NAME}
              </p>
              <h1 className="text-lg font-semibold text-stone-800">今日も、少しだけやさしく</h1>
            </div>
            <div className="rounded-full bg-amber-100 px-3 py-1 text-sm text-amber-700">
              MVP
            </div>
          </div>
        </header>

        <main className="flex-1">{children}</main>

        <nav
          aria-label="メインナビゲーション"
          className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 gap-[2px] border-t border-amber-100 bg-white/95 px-[max(4px,calc((100%-56rem)/2))] pb-[max(4px,env(safe-area-inset-bottom))] pt-[4px] shadow-[0_-4px_16px_rgba(120,53,15,0.08)] backdrop-blur"
        >
          {navItems.map((item) => {
            const active = pathname.replace(/\/$/, "") === item.href.replace(/\/$/, "");
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`@container flex min-h-[44px] min-w-0 flex-col items-center justify-center gap-[2px] rounded-xl px-[2px] py-[4px] text-center font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-1 ${
                  active ? "bg-amber-700 text-white" : "text-stone-600 hover:bg-amber-50"
                }`}
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="size-[min(1.5rem,32px)] shrink-0"
                >
                  {iconPaths[item.icon]}
                </svg>
                {/* 文字を大きくしても途中で折り返さないよう、ボタンの幅に収まる大きさ（390px 幅でおよそ 14px）を上限にする */}
                <span className="block max-w-full whitespace-nowrap text-[length:min(0.875rem,19.5cqi)] leading-tight">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
