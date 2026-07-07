import Link from "next/link";
import Layout from "@/components/Layout";

const supportContacts = [
  {
    name: "地域包括支援センター",
    detail: "介護の困りごと全般の身近な窓口です。お住まいの市区町村名と合わせて検索できます。",
    href: null,
  },
  {
    name: "認知症の人と家族の会(電話相談)",
    detail: "0120-294-456(フリーダイヤル)。介護する家族どうしで話せる窓口です。",
    href: "https://www.alzheimer.or.jp/",
  },
  {
    name: "よりそいホットライン",
    detail: "0120-279-338。どんなつらさでも、24時間むりょうで話せます。",
    href: "https://www.since2011.net/yorisoi/",
  },
];

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

        <section className="rounded-[28px] border border-stone-200 bg-white/80 p-4 shadow-sm">
          <h3 className="text-lg font-semibold text-stone-800">安全に関する注意</h3>
          <p className="mt-3 text-sm leading-7 text-stone-700">
            このアプリは医療アドバイスを提供するものではありません。医療判断については、医師・看護師・介護専門職に相談してください。
          </p>
        </section>

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
          <h3 className="text-lg font-semibold text-stone-800">データの取り扱い</h3>
          <p className="mt-3 text-sm leading-7 text-stone-700">
            記録の保存方法と、私たちがしないことは{" "}
            <Link href="/privacy" className="font-semibold text-amber-700 underline underline-offset-2">
              プライバシーポリシー
            </Link>{" "}
            をご覧ください。
          </p>
        </section>
      </div>
    </Layout>
  );
}
