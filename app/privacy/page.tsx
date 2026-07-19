import Layout from "@/components/Layout";

export default function PrivacyPage() {
  return (
    <Layout>
      <div className="space-y-4">
        <section className="rounded-[28px] border border-stone-200 bg-white/80 p-4 shadow-sm">
          <h2 className="text-xl font-semibold text-stone-800">プライバシーポリシー</h2>
          <p className="mt-3 text-sm leading-7 text-stone-700">
            介護の記録は、あなたと家族の大切なプライバシーです。Care Quest が何を保存し、何をしないかを、できるだけわかりやすく説明します。
          </p>
        </section>

        <section className="rounded-[28px] border border-stone-200 bg-white/80 p-4 shadow-sm">
          <h3 className="text-lg font-semibold text-stone-800">保存するもの</h3>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-7 text-stone-700">
            <li>
              介護の記録・ふりかえりメモ・エネルギーレベルなどのアプリ内データは、あなたの端末(ブラウザの localStorage)に保存されます。
            </li>
            <li>
              アカウント登録をした場合は、メールアドレスと介護の記録を、日本国内リージョンの AWS(Amazon Cognito / DynamoDB)に保存します。
            </li>
          </ul>
        </section>

        <section className="rounded-[28px] border border-stone-200 bg-white/80 p-4 shadow-sm">
          <h3 className="text-lg font-semibold text-stone-800">VEAI アカウントについて</h3>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-7 text-stone-700">
            <li>
              Care Quest のアカウントは「VEAI アカウント」です。将来、veai.jp の他のサービスでも同じメールアドレスとパスワードでサインインできるようになります。
            </li>
            <li>
              アカウントは共通でも、記録などのデータはサービスごとに独立して保存され、サービス間で共有されません。
            </li>
            <li>
              他のサービスにあなたのデータが作られるのは、あなたがそのサービスで自分でサインインして同意したときだけです。アカウントを持っているだけでは、どのサービスにもデータは作られません。
            </li>
          </ul>
        </section>

        <section className="rounded-[28px] border border-stone-200 bg-white/80 p-4 shadow-sm">
          <h3 className="text-lg font-semibold text-stone-800">しないこと</h3>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-7 text-stone-700">
            <li>広告のための情報収集や、第三者へのデータ販売は行いません。</li>
            <li>介護されているご本人の氏名・病名などの入力を求めません。</li>
            <li>記録の内容を、あなたの同意なく他のユーザーに公開しません。「みんな」画面に表示されるのは、個人が特定されない集計のみです。</li>
          </ul>
        </section>

        <section className="rounded-[28px] border border-stone-200 bg-white/80 p-4 shadow-sm">
          <h3 className="text-lg font-semibold text-stone-800">データの削除</h3>
          <p className="mt-3 text-sm leading-7 text-stone-700">
            端末内のデータは、ふりかえり画面のデータ管理セクションにある「すべての記録を削除する」からアプリ内で削除できます。削除後はオンボーディングが再表示される、まっさらな状態に戻ります。
          </p>
          <p className="mt-2 text-sm leading-7 text-stone-700">
            削除の前にふりかえり画面から記録を JSON または CSV ファイルとして手元に持ち出すこともできます。
          </p>
          <p className="mt-2 text-sm leading-7 text-stone-700">
            アカウント登録をした場合は、ホーム画面の「アカウント」から、クラウドに保存した記録の削除や、アカウントそのものの削除ができます。どちらの場合も、この端末に保存された記録は残ります。
          </p>
          <p className="mt-2 text-sm leading-7 text-stone-500">
            ブラウザのサイトデータ削除でも端末内のデータを消すことができます。ご不明な点は About ページ記載の運営元までご連絡ください。
          </p>
        </section>

        <section className="rounded-[28px] border border-stone-200 bg-white/80 p-4 shadow-sm">
          <h3 className="text-lg font-semibold text-stone-800">このポリシーについて</h3>
          <p className="mt-3 text-sm leading-7 text-stone-700">
            内容を変更する場合は、このページでお知らせします。最終更新日: 2026年7月19日
          </p>
        </section>
      </div>
    </Layout>
  );
}
