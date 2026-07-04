"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const navItems = [
  { href: "/", label: "ホーム" },
  { href: "/quest", label: "クエスト" },
  { href: "/community", label: "みんな" },
  { href: "/reflection", label: "ふりかえり" },
  { href: "/about", label: "About" },
];

export default function Layout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#fff7ed,_#fdf2f8_60%,_#fef3c7)] text-stone-700">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-4 pb-24 pt-6 sm:px-6 lg:px-8">
        <header className="mb-6 rounded-[28px] border border-white/70 bg-white/80 px-4 py-4 shadow-sm backdrop-blur">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-600">
                Care Quest
              </p>
              <h1 className="text-lg font-semibold text-stone-800">今日も、少しだけやさしく</h1>
            </div>
            <div className="rounded-full bg-amber-100 px-3 py-1 text-sm text-amber-700">
              MVP
            </div>
          </div>
        </header>

        <main className="flex-1">{children}</main>

        <nav className="fixed bottom-3 left-1/2 z-20 flex w-[calc(100%-1.5rem)] max-w-4xl -translate-x-1/2 overflow-hidden rounded-full border border-white/70 bg-white/90 px-2 py-2 shadow-lg backdrop-blur">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex-1 rounded-full px-2 py-2 text-center text-sm font-medium transition ${
                  active ? "bg-amber-500 text-white" : "text-stone-600"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
