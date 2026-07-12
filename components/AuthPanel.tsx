"use client";

import { useEffect, useState } from "react";
import { setSignedInFlag, SIGNED_IN_FLAG_KEY } from "@/lib/api";

type AuthMode = "signIn" | "signUp";
type SignUpStage = "form" | "confirm";

export default function AuthPanel() {
  const [email, setEmail] = useState("demo@example.com");
  const [password, setPassword] = useState("CareQuest123!");
  const [message, setMessage] = useState("ログインして、あなたの記録をクラウドへつなぎましょう。");
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [currentUsername, setCurrentUsername] = useState<string | null>(null);
  // 道B: ログイン/新規登録の切り替えと、新規登録の2段階(入力→確認コード)。
  const [mode, setMode] = useState<AuthMode>("signIn");
  const [signUpStage, setSignUpStage] = useState<SignUpStage>("form");
  const [confirmationCode, setConfirmationCode] = useState("");

  // サインインが確認できたときの自動同期(Phase B)。背景で復元→バックアップを実行し、
  // 結果を穏やかに知らせる。UI はブロックしない・失敗しても記録はローカルに残る。
  // lib/sync は動的 import(初期バンドルを軽く保つ・T45 の精神)。
  const runSignInSync = async () => {
    try {
      const { syncOnSignIn } = await import("@/lib/sync");
      const result = await syncOnSignIn();
      if (result.skipped) {
        return;
      }
      if (result.restoredCount > 0) {
        setMessage(`クラウドから${result.restoredCount}件の記録を読み込み、バックアップしました。`);
      } else {
        setMessage("記録をクラウドにバックアップしました。");
      }
    } catch {
      // 同期に失敗しても記録はこの端末に安全。穏やかに伝える。
      setMessage("記録はこの端末に安全に保存されています。");
    }
  };

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
      setMessage("ログインしました。記録を同期しています…");
      // サインイン成功をトリガーに自動同期(復元→バックアップ)。
      void runSignInSync();
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
      // 実セッションが確認できたこのタイミングでも自動同期(復元→バックアップ)を試みる。
      // 前回ログインしたまま戻ってきたユーザーがクラウドの記録を取り込める。
      void runSignInSync();
    } catch {
      setCurrentUsername(null);
      setMessage("まだログインしていません。");
      setIsSignedIn(false);
      // 実セッションが無いのでフラグも下ろす(不整合の掃除)。
      setSignedInFlag(false);
    }
  };

  // 道B: 新規登録(メールに確認コードが届く)。username = email(プールの設定)。
  const handleSignUp = async () => {
    try {
      const { ensureAmplifyConfigured } = await import("@/lib/amplify");
      await ensureAmplifyConfigured();
      const { signUp } = await import("@aws-amplify/auth");
      const { isSignUpComplete, nextStep } = await signUp({
        username: email,
        password,
        options: { userAttributes: { email } },
      });
      if (isSignUpComplete) {
        setMode("signIn");
        setMessage("登録が完了しました。そのままサインインできます。");
        return;
      }
      if (nextStep.signUpStep === "CONFIRM_SIGN_UP") {
        setSignUpStage("confirm");
        setMessage(`${email} に確認コードを送りました。メールをご確認ください。`);
      } else {
        setMessage("登録を受け付けました。メールをご確認ください。");
      }
    } catch (error) {
      const name = error instanceof Error ? error.name : "";
      if (name === "UsernameExistsException") {
        setMessage("このメールアドレスはすでに登録されています。ログインをお試しください。");
      } else if (name === "InvalidPasswordException") {
        setMessage("パスワードは8文字以上で、大文字・小文字・数字を含めてください。");
      } else if (name === "InvalidParameterException") {
        setMessage("メールアドレスとパスワードをご確認ください。");
      } else {
        setMessage("登録できませんでした。もう一度お試しください。");
      }
    }
  };

  // 道B: 確認コードでアカウントを有効化する。
  const handleConfirmSignUp = async () => {
    try {
      const { ensureAmplifyConfigured } = await import("@/lib/amplify");
      await ensureAmplifyConfigured();
      const { confirmSignUp } = await import("@aws-amplify/auth");
      await confirmSignUp({ username: email, confirmationCode: confirmationCode.trim() });
      setMode("signIn");
      setSignUpStage("form");
      setConfirmationCode("");
      setMessage("登録が完了しました。そのままサインインできます。");
    } catch (error) {
      const name = error instanceof Error ? error.name : "";
      if (name === "CodeMismatchException") {
        setMessage("確認コードが違うようです。メールの番号をもう一度ご確認ください。");
      } else if (name === "ExpiredCodeException") {
        setMessage("確認コードの有効期限が切れました。「コードを再送」でお試しください。");
      } else {
        setMessage("確認できませんでした。もう一度お試しください。");
      }
    }
  };

  // 道B: 確認コードの再送。
  const handleResendCode = async () => {
    try {
      const { ensureAmplifyConfigured } = await import("@/lib/amplify");
      await ensureAmplifyConfigured();
      const { resendSignUpCode } = await import("@aws-amplify/auth");
      await resendSignUpCode({ username: email });
      setMessage("確認コードを再送しました。メールをご確認ください。");
    } catch {
      setMessage("コードを再送できませんでした。もう一度お試しください。");
    }
  };

  const switchToSignIn = () => {
    setMode("signIn");
    setMessage("ログインして、あなたの記録をクラウドへつなぎましょう。");
  };

  const switchToSignUp = () => {
    setMode("signUp");
    setSignUpStage("form");
    setConfirmationCode("");
    setMessage("メールアドレスとパスワードで、新しいアカウントを作れます。");
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

  const tabClass = (active: boolean) =>
    `rounded-full px-4 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 ${
      active ? "bg-stone-800 text-white" : "bg-stone-100 text-stone-600"
    }`;

  return (
    <section className="rounded-[28px] border border-stone-200 bg-white/80 p-4 shadow-sm">
      <h2 className="text-lg font-semibold text-stone-800">アカウント</h2>
      <p className="mt-1 text-sm text-stone-600">
        クラウドにバックアップするには、ログインまたは新規登録します。使わなくても記録はこの端末に残ります。
      </p>

      <div className="mt-3 flex gap-2">
        <button type="button" onClick={switchToSignIn} className={tabClass(mode === "signIn")}>
          ログイン
        </button>
        <button type="button" onClick={switchToSignUp} className={tabClass(mode === "signUp")}>
          新規登録
        </button>
      </div>

      <div className="mt-3 space-y-3">
        <input
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-3 py-3 text-sm"
          placeholder="メールアドレス"
          type="email"
          autoComplete="email"
        />
        <input
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-3 py-3 text-sm"
          placeholder="パスワード"
          type="password"
          autoComplete={mode === "signUp" ? "new-password" : "current-password"}
        />

        {mode === "signIn" ? (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={handleSignIn} className="min-h-[44px] rounded-full bg-stone-800 px-4 py-2 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2">
              サインイン
            </button>
            <button type="button" onClick={handleCheckUser} className="min-h-[44px] rounded-full bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2">
              状態確認
            </button>
            <button type="button" onClick={handleSignOut} className="min-h-[44px] rounded-full bg-stone-100 px-4 py-2 text-sm font-semibold text-stone-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2">
              サインアウト
            </button>
          </div>
        ) : signUpStage === "form" ? (
          <>
            <p className="text-xs leading-5 text-stone-500">
              パスワードは8文字以上で、大文字・小文字・数字を含めてください。登録すると、メールに確認コードが届きます。
            </p>
            <button type="button" onClick={handleSignUp} className="min-h-[44px] rounded-full bg-stone-800 px-4 py-2 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2">
              新規登録する
            </button>
          </>
        ) : (
          <>
            <input
              value={confirmationCode}
              onChange={(event) => setConfirmationCode(event.target.value)}
              className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-3 py-3 text-sm"
              placeholder="メールに届いた確認コード"
              inputMode="numeric"
              autoComplete="one-time-code"
            />
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={handleConfirmSignUp} className="min-h-[44px] rounded-full bg-stone-800 px-4 py-2 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2">
                確認する
              </button>
              <button type="button" onClick={handleResendCode} className="min-h-[44px] rounded-full bg-stone-100 px-4 py-2 text-sm font-semibold text-stone-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2">
                コードを再送
              </button>
            </div>
          </>
        )}

        <p className="text-sm text-stone-600">{message}</p>
        <p className="text-sm text-stone-500">
          {isSignedIn ? `ログイン済み: ${currentUsername ?? "ユーザー"}` : "未ログイン"}
        </p>
      </div>
    </section>
  );
}
