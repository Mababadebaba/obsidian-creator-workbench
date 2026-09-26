"""本机录入回归：使用临时 vault，不向用户笔记写测试数据。"""

import sys
import tempfile
import threading
import unittest
import json
import urllib.error
import urllib.request
from functools import partial
from http.server import ThreadingHTTPServer
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "dashboard"))

import build  # noqa: E402
import serve  # noqa: E402


class LocalEntryTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.vault = Path(self.temp.name)
        idea = self.vault / "01-内容生产" / "选题管理" / "00-选题记录.md"
        idea.parent.mkdir(parents=True)
        idea.write_text("---\ntags: [选题]\ntype: 选题\nstatus: 持续更新\ncreated: 2026-09-26\n---\n\n# 选题记录\n\n## 待筛选\n\n## 已筛选\n", encoding="utf-8")
        schedule = idea.parent / "02-选题排期.md"
        schedule.write_text("---\ntags: [选题]\ntype: 选题\nstatus: 持续更新\ncreated: 2026-09-26\n---\n\n# 选题排期\n\n## 当前批次\n\n| 序 | 发布日 | 类型 | 选题 | 状态 |\n|---|---|---|---|---|\n\n## 类型表现追踪表\n", encoding="utf-8")

    def test_idea_is_added_to_pending_without_fabricated_details(self):
        path = serve.add_entry(self.vault, "idea", {"title": "测试用户想法", "source": "自己观察"})
        notes = build.parse_idea_notes(path, [])
        self.assertEqual(len(notes), 1)
        self.assertEqual(notes[0]["title"], "测试用户想法")
        self.assertEqual(notes[0]["source_label"], "随手记")

    def test_schedule_row_remains_inside_markdown_table(self):
        path = serve.add_entry(self.vault, "schedule", {"topic": "测试选题", "publish_day": "2026-09-29", "type": "热点", "status": "待拍"})
        schedule = build.parse_schedule(path, [])
        self.assertEqual(len(schedule["schedule"]), 1)
        self.assertEqual(schedule["schedule"][0]["topic"], "测试选题")
        self.assertEqual(schedule["schedule"][0]["publish_day"], "2026-09-29")

    def test_video_keeps_unfilled_metrics_unknown(self):
        path = serve.add_entry(self.vault, "video", {"title": "测试视频", "publish_day": "2026-09-26", "platform": "抖音", "type": "热点", "views": "120", "likes": ""})
        self.assertTrue(path.is_file())
        published = build.parse_published(self.vault / "03-已发布内容", [])
        self.assertEqual(published["items"][0]["views"], 120)
        self.assertIsNone(published["items"][0]["likes"])

    def test_library_note_has_valid_front_matter(self):
        path = serve.add_entry(self.vault, "library", {"category": "案例", "title": "真实待核验案例", "content": "具体观察"})
        fm, body = build.parse_front_matter(path.read_text(encoding="utf-8"))
        self.assertEqual(fm["type"], "案例")
        self.assertEqual(fm["status"], "待核验")
        self.assertIn("具体观察", body)
        library = build.parse_library(self.vault / "02-素材库", [])
        self.assertIn("具体观察", library["items"][0]["content"])

    def test_local_api_writes_and_rejects_other_origins(self):
        handler = partial(serve.NoCacheHandler, directory=str(ROOT / "dashboard"), vault_path=self.vault)
        server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        self.addCleanup(thread.join, 2)
        self.addCleanup(server.server_close)
        self.addCleanup(server.shutdown)
        address = f"http://127.0.0.1:{server.server_port}"
        request_body = json.dumps({"kind": "idea", "payload": {"title": "接口录入测试"}}).encode("utf-8")
        headers = {"Content-Type": "application/json", "X-Workbench-Write": "1", "Origin": address}
        with mock.patch.object(build, "build_site") as rebuild:
            request = urllib.request.Request(address + "/api/entries", request_body, headers, method="POST")
            with urllib.request.urlopen(request, timeout=5) as response:
                result = json.load(response)
            self.assertTrue(result["ok"])
            rebuild.assert_called_once()
            bad_headers = {**headers, "Origin": "https://other.example"}
            bad_request = urllib.request.Request(address + "/api/entries", request_body, bad_headers, method="POST")
            with self.assertRaises(urllib.error.HTTPError) as denied:
                urllib.request.urlopen(bad_request, timeout=5)
            self.assertEqual(denied.exception.code, 403)
        ideas = build.parse_idea_notes(self.vault / "01-内容生产" / "选题管理" / "00-选题记录.md", [])
        self.assertEqual(len(ideas), 1)

    def test_platform_path_cannot_escape_vault(self):
        with self.assertRaises(ValueError):
            serve.add_entry(self.vault, "video", {"title": "测试", "publish_day": "2026-09-26", "platform": "../../outside", "type": "热点"})

    def test_latest_real_fetch_overrides_old_history_date(self):
        history = self.vault / "trends-history"
        history.mkdir()
        (history / "2026-08-09.md").write_text("# 2026-08-09\n", encoding="utf-8")
        result = build.compute_radar_freshness(self.vault, {"updated": "2026-01-10", "last_fetch_date": "2026-09-26"})
        self.assertEqual(result["radar_last_date"], "2026-09-26")


if __name__ == "__main__":
    unittest.main()
