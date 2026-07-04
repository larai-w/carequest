import Layout from "@/components/Layout";

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
      </div>
    </Layout>
  );
}
