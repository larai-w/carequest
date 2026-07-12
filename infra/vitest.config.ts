import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // test/ 配下の .test.ts / .test.js をすべて対象にする
    include: ['test/**/*.test.{ts,js}'],
    // Node 環境で実行(ブラウザ不要)
    environment: 'node',
    // 各テストファイルを独立した vm コンテキストで実行
    // (vi.resetModules() によるモジュールキャッシュ破棄を有効にするため)
    isolate: true,
    // グローバルな expect / describe / it を使えるようにする
    globals: false,
  },
});
