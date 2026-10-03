import Link from "next/link";
import Layout from "@/components/Layout";

export default function DeleteAccountPage() {
  return (
    <Layout>
      <div className="space-y-4">
        <section className="rounded-[28px] border border-stone-200 bg-white/80 p-4 shadow-sm">
          <h2 className="text-xl font-semibold text-stone-800">Care Quest アカウントとデータの削除</h2>
          <p className="mt-3 text-sm leading-7 text-stone-700">
            Care Quest（運営: veai.jp）のアカウントやクラウドの記録は、アプリをインストールしていなくても削除を依頼できます。
          </p>
          <p className="mt-3 text-sm leading-7 text-stone-700">
            登録したメールアドレスから care_q@veai.jp へ、Care Quest のアカウントとクラウドの記録を削除したい旨をお知らせください。登録したメールアドレスを使えない場合も、この窓口へご相談ください。本人確認の方法と対応についてご案内します。
          </p>
          <p className="mt-3 text-sm leading-7 text-stone-700">
            パスワードや認証コード、介護記録の内容は送らないでください。
          </p>
          <a
            href={`mailto:care_q@veai.jp?subject=${encodeURIComponent("Care Quest アカウントとデータの削除依頼")}`}
            className="mt-4 inline-flex min-h-12 items-center rounded-2xl bg-amber-700 px-4 py-3 font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-700"
          >
            メールで削除を依頼する
          </a>
          <p className="mt-3 text-sm leading-7 text-stone-700">
            このリンクはメール作成画面を開きます。リンクを押すだけで送信や削除は行われません。
          </p>
        </section>

        <section className="rounded-[28px] border border-stone-200 bg-white/80 p-4 shadow-sm">
          <h3 className="text-lg font-semibold text-stone-800">削除されるものと、端末に残るもの</h3>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-7 text-stone-700">
            <li>アカウントの削除では、登録メールアドレスを含む認証アカウントと、Care Quest のクラウドに保存したケアの記録が削除の対象です。</li>
            <li>クラウドの記録だけの削除も依頼できます。その場合、アカウントは残ります。</li>
            <li>端末内の記録と、自分で書き出した JSON・CSV ファイルは残ります。端末内の記録は「ふりかえり」の「すべての記録を削除する」から、書き出したファイルは保存先で削除してください。</li>
            <li>「CareQuest へのひとこと」で送ったご意見は、アカウントや名前と結びつけずに保存しているため、どれがあなたのものかを特定できず、個別には削除できません。ご意見は送信から1年たつと自動で削除されます。</li>
          </ul>
        </section>

        <section className="rounded-[28px] border border-stone-200 bg-white/80 p-4 shadow-sm">
          <h3 className="text-lg font-semibold text-stone-800">ログインできる場合</h3>
          <p className="mt-3 text-sm leading-7 text-stone-700">
            ホーム画面の「アカウント」から「クラウドのデータ・アカウントを削除」を開くと、自分で削除できます。削除前に、必要な記録を保存してください。
          </p>
          <Link href="/" className="mt-3 inline-flex min-h-12 items-center font-semibold text-amber-700 underline underline-offset-2">Care Quest のホームへ</Link>
          <p>
            <Link href="/privacy" className="inline-flex min-h-12 items-center font-semibold text-amber-700 underline underline-offset-2">プライバシーポリシー</Link>
          </p>
        </section>
      </div>
    </Layout>
  );
}
