import os
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "06-业务运营" / "cron" / "publish-workbench.sh"
# 必须与 publish-workbench.sh 的 PAGES 数组、build.py 的 PAGES 元组三方一致。
PAGES = [
    "index",
    "ideas",
    "auto-hotspots",
    "radar",
    "pipeline",
    "analytics",
    "library",
    "cheat",
    "dbs",
]


class PublishWorkbenchTests(unittest.TestCase):
    def test_publish_script_syncs_pages_and_assets(self):
        temp = Path(tempfile.mkdtemp(prefix="workbench-publish-"))
        try:
            dashboard = temp / "dashboard"
            public = temp / "public"
            assets = dashboard / "assets"
            assets.mkdir(parents=True)
            public_assets = public / "assets"
            public_assets.mkdir(parents=True)
            (public_assets / "stale.css").write_text("old", encoding="utf-8")

            for page in PAGES:
                (dashboard / f"{page}.html").write_text(f"<h1>{page}</h1>", encoding="utf-8")
            (assets / "app.css").write_text(":root{}", encoding="utf-8")
            (assets / "app.js").write_text("window.ok=true", encoding="utf-8")
            (assets / "data.json").write_text('{"ok": true}', encoding="utf-8")

            env = os.environ.copy()
            env["CONTENT_WORKBENCH_DASHBOARD_DIR"] = str(dashboard)
            env["CONTENT_WORKBENCH_PUBLIC_DIR"] = str(public)

            result = subprocess.run(
                [str(SCRIPT), "--skip-build"],
                cwd=ROOT,
                env=env,
                text=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
            )

            self.assertEqual(result.returncode, 0, result.stdout)
            for page in PAGES:
                self.assertEqual((public / f"{page}.html").read_text(encoding="utf-8"), f"<h1>{page}</h1>")
            self.assertEqual((public / "assets" / "app.css").read_text(encoding="utf-8"), ":root{}")
            self.assertFalse((public / "assets" / "stale.css").exists())
            self.assertIn("published workbench", result.stdout)
        finally:
            shutil.rmtree(temp)


class PagesManifestSyncTests(unittest.TestCase):
    """三方 PAGES 清单必须一致。

    历史缺陷：publish-workbench.sh 长期只列 7 页，cheat / dbs 两个控制台
    从未被发布到公网，而 build.py 一直在生成它们——这条同步链断过一次且
    无人察觉。此测试把三份清单钉在一起，再断就会红。
    """

    def _pages_from_build_py(self) -> list[str]:
        import ast

        source = (ROOT / "dashboard" / "build.py").read_text(encoding="utf-8")
        tree = ast.parse(source)
        for node in ast.walk(tree):
            if isinstance(node, ast.Assign) and any(
                isinstance(t, ast.Name) and t.id == "PAGES" for t in node.targets
            ):
                return list(ast.literal_eval(node.value))
        raise AssertionError("build.py 里找不到 PAGES 赋值")

    def _pages_from_publish_sh(self) -> list[str]:
        import re

        source = SCRIPT.read_text(encoding="utf-8")
        match = re.search(r"^PAGES=\(([^)]*)\)", source, re.M)
        if not match:
            raise AssertionError("publish-workbench.sh 里找不到 PAGES 数组")
        return match.group(1).split()

    def test_three_page_manifests_agree(self):
        build_pages = self._pages_from_build_py()
        shell_pages = self._pages_from_publish_sh()

        self.assertEqual(
            sorted(build_pages),
            sorted(shell_pages),
            "build.py 与 publish-workbench.sh 的 PAGES 不一致——"
            "会导致新增页面构建了却发不到公网",
        )
        self.assertEqual(
            sorted(build_pages),
            sorted(PAGES),
            "本测试文件的 PAGES 常量与 build.py 不一致",
        )


if __name__ == "__main__":
    unittest.main()
