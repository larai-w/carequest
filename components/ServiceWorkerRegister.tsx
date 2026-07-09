"use client";

import { useEffect } from "react";

/**
 * Service Worker を登録するクライアントコンポーネント。
 *
 * 設計上の注意:
 * - 非対応ブラウザで一切壊れないよう、`serviceWorker` が存在する場合のみ動く。
 * - 開発時（next dev）は SW を登録せず、むしろ既存の登録を解除する。
 *   静的エクスポートの本番ビルドとは挙動が異なり、キャッシュが開発の邪魔を
 *   しないようにするため。
 * - basePath は SW の URL や scope には自動付与されないため、
 *   登録パス・scope をすべて /carequest/ プレフィックス付きで明示する。
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    // 開発時（localhost / 127.0.0.1、または NODE_ENV !== production）は
    // SW を登録しない。既に登録があれば解除してキャッシュの影響を消す。
    const isLocalhost =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";
    const isDev = process.env.NODE_ENV !== "production";

    if (isDev || isLocalhost) {
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => {
          for (const registration of registrations) {
            registration.unregister();
          }
        })
        .catch(() => {
          // 解除できなくても致命的ではないので静かに無視する。
        });
      return;
    }

    // 本番: /carequest/sw.js を scope /carequest/ で登録する。
    const register = () => {
      navigator.serviceWorker
        .register("/carequest/sw.js", { scope: "/carequest/" })
        .catch(() => {
          // 登録に失敗してもアプリ本体は localStorage で動くので静かに無視する。
        });
    };

    // 初期表示の描画を優先し、読み込み完了後に登録する。
    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
