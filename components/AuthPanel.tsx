"use client";

import { useEffect, useState } from "react";
import { setSignedInFlag, SIGNED_IN_FLAG_KEY } from "@/lib/api";

export default function AuthPanel() {
  const [email, setEmail] = useState("demo@example.com");
  const [password, setPassword] = useState("CareQuest123!");
  const [message, setMessage] = useState("ログインして、あなたの記録をクラウドへつなぎましょう。");
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [currentUsername, setCurrentUsername] = useState<string | null>(null);

  const handleSignIn = async () => {
    try {
      // 認証 SDK はこの操作の瞬間に初めて動的 import する(初期バンドルには含めない・T45)。
      const { ensureAmplifyConfigured } = await import("@/lib/amplify");
      await ensureAmplifyConfigured();
      const { signIn } = await import("@aws-amplify/auth");
      await signIn({ username: email, password });
      setSignedInFlag(true);
      setIsSignedIn(true);
      setCurrentUsername(email);
      setMessage("ログインしました。次はデータをクラウドへ保存できます。");
    } catch {
      setMessage("ログインに失敗しました。ユーザー情報を確認してください。");
    }
  };

  const handleSignOut = async () => {
    try {
      const { ensureAmplifyConfigured } = await import("@/lib/amplify");
      await ensureAmplifyConfigured();
      const { signOut } = await import("@aws-amplify/auth");
      await signOut();
      setSignedInFlag(false);
      setIsSignedIn(false);
      setCurrentUsername(null);
      setMessage("ログアウトしました。");
    } catch {
      setMessage("ログアウトに失敗しました。");
    }
  };

  const handleCheckUser = async () => {
    try {
      const { ensureAmplifyConfigured } = await import("@/lib/amplify");
      await ensureAmplifyConfigured();
      const { getCurrentUser } = await import("@aws-amplify/auth");
      const user = await getCurrentUser();
      const currentUser = user as { username?: string };
      setCurrentUsername(currentUser.username ?? null);
      setMessage(`ログイン中です: ${currentUser.username ?? "ユーザー"}`);
      setIsSignedIn(true);
      // 実セッションが確認できたので軽量フラグを同期させる。
      setSignedInFlag(true);
    } catch {
      setCurrentUsername(null);
      setMessage("まだログインしていません。");
      setIsSignedIn(false);
      // 実セッションが無いのでフラグも下ろす(不整合の掃除)。
      setSignedInFlag(false);
    }
  };

  useEffect(() => {
    // マウント時は認証 SDK を読み込まない(初期表示・hydration を遅らせないため・T45)。
    // localStorage の軽量フラグだけを見て「未ログイン」の初期表示を確定させる。
    // フラグがある場合でも SDK は読まず、UI 上は控えめに「ログイン済みかもしれない」
    // 状態を示すだけに留め、実セッション確認はユーザーが「状態確認」を押した時に行う。
    // 初回レンダー(SSR/hydration)は常に「未ログイン」で描画し、hydration 後に
    // フラグを読んで差し替える(mismatch とレイアウトシフトを避ける)。
    const readFlag = async () => {
      try {
        if (window.localStorage.getItem(SIGNED_IN_FLAG_KEY) === "1") {
          setIsSignedIn(true);
          setMessage("前回ログインしていました。「状態確認」でセッションを確認できます。");
        }
      } catch {
        // localStorage 不可。未ログイン表示のままにする(安全側)。
      }
    };
    readFlag();
  }, []);

  return (
    <section className="rounded-[28px] border border-stone-200 bg-white/80 p-4 shadow-sm">
      <h2 className="text-lg font-semibold text-stone-800">ログイン</h2>
      <p className="mt-1 text-sm text-stone-600">Cognito でサインインできます。</p>
      <div className="mt-3 space-y-3">
        <input value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-3 py-3 text-sm" placeholder="email" />
        <input value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-3 py-3 text-sm" placeholder="password" type="password" />
        <div className="flex gap-2">
          <button type="button" onClick={handleSignIn} className="rounded-full bg-stone-800 px-4 py-2 text-sm font-semibold text-white">サインイン</button>
          <button type="button" onClick={handleCheckUser} className="rounded-full bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-700">状態確認</button>
          <button type="button" onClick={handleSignOut} className="rounded-full bg-stone-100 px-4 py-2 text-sm font-semibold text-stone-700">サインアウト</button>
        </div>
        <p className="text-sm text-stone-600">{message}</p>
        <p className="text-sm text-stone-500">
          {isSignedIn ? `ログイン済み: ${currentUsername ?? "ユーザー"}` : "未ログイン"}
        </p>
      </div>
    </section>
  );
}
