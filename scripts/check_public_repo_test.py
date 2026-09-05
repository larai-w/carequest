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
