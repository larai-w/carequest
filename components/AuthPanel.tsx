"use client";

import { useEffect, useState } from "react";
import { setSignedInFlag, SIGNED_IN_FLAG_KEY } from "@/lib/api";

type AuthMode = "signIn" | "signUp" | "reset";
type SignUpStage = "form" | "confirm";
type ResetStage = "request" | "confirm";

export default function AuthPanel() {
  const [email, setEmail] = useState("demo@example.com");
  const [password, setPassword] = useState("CareQuest123!");
  const [message, setMessage] = useState("ログインして、あなたの記録をクラウドへつなぎましょう。");
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [currentUsername, setCurrentUsername] = useState<string | null>(null);
  const [mode, setMode] = useState<AuthMode>("signIn");
  const [signUpStage, setSignUpStage] = useState<SignUpStage>("form");
  const [resetStage, setResetStage] = useState<ResetStage>("request");
  const [confirmationCode, setConfirmationCode] = useState("");
  const [newPassword, setNewPassword] = useState("");

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
      setMode("signIn");
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
      setSignedInFlag(true);
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

  // T48: パスワード再設定。登録メールに再設定コードを送る → コード+新パスワードで確定。
  const handleRequestReset = async () => {
    try {
      const { ensureAmplifyConfigured } = await import("@/lib/amplify");
      await ensureAmplifyConfigured();
      const { resetPassword } = await import("@aws-amplify/auth");
      const { nextStep } = await resetPassword({ username: email });
      if (nextStep.resetPasswordStep === "CONFIRM_RESET_PASSWORD_WITH_CODE") {
        setResetStage("confirm");
        setMessage(`${email} に再設定コードを送りました。メールをご確認ください。`);
      } else {
        setMode("signIn");
        setMessage("パスワードの再設定が完了しました。サインインできます。");
      }
    } catch (error) {
      const name = error instanceof Error ? error.name : "";
      if (name === "LimitExceededException") {
        setMessage("お試しの回数が多いようです。しばらくしてからもう一度お試しください。");
      } else {
        // ユーザー有無は明かさない(列挙対策)。届く場合はメールをご確認、で統一。
        setMessage("登録済みのメールアドレスなら、再設定コードをお送りしました。メールをご確認ください。");
        setResetStage("confirm");
      }
    }
  };

  const handleConfirmReset = async () => {
    try {
      const { ensureAmplifyConfigured } = await import("@/lib/amplify");
      await ensureAmplifyConfigured();
      const { confirmResetPassword } = await import("@aws-amplify/auth");
      await confirmResetPassword({
        username: email,
        confirmationCode: confirmationCode.trim(),
        newPassword,
      });
      setMode("signIn");
      setResetStage("request");
      setConfirmationCode("");
      setPassword(newPassword);
      setNewPassword("");
      setMessage("パスワードを変更しました。新しいパスワードでサインインできます。");
    } catch (error) {
      const name = error instanceof Error ? error.name : "";
      if (name === "CodeMismatchException") {
        setMessage("再設定コードが違うようです。メールの番号をもう一度ご確認ください。");
      } else if (name === "ExpiredCodeException") {
        setMessage("再設定コードの有効期限が切れました。もう一度お送りください。");
      } else if (name === "InvalidPasswordException") {
        setMessage("パスワードは8文字以上で、大文字・小文字・数字を含めてください。");
      } else {
        setMessage("パスワードを変更できませんでした。もう一度お試しください。");
      }
    }
  };

  const switchToSignIn = () => {
    setMode("signIn");
    setResetStage("request");
    setConfirmationCode("");
    setNewPassword("");
    setMessage("ログインして、あなたの記録をクラウドへつなぎましょう。");
  };

  const switchToSignUp = () => {
    setMode("signUp");
    setSignUpStage("form");
    setConfirmationCode("");
    setMessage("メールアドレスとパスワードで、新しいアカウントを作れます。");
  };

  const switchToReset = () => {
    setMode("reset");
    setResetStage("request");
    setConfirmationCode("");
    setNewPassword("");
    setMessage("パスワードを再設定します。登録したメールアドレスをご確認ください。");
  };

  useEffect(() => {
    // マウント時は認証 SDK を読み込まない(初期表示・hydration を遅らせないため・T45)。
    // localStorage の軽量フラグだけを見て「ログイン済みかもしれない」初期表示を確定させる。
    // 初回レンダー(SSR/hydration)は常に「未ログイン」で描画し、hydration 後に差し替える。
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

  const primaryButton =
    "min-h-[44px] rounded-full bg-stone-800 px-4 py-2 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2";
  const subtleButton =
    "min-h-[44px] rounded-full bg-stone-100 px-4 py-2 text-sm font-semibold text-stone-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2";
  const linkButton =
    "rounded-full px-2 py-1 text-xs text-stone-500 underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 hover:text-stone-700";
  const tabClass = (active: boolean) =>
    `rounded-full px-4 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 ${
      active ? "bg-stone-800 text-white" : "bg-stone-100 text-stone-600"
    }`;

  const input =
    "w-full rounded-2xl border border-stone-200 bg-stone-50 px-3 py-3 text-sm";

  // サインイン済みは、ログインフォームを畳んで「ログイン中 + サインアウト」だけ見せる。
  if (isSignedIn) {
    return (
      <section className="rounded-[28px] border border-stone-200 bg-white/80 p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-stone-800">アカウント</h2>
        <p className="mt-1 text-sm text-stone-600">記録はクラウドにも控えられています。</p>
        <p className="mt-3 text-sm text-stone-700">ログイン中: {currentUsername ?? "ユーザー"}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={handleSignOut} className={subtleButton}>
            サインアウト
          </button>
          <button type="button" onClick={handleCheckUser} className="min-h-[44px] rounded-full bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2">
            状態確認
          </button>
        </div>
        <p className="mt-3 text-sm text-stone-600">{message}</p>
      </section>
    );
  }

  const showPasswordInput = mode === "signIn" || (mode === "signUp" && signUpStage === "form");

  return (
    <section className="rounded-[28px] border border-stone-200 bg-white/80 p-4 shadow-sm">
      <h2 className="text-lg font-semibold text-stone-800">アカウント</h2>
      <p className="mt-1 text-sm text-stone-600">
        クラウドにバックアップするには、ログインまたは新規登録します。使わなくても記録はこの端末に残ります。
      </p>

      <div className="mt-3 flex gap-2">
        <button type="button" onClick={switchToSignIn} className={tabClass(mode !== "signUp")}>
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
          className={input}
          placeholder="メールアドレス"
          type="email"
          autoComplete="email"
        />
        {showPasswordInput ? (
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={input}
            placeholder="パスワード"
            type="password"
            autoComplete={mode === "signUp" ? "new-password" : "current-password"}
          />
        ) : null}

        {mode === "signIn" ? (
          <>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={handleSignIn} className={primaryButton}>
                サインイン
              </button>
              <button type="button" onClick={handleCheckUser} className="min-h-[44px] rounded-full bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2">
                状態確認
              </button>
            </div>
            <button type="button" onClick={switchToReset} className={linkButton}>
              パスワードをお忘れですか？
            </button>
          </>
        ) : mode === "signUp" ? (
          signUpStage === "form" ? (
            <>
              <p className="text-xs leading-5 text-stone-500">
                パスワードは8文字以上で、大文字・小文字・数字を含めてください。登録すると、メールに確認コードが届きます。
              </p>
              <button type="button" onClick={handleSignUp} className={primaryButton}>
                新規登録する
              </button>
            </>
          ) : (
            <>
              <input
                value={confirmationCode}
                onChange={(event) => setConfirmationCode(event.target.value)}
                className={input}
                placeholder="メールに届いた確認コード"
                inputMode="numeric"
                autoComplete="one-time-code"
              />
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={handleConfirmSignUp} className={primaryButton}>
                  確認する
                </button>
                <button type="button" onClick={handleResendCode} className={subtleButton}>
                  コードを再送
                </button>
              </div>
            </>
          )
        ) : resetStage === "request" ? (
          <>
            <p className="text-xs leading-5 text-stone-500">
              登録したメールアドレスに、パスワード再設定用のコードをお送りします。
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={handleRequestReset} className={primaryButton}>
                再設定コードを送る
              </button>
              <button type="button" onClick={switchToSignIn} className={subtleButton}>
                ログインにもどる
              </button>
            </div>
          </>
        ) : (
          <>
            <input
              value={confirmationCode}
              onChange={(event) => setConfirmationCode(event.target.value)}
              className={input}
              placeholder="メールに届いた再設定コード"
              inputMode="numeric"
              autoComplete="one-time-code"
            />
            <input
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              className={input}
              placeholder="新しいパスワード"
              type="password"
              autoComplete="new-password"
            />
            <p className="text-xs leading-5 text-stone-500">
              パスワードは8文字以上で、大文字・小文字・数字を含めてください。
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={handleConfirmReset} className={primaryButton}>
                パスワードを変更
              </button>
              <button type="button" onClick={switchToSignIn} className={subtleButton}>
                ログインにもどる
              </button>
            </div>
          </>
        )}

        <p className="text-sm text-stone-600">{message}</p>
        <p className="text-sm text-stone-500">未ログイン</p>
      </div>
    </section>
  );
}
