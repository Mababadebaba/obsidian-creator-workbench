"""热点抓取器的离线测试——不发任何网络请求。

守两件事：
1. 渲染出来的 markdown 能被 build.py 的 parse_radar 真正解析（不是"看起来对"）
2. 二次抓取不会覆盖 AI 写好的精选区
"""

import sys
import tempfile
import unittest
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "dashboard"))
sys.path.insert(0, str(ROOT / "tools"))

import build  # noqa: E402
import fetch_trends  # noqa: E402

SAMPLE = [
    {
        "title": "某模型发布本地可跑的长文本版本",
        "excerpt": "摘要正文",
        "source": "测试源",
        "metrics": "score 128 · 64 评论",
        "url": "https://example.com/a",
        "created_at": "2026-08-04T09:00:00Z",
    },
    {
        # 故意缺 excerpt 和 metrics：抓不到的字段应当省略，而不是补占位
        "title": "没有摘要也没有互动数的条目",
        "excerpt": "",
        "source": "测试源",
        "metrics": "",
        "url": "https://example.com/b",
        "created_at": "",
    },
]


class RenderTests(unittest.TestCase):
    def test_rendered_section_is_parsed_by_build(self):
        section = fetch_trends.render_full_section([("测试源", SAMPLE)], [])
        radar = fetch_trends.merge_into_radar("", section, datetime(2026, 8, 4))

        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "radar.md"
            path.write_text(radar, encoding="utf-8")
            data = build.parse_radar(path, [])
        fetched = data["full_fetch"]

        self.assertEqual(len(fetched), 2, "全量抓取区没被 parse_radar 解析出来")
        first = fetched[0]
        self.assertEqual(first["url"], "https://example.com/a")
        self.assertEqual(first["excerpt"], "摘要正文")
        self.assertEqual(first["metrics"].get("score"), 128)
        self.assertEqual(first["metrics"].get("replies"), 64)

    def test_missing_fields_are_omitted_not_faked(self):
        section = fetch_trends.render_full_section([("测试源", SAMPLE)], [])
        body = section.split("2. 没有摘要", 1)[1]
        self.assertNotIn("原文：", body)
        self.assertNotIn("互动：", body)
        self.assertNotIn("时间：", body)

    def test_fetch_time_is_recorded_separately(self):
        section = fetch_trends.render_full_section([("测试源", SAMPLE)], [], "2026-08-04 02:30")
        self.assertIn("抓取时间：2026-08-04 02:30", section)

    def test_unreachable_source_is_recorded(self):
        section = fetch_trends.render_full_section([("测试源", SAMPLE)], ["某源：抓取失败（URLError）"])
        self.assertIn("本次有源不可达", section)
        self.assertIn("某源：抓取失败", section)

    def test_refetch_preserves_curated_section(self):
        """第二次抓取不能覆盖 AI 写好的「⭐ 今日值得做的」。"""
        curated = (
            "# 🔥每日热点雷达\n\n更新时间：2026年08月01日\n\n"
            "## ⭐ 今日值得做的\n\n"
            "> [!danger] 热点位圈1：人工挑的信号\n>\n"
            "> **链接**：https://example.com/curated\n\n"
            "## 📡 全量抓取\n\n旧的抓取内容\n"
        )
        section = fetch_trends.render_full_section([("测试源", SAMPLE)], [])
        merged = fetch_trends.merge_into_radar(curated, section, datetime(2026, 8, 4))

        self.assertIn("人工挑的信号", merged, "精选区被覆盖了")
        self.assertIn("https://example.com/curated", merged)
        self.assertNotIn("旧的抓取内容", merged, "旧全量区没被替换")
        self.assertIn(
            "更新时间：2026年08月01日", merged,
            "抓取不该改写「更新时间」——那代表精选区的加工日期，"
            "抓一次就刷新会让过期告警变绿，掩盖精选区其实还是旧的",
        )
        self.assertEqual(merged.count("## 📡 全量抓取"), 1)

    def test_new_file_gets_placeholder_not_fabricated_signals(self):
        section = fetch_trends.render_full_section([("测试源", SAMPLE)], [])
        fresh = fetch_trends.merge_into_radar("", section, datetime(2026, 8, 4))
        self.assertIn("## ⭐ 今日值得做的", fresh)
        self.assertIn("待加工", fresh, "空文件应给出待加工占位，而不是自动编造精选")


if __name__ == "__main__":
    unittest.main()
