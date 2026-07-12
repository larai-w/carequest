/*
 * Care Quest Service Worker
 *
 * 目的: 電波が不安定な介護現場（病院など）でも、アプリシェルさえ
 * キャッシュされていればオフラインで記録できるようにする。
 * 記録データは localStorage に保存されるため、シェルのキャッシュだけで
 * オフライン完結する。
 *
 * 配信パス: /carequest/sw.js（scope: /carequest/）
 * basePath は public/ 配下のファイルや SW 内部の URL には作用しないため、
 * ここでは URL をすべて /carequest/ プレフィックス付きで明示する。
 */

// キャッシュ名にバージョンを持たせる。デプロイのたびにこの数字を上げると
// activate 時に旧バージョンのキャッシュが削除され、古い HTML を配り続けない。
const VERSION = "v1";
const CACHE_NAME = `carequest-${VERSION}`;

// basePath 配下の公開パス。SW 内では自動付与されないため明示する。
const BASE = "/carequest/";

// プリキャッシュするアプリシェル。オフラインでも最低限これらが開ける。
// 静的アセット（_next/static）はランタイムに cache-first で貯める。
const PRECACHE_URLS = [
  `${BASE}`,
  `${BASE}quest/`,
  `${BASE}reflection/`,
  `${BASE}community/`,
  `${BASE}about/`,
  `${BASE}icon-192.png`,
  `${BASE}icon-512.png`,
  `${BASE}apple-touch-icon.png`,
  `${BASE}manifest.webmanifest`,
];

// インストール時にアプリシェルをプリキャッシュする。
// 一部の URL が失敗しても install 全体を落とさないよう個別に addAll せず握る。
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await Promise.allSettled(
        PRECACHE_URLS.map((url) => cache.add(url)),
      );
      // 新しい SW を即座に有効化する（古い HTML を配り続けないため）。
      await self.skipWaiting();
    })(),
  );
});

// activate 時に旧バージョンのキャッシュを削除する。
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith("carequest-") && key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      );
      // 既存タブを新しい SW の制御下に置く。
      await self.clients.claim();
    })(),
  );
});

// 静的アセットかどうか（cache-first の対象）を判定する。
function isStaticAsset(url) {
  return (
    url.pathname.startsWith(`${BASE}_next/static/`) ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".ico") ||
    url.pathname.endsWith(".webmanifest") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".woff") ||
    url.pathname.endsWith(".woff2")
  );
}

// HTML ナビゲーション: network-first（失敗時キャッシュフォールバック）。
// デプロイ後は最新 HTML を優先的に取りに行くので、古い画面が固定化されない。
async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    // 取得できた HTML はキャッシュを更新しておき、次回オフライン時に使う。
    if (response && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // オフライン時: このリクエストのキャッシュ → シェルのトップ順にフォールバック。
    const cached = await cache.match(request);
    if (cached) return cached;
    const shell = await cache.match(`${BASE}`);
    if (shell) return shell;
    return new Response(
      "オフラインのため、この画面をまだ表示できません。電波のある場所で一度開くと、次からはオフラインでも使えます。",
      {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      },
    );
  }
}

// 静的アセット: cache-first（あればキャッシュ、なければ取得して保存）。
async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok) {
    cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // GET 以外・非同一オリジンは素通しする（localStorage ベースなので API もほぼ無い）。
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // scope 外（/carequest/ 以外）は SW が扱わない。
  if (!url.pathname.startsWith(BASE)) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request));
    return;
  }
  // それ以外は network-first にフォールバック（安全側）。
  event.respondWith(networkFirst(request));
});
