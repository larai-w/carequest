import Link from "next/link";
import Layout from "@/components/Layout";
import { supportContacts } from "@/lib/contacts";
import QuestionFinderCard from "@/components/QuestionFinderCard";

export default function AboutPage() {
  return (
    <Layout>
      <div className="space-y-4">
        <section className="rounded-[28px] border border-stone-200 bg-white/80 p-4 shadow-sm">
          <h2 className="text-xl font-semibold text-stone-800">Care Quest について</h2>
          <p className="mt-3 text-sm leading-7 text-stone-700">
            Care Quest は、家族介護者のためのやさしいサポートアプリです。今日できたことに気づき、他の介護者ともつながっている感覚を持てるように作られています。
          </p>
        </section>

        <section className="rounded-[28px] border border-amber-100 bg-amber-50/80 p-4 shadow-sm">
          <h3 className="text-lg font-semibold text-stone-800">はじめる前に、3つの安心</h3>
          <ul className="mt-3 space-y-2 text-sm leading-7 text-stone-700">
            <li>
              <span className="font-semibold text-stone-800">無料で使えます。</span>
              アプリ内の課金はありません。
            </li>
            <li>
              <span className="font-semibold text-stone-800">登録なしで、すぐ始められます。</span>
              クラウドに控えたいときだけ、任意で登録できます。
            </li>
            <li>
              <span className="font-semibold text-stone-800">記録は、まずこの端末の中だけ。</span>
              外には送られません。サインインしたときだけ、日本国内の AWS にもバックアップできます。
            </li>
          </ul>
        </section>

        <section className="rounded-[28px] border border-stone-200 bg-white/80 p-4 shadow-sm">
          <h3 className="text-lg font-semibold text-stone-800">安全に関する注意</h3>
          <p className="mt-3 text-sm leading-7 text-stone-700">
            このアプリは医療アドバイスを提供するものではありません。医療判断については、医師・看護師・介護専門職に相談してください。
          </p>
        </section>

        <QuestionFinderCard />

        <section className="rounded-[28px] border border-amber-100 bg-amber-50/80 p-4 shadow-sm">
          <h3 className="text-lg font-semibold text-stone-800">つらいとき、頼れる窓口</h3>
          <p className="mt-3 text-sm leading-7 text-stone-700">
            介護のつらさは、ひとりで抱えなくて大丈夫です。話を聞いてくれる場所があります。
          </p>
          <div className="mt-3 space-y-2">
            {supportContacts.map((contact) => (
              <div key={contact.name} className="rounded-2xl bg-white/80 px-3 py-3 text-sm">
                {contact.href ? (
                  <a
                    href={contact.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-amber-700 underline underline-offset-2"
                  >
                    {contact.name}
                  </a>
                ) : (
                  <span className="font-semibold text-stone-800">{contact.name}</span>
                )}
                <p className="mt-1 leading-6 text-stone-600">{contact.detail}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[28px] border border-stone-200 bg-white/80 p-4 shadow-sm">
          <h3 className="text-lg font-semibold text-stone-800">よくある質問</h3>
          <dl className="mt-3 space-y-3 text-sm leading-7 text-stone-700">
            <div>
              <dt className="font-semibold text-stone-800">スマホでも使えますか?</dt>
              <dd className="mt-1 text-stone-600">はい。スマホのブラウザで使えます。「ホーム画面に追加」すると、アプリのように開けます。</dd>
            </div>
            <div>
              <dt className="font-semibold text-stone-800">オフラインでも使えますか?</dt>
              <dd className="mt-1 text-stone-600">はい。ネットがつながらない場所でも、記録やふりかえりができます。</dd>
            </div>
            <div>
              <dt className="font-semibold text-stone-800">記録は誰かに見られますか?</dt>
              <dd className="mt-1 text-stone-600">いいえ。記録はこの端末に保存され、あなたの同意なく他の人に公開されることはありません。</dd>
            </div>
            <div>
              <dt className="font-semibold text-stone-800">記録が消えないか心配です。</dt>
              <dd className="mt-1 text-stone-600">端末に保存されるので、ブラウザのデータを消さなければ残ります。心配なときは、ふりかえり画面から JSON / CSV で書き出したり、登録してクラウドに控えることもできます。</dd>
            </div>
            <div>
              <dt className="font-semibold text-stone-800">使うのをやめたいときは?</dt>
              <dd className="mt-1 text-stone-600">いつでもふりかえり画面からすべての記録を削除できます。登録した場合は、ホーム画面の「アカウント」から、クラウドの記録やアカウントも削除できます。</dd>
            </div>
          </dl>
        </section>

        <section className="rounded-[28px] border border-stone-200 bg-white/80 p-4 shadow-sm">
          <h3 className="text-lg font-semibold text-stone-800">データの取り扱い</h3>
          <p className="mt-3 text-sm leading-7 text-stone-700">
            記録の保存方法と、私たちがしないことは{" "}
            <Link href="/privacy" className="font-semibold text-amber-700 underline underline-offset-2">
              プライバシーポリシー
            </Link>{" "}
            をご覧ください。
          </p>
        </section>

        <section className="rounded-[28px] border border-stone-200 bg-white/80 p-4 shadow-sm">
          <h3 className="text-lg font-semibold text-stone-800">運営元・お問い合わせ</h3>
          <p className="mt-3 text-sm leading-7 text-stone-700">
            Care Quest は veai.jp が運営しています。データの削除のご依頼やお困りごとがあれば、下記までご連絡ください。
          </p>
          <p className="mt-2 text-sm leading-7 text-stone-700">
            <a
              href="mailto:care_q@veai.jp"
              className="font-semibold text-amber-700 underline underline-offset-2"
            >
              care_q@veai.jp
            </a>
          </p>
        </section>
      </div>
    </Layout>
  );
}
