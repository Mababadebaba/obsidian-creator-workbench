"""用仓库自带的虚构示例 vault 跑一遍完整构建。

这条测试守的是「clone 下来就能跑」这个承诺：只要它绿着，
陌生人第一次执行 `cd dashboard && python3 build.py` 就一定能看到 9 个有内容的页面。

只断言结构，不断言具体数字——示例内容随时可以改，结构不能塌。
"""

import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DASHBOARD = ROOT / "dashboard"
sys.path.insert(0, str(DASHBOARD))

import build  # noqa: E402

PAGES = ("index", "ideas", "auto-hotspots", "radar", "pipeline", "analytics", "library", "cheat", "dbs")


class DemoVaultTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data, cls.warnings = build.collect_data(ROOT)

    def test_pages_tuple_matches_publish_script(self):
        """build.py / publish-workbench.sh / test_publish_workbench.py 三处 PAGES 必须一致。

        历史缺陷：只改了其中一处，导致两个页面从未被发布出去。
        """
        self.assertEqual(build.PAGES, PAGES)
        script = (ROOT / "06-业务运营" / "cron" / "publish-workbench.sh").read_text(encoding="utf-8")
        for page in PAGES:
            self.assertIn(page, script, f"publish-workbench.sh 的 PAGES 少了 {page}")

    def test_demo_vault_fills_every_major_section(self):
        data = self.data
        self.assertTrue(data["cheat"]["candidates"], "候选池为空——candidates.md 结构可能坏了")
        self.assertTrue(data["ideas"]["items"], "灵感页为空——00-选题记录.md 结构可能坏了")
        self.assertTrue(data["radar"]["signals"], "雷达信号为空——热点雷达 callout 结构可能坏了")
        self.assertTrue(data["methodology"]["items"], "方法论库为空")
        self.assertTrue(data["library"]["items"], "素材库为空")
        self.assertTrue(data["cheat"]["predictions"], "预测记录为空")
        self.assertTrue(data["cheat"]["memo_observations"], "复盘观察为空——rubric-memo.md 结构可能坏了")

    def test_prediction_carries_scores_and_retro(self):
        prediction = self.data["cheat"]["predictions"][0]
        self.assertTrue(prediction["dims_detail"], "预测的 7 维评分没解析出来")
        self.assertTrue(prediction["buckets"], "bucket 押注表没解析出来")
        retro = prediction["retro"]
        self.assertTrue(retro, "复盘段没解析出来")
        self.assertIsNotNone(
            retro["metrics"].get("views"),
            "复盘实绩里的播放数没解析出来（检查『播放：数字』格式）",
        )
        self.assertTrue(retro["verified"] or retro["refuted"], "预测验证/推翻列表都是空的")

    def test_rubric_doc_stays_consistent_with_claude_md(self):
        """CLAUDE.md 的评分段与 rubric_notes.md 必须完全一致。

        工作台每次构建都会比对两处并在 cheat 页报冲突（只读只报，绝不改写文件）。
        这条测试保证仓库不会带着已知冲突发布——你改了任一边忘了改另一边，CI 就会红。
        """
        conflicts = self.data["cheat"]["doc_conflicts"]
        self.assertEqual(
            conflicts, [],
            "CLAUDE.md 的「7 维评分体系」段与 rubric_notes.md 不一致："
            + "；".join(f"{c['kind']}: rubric_notes={c['expected']} vs CLAUDE.md={c['found']}" for c in conflicts),
        )

    def test_build_writes_nine_pages_with_inline_json(self):
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp)
            build.build_site(ROOT, out)
            for page in PAGES:
                path = out / f"{page}.html"
                self.assertTrue(path.is_file(), f"缺页面：{page}")
                text = path.read_text(encoding="utf-8")
                self.assertIn('id="dashboard-data"', text, f"{page} 没有内联数据")
            payload = json.loads((out / "assets" / "data.json").read_text(encoding="utf-8"))
            self.assertIn("global", payload)


if __name__ == "__main__":
    unittest.main()
