#!/usr/bin/env python3
"""开源就绪审计 —— 结构性检查，回答「这个仓库能不能拿出去见人」。

和 oss_scan.py 分工：
    oss_scan.py   查**泄漏**（真名、密钥、私有路径）——命中即阻断导出
    oss_audit.py  查**破绽**（死链、占位符、缺署名、契约不一致）——命中即提醒

    python3 tools/oss_audit.py ~/Documents/OSS/obsidian-creator-workbench

退出码：0 = 全通过；1 = 有 error；2 = 只有 warning。
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from pathlib import Path

TEXT_MD = "*.md"
SKIP_DIRS = {".git", "__pycache__", ".pytest_cache", "node_modules"}

# 语法示范用的双链，不算死链
LINK_ALLOWLIST = {"链接", "双向链接", "02-素材库"}

PAGES = ("index", "ideas", "auto-hotspots", "radar", "pipeline", "analytics", "library", "cheat", "dbs")

# 必须保留的第三方署名：(说明, 应出现的文件, 关键词)
ATTRIBUTIONS = [
    ("cheat-on-content 出处", "README.md", "cheat-on-content"),
    ("cheat-on-content 出处", "CLAUDE.md", "cheat-on-content"),
    ("对标账号署名", "05-方法论沉淀/传播心理学与爆款方法论.md", "来源："),
    ("MIT 许可证", "LICENSE", "MIT License"),
]

# (正则, 说明, 是否致命, 限定后缀|None)。XXX 不查——中文正文里「赚了 XXX」「记录选题：xxx」是正常写法，噪音远大于价值。
PLACEHOLDERS = [
    (r"<this-repo>", "README 还留着 <this-repo> 占位，应换成真实仓库地址", True, {".md"}),
    (r"lorem ipsum", "占位假文", True, {".md"}),
    (r"（待填）|\(待填\)|待补充说明", "未填写的占位", True, {".md"}),
    (r"\bTODO\b", "代码里的 TODO（开源可接受，但确认是有意保留的）", False, None),
    (r"\bFIXME\b", "代码里的 FIXME", False, None),
    (r"\bTBD\b", "遗留 TBD", False, None),
]

# 占位符/绝对路径只查这些后缀：.css/.js/.html 是资源与构建产物，类名 `.todo` 之类会大量误报
CONTENT_SUFFIXES = {".md", ".py", ".sh", ".json", ".yml", ".yaml"}


class Audit:
    def __init__(self, root: Path) -> None:
        self.root = root
        self.errors: list[str] = []
        self.warnings: list[str] = []
        self.passed: list[str] = []
        self._published: set[Path] | None = None

    def error(self, msg: str) -> None:
        self.errors.append(msg)

    def warn(self, msg: str) -> None:
        self.warnings.append(msg)

    def ok(self, msg: str) -> None:
        self.passed.append(msg)

    def published_files(self) -> set[Path]:
        """只审会被发布出去的文件——gitignore 掉的构建产物不算数。"""
        if self._published is not None:
            return self._published
        try:
            out = subprocess.run(
                ["git", "ls-files", "-z"], cwd=self.root, capture_output=True, text=True, check=True
            ).stdout.split("\0")
            self._published = {(self.root / line).resolve() for line in out if line}
        except (subprocess.CalledProcessError, FileNotFoundError):
            self._published = set()  # 非 git 仓库：退化成全审
        return self._published

    def is_published(self, path: Path) -> bool:
        published = self.published_files()
        return not published or path.resolve() in published

    def md_files(self) -> list[Path]:
        return [
            p for p in sorted(self.root.rglob(TEXT_MD))
            if not any(part in SKIP_DIRS for part in p.parts) and self.is_published(p)
        ]

    def text_files(self) -> list[Path]:
        out = []
        for suffix in CONTENT_SUFFIXES:
            out += [
                p for p in self.root.rglob(f"*{suffix}")
                if not any(part in SKIP_DIRS for part in p.parts) and self.is_published(p)
            ]
        return sorted(set(out))

    # -- 检查项 -------------------------------------------------------------

    def check_dangling_wikilinks(self) -> None:
        names = {p.stem for p in self.md_files()}
        dangling: dict[str, str] = {}
        for path in self.md_files():
            for match in re.finditer(r"\[\[([^\]|#]+)", path.read_text(encoding="utf-8")):
                target = match.group(1).strip()
                if target and target not in names and target not in LINK_ALLOWLIST:
                    dangling.setdefault(target, str(path.relative_to(self.root)))
        if dangling:
            for target, where in sorted(dangling.items()):
                self.warn(f"悬空双链 [[{target}]]  ← {where}")
        else:
            self.ok(f"双链全部可解析（{len(names)} 个笔记）")

    def check_relative_links(self) -> None:
        broken = []
        for path in self.md_files():
            base = path.parent
            for match in re.finditer(r"\[[^\]]*\]\(([^)#][^)]*)\)", path.read_text(encoding="utf-8")):
                target = match.group(1).split("#")[0].strip()
                if not target or target.startswith(("http://", "https://", "mailto:")):
                    continue
                resolved = (base / target).resolve()
                if not resolved.exists():
                    broken.append(f"{path.relative_to(self.root)} → {target}")
        if broken:
            for item in broken:
                self.error(f"文档链接失效：{item}")
        else:
            self.ok("Markdown 相对链接与图片引用全部有效")

    def check_placeholders(self) -> None:
        hits = []
        for path in self.text_files():
            # 审计脚本自己定义了这些模式，跳过
            if path.name in {"oss_audit.py"}:
                continue
            try:
                text = path.read_text(encoding="utf-8")
            except (UnicodeDecodeError, OSError):
                continue
            for pattern, label, fatal, only_suffixes in PLACEHOLDERS:
                if only_suffixes and path.suffix not in only_suffixes:
                    continue
                for match in re.finditer(pattern, text):
                    line = text.count("\n", 0, match.start()) + 1
                    hits.append((fatal, f"{path.relative_to(self.root)}:{line}  {label}"))
        for fatal, item in hits:
            (self.error if fatal else self.warn)(f"占位符：{item}")
        if not any(fatal for fatal, _ in hits):
            self.ok("无 <this-repo> / 待填 / 假文等致命占位")

    def check_absolute_paths(self) -> None:
        hits = []
        for path in self.text_files():
            if path.name == "oss_audit.py":
                continue
            try:
                text = path.read_text(encoding="utf-8")
            except (UnicodeDecodeError, OSError):
                continue
            for match in re.finditer(r"/Users/[A-Za-z0-9_.\-]+|[C-Z]:\\\\Users\\\\", text):
                line = text.count("\n", 0, match.start()) + 1
                hits.append(f"{path.relative_to(self.root)}:{line}  {match.group(0)}")
        if hits:
            for item in hits:
                self.error(f"本机绝对路径：{item}")
        else:
            self.ok("无本机绝对路径")

    def check_exec_bits(self) -> None:
        bad = [
            str(p.relative_to(self.root))
            for p in self.root.rglob("*.sh")
            if not any(part in SKIP_DIRS for part in p.parts) and not os.access(p, os.X_OK)
        ]
        if bad:
            for item in bad:
                self.error(f"shell 脚本缺可执行位（clone 后跑不了）：{item}")
        else:
            self.ok("所有 .sh 都带可执行位")

    def check_attributions(self) -> None:
        missing = []
        for label, rel, keyword in ATTRIBUTIONS:
            path = self.root / rel
            if not path.exists():
                missing.append(f"{label}：文件不存在 {rel}")
            elif keyword not in path.read_text(encoding="utf-8"):
                missing.append(f"{label}：{rel} 里找不到 `{keyword}`")
        if missing:
            for item in missing:
                self.error(f"署名/许可缺失：{item}")
        else:
            self.ok(f"第三方署名与许可证齐全（{len(ATTRIBUTIONS)} 项）")

    def check_pages_contract(self) -> None:
        """新增页面必须三处同改，历史上漏过。"""
        build = (self.root / "dashboard" / "build.py").read_text(encoding="utf-8")
        script = (self.root / "06-业务运营" / "cron" / "publish-workbench.sh").read_text(encoding="utf-8")
        test = (self.root / "dashboard" / "tests" / "test_publish_workbench.py").read_text(encoding="utf-8")
        missing = []
        for page in PAGES:
            for name, text in (("build.py", build), ("publish-workbench.sh", script), ("test_publish_workbench.py", test)):
                if page not in text:
                    missing.append(f"{name} 缺页面 `{page}`")
        if missing:
            for item in missing:
                self.error(f"PAGES 三方清单不一致：{item}")
        else:
            self.ok(f"PAGES 清单三处一致（{len(PAGES)} 页）")

    def check_gitignore_effective(self) -> None:
        try:
            tracked = subprocess.run(
                ["git", "ls-files"], cwd=self.root, capture_output=True, text=True, check=True
            ).stdout.splitlines()
        except (subprocess.CalledProcessError, FileNotFoundError):
            self.warn("不是 git 仓库或 git 不可用，跳过构建产物检查")
            return
        leaked = [
            f for f in tracked
            if re.fullmatch(r"dashboard/[a-z-]+\.html", f) or f == "dashboard/assets/data.json"
        ]
        if leaked:
            for item in leaked:
                self.error(f"构建产物被提交了（内嵌全量 vault 数据）：{item}")
        else:
            self.ok("构建产物未进版本库")

    def check_front_matter(self) -> None:
        """内容目录里的 md 必须有 front matter，否则看板和 Dataview 都看不到。"""
        need = ["02-素材库", "05-方法论沉淀", "07-赚钱方法收集", "08-低粉爆款", "03-已发布内容"]
        missing = []
        for folder in need:
            base = self.root / folder
            if not base.is_dir():
                continue
            for path in sorted(base.rglob(TEXT_MD)):
                if path.name.startswith("_"):
                    continue
                text = path.read_text(encoding="utf-8")
                if not text.startswith("---"):
                    missing.append(str(path.relative_to(self.root)))
                    continue
                head = text.split("---", 2)[1] if text.count("---") >= 2 else ""
                for key in ("type:", "status:", "created:"):
                    if key not in head:
                        missing.append(f"{path.relative_to(self.root)}（缺 {key.rstrip(':')}）")
                        break
        if missing:
            for item in missing:
                self.warn(f"front matter 不完整：{item}")
        else:
            self.ok("内容目录的 front matter 齐全")

    def check_demo_marked(self) -> None:
        """示例内容必须自我标注为虚构，别让人当成真实数据。"""
        samples = [
            "candidates.md", "benchmark.md", "audience.md", "rubric-memo.md",
            "01-内容生产/选题管理/00-选题记录.md",
            "01-内容生产/选题管理/02-选题排期.md",
            "01-内容生产/选题管理/🔥每日热点雷达.md",
        ]
        unmarked = []
        for rel in samples:
            path = self.root / rel
            if not path.exists():
                unmarked.append(f"{rel}（文件缺失）")
                continue
            head = path.read_text(encoding="utf-8")[:1200]
            if not re.search(r"示例|虚构|demo", head, re.I):
                unmarked.append(rel)
        if unmarked:
            for item in unmarked:
                self.warn(f"示例文件未标注为虚构：{item}")
        else:
            self.ok("示例内容都标注了「虚构/示例」")

    def check_empty_files(self) -> None:
        empty = [
            str(p.relative_to(self.root))
            for p in self.md_files()
            if len(p.read_text(encoding="utf-8").strip()) < 20
        ]
        if empty:
            for item in empty:
                self.warn(f"近乎空的文件：{item}")
        else:
            self.ok("没有空文件")

    def check_readme_anchors(self) -> None:
        readme = self.root / "README.md"
        if not readme.exists():
            self.error("缺 README.md")
            return
        text = readme.read_text(encoding="utf-8")
        headings = set()
        for match in re.finditer(r"(?m)^#{2,4}\s+(.+?)\s*$", text):
            slug = re.sub(r"[^\w一-鿿\- ]", "", match.group(1)).strip().replace(" ", "-")
            headings.add(slug.lower())
        broken = []
        for match in re.finditer(r"\]\(#([^)]+)\)", text):
            if match.group(1).lower() not in headings:
                broken.append(match.group(1))
        if broken:
            for item in broken:
                self.warn(f"README 目录锚点失效：#{item}")
        else:
            self.ok("README 目录锚点全部有效")

    def check_build_runs(self) -> None:
        dashboard = self.root / "dashboard"
        try:
            result = subprocess.run(
                [sys.executable, "build.py"], cwd=dashboard,
                capture_output=True, text=True, timeout=180,
            )
        except (OSError, subprocess.TimeoutExpired) as exc:
            self.error(f"构建跑不起来：{exc}")
            return
        if result.returncode != 0:
            self.error(f"构建失败：{result.stderr.strip()[:300]}")
            return
        for warning in [l for l in result.stderr.splitlines() if l.startswith("warning:")]:
            self.warn(f"构建告警：{warning}")
        missing = [p for p in PAGES if not (dashboard / f"{p}.html").is_file()]
        if missing:
            self.error(f"构建后缺页面：{missing}")
        else:
            self.ok(f"clone 即可构建，{len(PAGES)} 页全部生成")

    # -----------------------------------------------------------------------

    def run(self) -> int:
        for check in (
            self.check_build_runs,
            self.check_pages_contract,
            self.check_gitignore_effective,
            self.check_attributions,
            self.check_absolute_paths,
            self.check_placeholders,
            self.check_relative_links,
            self.check_exec_bits,
            self.check_readme_anchors,
            self.check_front_matter,
            self.check_demo_marked,
            self.check_dangling_wikilinks,
            self.check_empty_files,
        ):
            try:
                check()
            except Exception as exc:  # 一个检查炸了不该拖垮整轮审计
                self.error(f"检查 {check.__name__} 自身出错：{type(exc).__name__}: {exc}")

        print(f"\n{'=' * 60}\n开源就绪审计 · {self.root}\n{'=' * 60}\n")
        for item in self.passed:
            print(f"  ✅ {item}")
        if self.warnings:
            print(f"\n  ── 提醒 {len(self.warnings)} 条 ──")
            for item in self.warnings:
                print(f"  ⚠️  {item}")
        if self.errors:
            print(f"\n  ── 必须修 {len(self.errors)} 条 ──")
            for item in self.errors:
                print(f"  ❌ {item}")
        print()
        if self.errors:
            print(f"❌ 审计未通过：{len(self.errors)} 个 error，{len(self.warnings)} 个 warning")
            return 1
        if self.warnings:
            print(f"⚠️  审计通过但有 {len(self.warnings)} 条提醒")
            return 2
        print("✅ 审计全绿，可以开源")
        return 0


def main(argv: list[str]) -> int:
    if len(argv) < 2:
        print("usage: oss_audit.py <仓库目录>", file=sys.stderr)
        return 1
    root = Path(argv[1]).expanduser().resolve()
    if not root.is_dir():
        print(f"目录不存在：{root}", file=sys.stderr)
        return 1
    return Audit(root).run()


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
