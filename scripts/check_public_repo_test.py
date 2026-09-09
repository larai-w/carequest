"""公開境界ガードが「本当に検出するか」を確かめる。

パターンを足しただけでは、書き間違えていても誰も気づかない。何も検出しない
チェックは、無いよりたちが悪い（通ったという安心だけが残るため）。

サンプルの秘密文字列は、このファイル自体がガードに引っかからないよう、
実行時に組み立てる。リテラルとしてファイルに現れないようにするのが目的。
"""

import importlib.util
import unittest
from pathlib import Path

SPEC = importlib.util.spec_from_file_location(
    "check_public_repo", Path(__file__).with_name("check_public_repo.py")
)
guard = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(guard)


def samples() -> dict[str, str]:
    """ラベル -> そのパターンが拾うべき文字列。リテラルを避けて組み立てる。"""
    b64 = "A" * 24
    return {
        "private key": "-----BEGIN " + "OPENSSH " + "PRIVATE KEY-----",
        "AWS access key": "AKIA" + "A" * 16,
        "GitHub token": "gh" + "p_" + "A" * 36,
        "Slack token": "xox" + "b-" + "1" * 12,
        "Slack webhook": "https://hooks." + "slack.com/services/T" + "0" * 8 + "/B" + "0" * 8 + "/" + b64,
        "Google API key": "AIza" + "b" * 35,
        "JWT": "eyJ" + "a" * 12 + ".eyJ" + "b" * 12 + "." + "c" * 12,
        "Stripe key": "sk" + "_live_" + "0" * 24,
        "OpenAI key": "sk-" + "proj-" + "z" * 24,
        "npm token": "npm" + "_" + "0" * 36,
        "PyPI token": "pypi" + "-" + "0" * 20,
    }


class TestSecretPatterns(unittest.TestCase):
    def test_every_pattern_has_a_sample(self):
        labels = {label for label, _ in guard.SECRET_PATTERNS}
        self.assertEqual(
            labels,
            set(samples()),
            "SECRET_PATTERNS を足したらサンプルも足す。足さないと検出漏れに気づけない",
        )

    def test_every_pattern_actually_matches(self):
        by_label = dict(guard.SECRET_PATTERNS)
        for label, sample in samples().items():
            with self.subTest(label=label):
                self.assertRegex(sample, by_label[label], f"{label} のパターンが自分のサンプルを拾えていない")

    def test_content_reasons_reports_each_secret(self):
        for label, sample in samples().items():
            with self.subTest(label=label):
                reasons = guard.content_reasons("app/example.ts", f"const value = '{sample}'\n".encode())
                self.assertIn(label, reasons)

    def test_clean_content_is_not_flagged(self):
        clean = "export const GREETING = 'おかえりなさい'\n".encode()
        self.assertEqual(guard.content_reasons("app/example.ts", clean), [])


if __name__ == "__main__":
    unittest.main()


class TestReviewedFalsePositive(unittest.TestCase):
    """確認済みトークンが「ファイル名の推測」にも効くこと。**効きすぎないこと。**

    2026-09-09: ファイル名による判定は中身を読む前に打ち切っていたため、
    **一番よく出る誤検知にトークンが届かなかった**。social-system-debugger の
    `docs/session-handoff.md`（手順の文書）や `scripts/handoff-check.sh`（ツール）が
    これに当たり、ガードを入れると恒久的に止まる状態だった。
    """

    TOKEN = guard.ALLOW_TOKEN

    def test_filename_convention_still_blocks_without_the_token(self):
        """トークンが無ければ、従来どおり止める。"""
        got = guard.file_reasons("docs/session-handoff.md", "ふつうの本文".encode())
        self.assertEqual(got, ["private filename convention"])

    def test_filename_convention_is_cleared_by_the_token(self):
        """確認済みなら通す。**これが今回足した動き。**"""
        got = guard.file_reasons("docs/session-handoff.md", f"手順の文書。{self.TOKEN}".encode())
        self.assertEqual(got, [])

    def test_the_token_never_clears_a_secret(self):
        """名前を許しても、**秘密情報は必ず止める。**"""
        secret = "AKIA" + "A" * 16
        got = guard.file_reasons("docs/session-handoff.md", f"{self.TOKEN}\n{secret}\n".encode())
        self.assertTrue(got, "秘密情報が素通りしてはいけない")
        self.assertNotIn("private filename convention", got)

    def test_a_private_path_component_is_not_escapable_here(self):
        """`private/` 配下は**意図的な置き場所**なので、この関数では扱わない。

        呼び出し側が中身を読む前に止める。ここでトークンに反応しないことを固定する。
        """
        self.assertEqual(guard.private_path_reason("private/plan.md"), "private path component")
        self.assertEqual(guard.private_path_reason("docs/session-handoff.md"),
                         "private filename convention")

    def test_clean_file_with_a_neutral_name_is_untouched(self):
        """関係のないファイルの挙動を変えていないこと。"""
        self.assertEqual(guard.file_reasons("src/app.ts", b"export const a = 1;"), [])

