import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "infra/cdk.out/**",
    "infra/dist/**",
    // Lambda ランタイム用の CommonJS。ルート(Next.js 用)の lint 対象外。
    "infra/lambda/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
