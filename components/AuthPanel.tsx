"use client";

import { useEffect, useState } from "react";
import { signIn, signOut, getCurrentUser } from "@aws-amplify/auth";
import "@/lib/amplify";

export default function AuthPanel() {
  const [email, setEmail] = useState("demo@example.com");
  const [password, setPassword] = useState("CareQuest123!");
  const [message, setMessage] = useState("ログインして、あなたの記録をクラウドへつなぎましょう。");
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [currentUsername, setCurrentUsername] = useState<string | null>(null);

  const handleSignIn = async () => {
    try {
      await signIn({ username: email, password });
      setIsSignedIn(true);
      setCurrentUsername(email);
      setMessage("ログインしました。次はデータをクラウドへ保存できます。");
    } catch {
      setMessage("ログインに失敗しました。ユーザー情報を確認してください。");
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      setIsSignedIn(false);
      setCurrentUsername(null);
      setMessage("ログアウトしました。");
    } catch {
      setMessage("ログアウトに失敗しました。");
    }
  };

  const handleCheckUser = async () => {
    try {
      const user = await getCurrentUser();
      const currentUser = user as { username?: string };
      setCurrentUsername(currentUser.username ?? null);
      setMessage(`ログイン中です: ${currentUser.username ?? "ユーザー"}`);
      setIsSignedIn(true);
    } catch {
      setCurrentUsername(null);
      setMessage("まだログインしていません。");
      setIsSignedIn(false);
    }
  };

  useEffect(() => {
    const checkUser = async () => {
      await handleCheckUser();
    };
    checkUser();
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
