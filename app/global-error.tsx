"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  // global-error はルートレイアウトごと置き換わるため html/body を含める必要がある。
  // globals.css が読み込まれない可能性があるため、スタイルはインラインで記述する。
  return (
    <html lang="ja">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          background: "#fffaf3",
          color: "#3f3428",
          fontFamily: "Arial, Helvetica, sans-serif",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1.5rem",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: "28rem",
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
          }}
        >
          <div
            style={{
              borderRadius: "28px",
              border: "1px solid #e7e5e4",
              background: "rgba(255,255,255,0.85)",
              padding: "1.5rem",
              boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
            }}
          >
            <p
              style={{
                fontSize: "0.65rem",
                fontWeight: 700,
                letterSpacing: "0.3em",
                textTransform: "uppercase",
                color: "#d97706",
                marginBottom: "0.5rem",
              }}
            >
              Care Quest
            </p>
            <h1
              style={{
                fontSize: "1.125rem",
                fontWeight: 600,
                color: "#292524",
                margin: "0 0 0.75rem",
              }}
            >
              アプリの読み込みに失敗しました
            </h1>
            <p
              style={{
                fontSize: "0.875rem",
                lineHeight: 1.75,
                color: "#57534e",
                margin: 0,
              }}
            >
              あなたの記録は端末にちゃんと残っています。データが消えたわけではないので、安心してください。ページを再読み込みするか、時間をおいてもう一度お試しください。
            </p>
          </div>

          <button
            type="button"
            onClick={() => unstable_retry()}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "24px",
              background: "#292524",
              color: "#fff",
              border: "none",
              padding: "0.75rem 1rem",
              fontSize: "0.875rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            もういちど試す
          </button>

          <Link
            href="/"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "24px",
              border: "1px solid #e7e5e4",
              background: "rgba(255,255,255,0.85)",
              color: "#44403c",
              padding: "0.75rem 1rem",
              fontSize: "0.875rem",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            ホームへ戻る
          </Link>
        </div>
      </body>
    </html>
  );
}
