#!/usr/bin/env python3
"""热点抓取器 —— 只抓原文，不做判断。

这是热点刷新的**第一步**（共两步）：

    1. 本脚本从公开数据源抓当天的热门条目，写进雷达文件的「📡 全量抓取」区
    2. 你对 AI 说「刷新热点雷达」，它读全量区 → 过方向三问 → 挑出值得做的几条，
       补上「你要讲的角度」和「钩子」，写进「⭐ 今日值得做的」区

为什么拆两步：抓取是确定性的，判断不是。**角度和钩子必须由懂你账号方向的人/AI 来写**，
脚本自动生成的只会是模板话术，看着有、其实没用。

零依赖，只用标准库。不需要 API key，不需要定时任务。

    python3 tools/fetch_trends.py                  # 抓取并写入雷达文件
    python3 tools/fetch_trends.py --dry-run        # 只打印，不写文件
    python3 tools/fetch_trends.py --sources hackernews
    python3 tools/fetch_trends.py --vault ~/my-vault --limit 30
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from html.parser import HTMLParser
from pathlib import Path
from xml.etree import ElementTree

DEFAULT_VAULT = Path(__file__).resolve().parents[1]
CONFIG_PATH = Path(__file__).resolve().parent / "trends-sources.json"
RADAR_REL = "01-内容生产/选题管理/🔥每日热点雷达.md"
FULL_HEADING = "## 📡 全量抓取"
TODAY_HEADING = "## ⭐ 今日值得做的"
TIMEOUT = 20


# ---------------------------------------------------------------------------
# 工具
# ---------------------------------------------------------------------------

class _TextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.parts: list[str] = []

    def handle_data(self, data: str) -> None:
        self.parts.append(data)


def strip_html(raw: str) -> str:
    parser = _TextExtractor()
    try:
        parser.feed(raw or "")
    except Exception:
        return re.sub(r"<[^>]+>", "", raw or "")
    return re.sub(r"\s+", " ", "".join(parser.parts)).strip()


def one_line(text: str, limit: int = 220) -> str:
    """折成单行——多行会破坏 `> - 原文：` 这种 blockquote 字段结构。"""
    text = re.sub(r"\s+", " ", (text or "").replace("|", "｜")).strip()
    return text[: limit - 1] + "…" if len(text) > limit else text


def get_json(url: str) -> object:
    request = urllib.request.Request(url, headers={"User-Agent": "content-workbench/1.0"})
    with urllib.request.urlopen(request, timeout=TIMEOUT) as response:
        return json.load(response)


def get_bytes(url: str) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": "content-workbench/1.0"})
    with urllib.request.urlopen(request, timeout=TIMEOUT) as response:
        return response.read()


# ---------------------------------------------------------------------------
# 数据源适配器：每个返回 [{title, excerpt, source, metrics, url, created_at}]
# ---------------------------------------------------------------------------

def fetch_hackernews(config: dict) -> list[dict]:
    limit = int(config.get("limit", 20))
    data = get_json(f"https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage={limit}")
    items = []
    for hit in data.get("hits", []):  # type: ignore[union-attr]
        url = hit.get("url") or f"https://news.ycombinator.com/item?id={hit.get('objectID')}"
        points, comments = hit.get("points") or 0, hit.get("num_comments") or 0
        items.append({
            "title": one_line(hit.get("title") or "", 120),
            "excerpt": one_line(strip_html(hit.get("story_text") or "")),
            "source": "Hacker News 首页",
            "metrics": f"score {points} · {comments} 评论",
            "url": url,
            "created_at": hit.get("created_at") or "",
        })
    return [item for item in items if item["title"]]


def fetch_github(config: dict) -> list[dict]:
    limit = int(config.get("limit", 15))
    days = int(config.get("days", 7))
    language = config.get("language") or ""
    since_date = (datetime.now(timezone.utc) - timedelta(days=days)).date().isoformat()
    query = f"created:>{since_date}" + (f" language:{language}" if language else "")
    url = (
        "https://api.github.com/search/repositories"
        f"?q={urllib.parse.quote(query)}&sort=stars&order=desc&per_page={limit}"
    )
    data = get_json(url)
    items = []
    for repo in data.get("items", []):  # type: ignore[union-attr]
        items.append({
            "title": one_line(repo.get("full_name") or "", 120),
            "excerpt": one_line(repo.get("description") or ""),
            "source": f"GitHub 新项目（近 {days} 天）",
            "metrics": f"score {repo.get('stargazers_count') or 0}",
            "url": repo.get("html_url") or "",
            "created_at": repo.get("created_at") or "",
        })
    return [item for item in items if item["title"]]


def fetch_rss(config: dict) -> list[dict]:
    url, name = config.get("url", ""), config.get("name") or config.get("url", "RSS")
    limit = int(config.get("limit", 10))
    if not url:
        raise ValueError("rss 源缺少 url 字段")
    root = ElementTree.fromstring(get_bytes(url))
    entries = root.findall(".//item") or root.findall(".//{http://www.w3.org/2005/Atom}entry")
    items = []
    for entry in entries[:limit]:
        def text(*tags: str) -> str:
            for tag in tags:
                node = entry.find(tag)
                if node is not None:
                    return strip_html(node.text or "") or (node.get("href") or "")
            return ""

        link = text("link") or (
            entry.find("{http://www.w3.org/2005/Atom}link").get("href", "")  # type: ignore[union-attr]
            if entry.find("{http://www.w3.org/2005/Atom}link") is not None else ""
        )
        items.append({
            "title": one_line(text("title", "{http://www.w3.org/2005/Atom}title"), 120),
            "excerpt": one_line(text(
                "description", "summary",
                "{http://www.w3.org/2005/Atom}summary", "{http://www.w3.org/2005/Atom}content",
            )),
            "source": name,
            "metrics": "",  # RSS 没有互动数，按数据契约：抓不到就省略，不编
            "url": link,
            "created_at": text("pubDate", "{http://www.w3.org/2005/Atom}updated"),
        })
    return [item for item in items if item["title"]]


ADAPTERS = {"hackernews": fetch_hackernews, "github": fetch_github, "rss": fetch_rss}

BUILTIN_SOURCES = [
    {"id": "hackernews", "type": "hackernews", "label": "Hacker News 首页", "limit": 20, "enabled": True},
    {"id": "github", "type": "github", "label": "GitHub 新星项目", "limit": 15, "days": 7, "enabled": True},
]


def load_sources() -> list[dict]:
    if CONFIG_PATH.exists():
        with CONFIG_PATH.open(encoding="utf-8") as handle:
            configured = json.load(handle).get("sources", [])
        if configured:
            return configured
    return BUILTIN_SOURCES


# ---------------------------------------------------------------------------
# 渲染（纯函数，可离线测试）
# ---------------------------------------------------------------------------

def render_full_section(groups: list[tuple[str, list[dict]]], failures: list[str], fetched_at: str = "") -> str:
    """渲染「📡 全量抓取」整段。格式必须与 build.py 的 parse_radar 对齐。"""
    total = sum(len(items) for _, items in groups)
    parts = [FULL_HEADING, ""]
    breakdown = "；".join(f"{label}：{len(items)}" for label, items in groups) or "无"
    parts.append(f"抓取时间：{fetched_at}")
    parts.append("")
    parts.append(f"本次共抓取 {total} 条（{breakdown}）。按来源分组列出。")
    if failures:
        parts.append("")
        parts.append("> [!warning] 本次有源不可达，已如实记录，未用任何占位内容补足：")
        for failure in failures:
            parts.append(f"> - {failure}")
    parts.append("")

    for label, items in groups:
        if not items:
            continue
        parts.append(f"> [!note]- {label}（{len(items)} 条）")
        parts.append(">")
        for index, item in enumerate(items, start=1):
            parts.append(f"> {index}. {item['title']}")
            if item.get("excerpt"):
                parts.append(f"> - 原文：{item['excerpt']}")
            parts.append(f"> - 来源：{item['source']}")
            if item.get("metrics"):
                parts.append(f"> - 互动：{item['metrics']}")
            if item.get("url"):
                parts.append(f"> - 链接：{item['url']}")
            if item.get("created_at"):
                parts.append(f"> - 时间：{item['created_at']}")
        parts.append("")
    return "\n".join(parts).rstrip() + "\n"


NEW_FILE_TEMPLATE = """---
tags: [热点雷达, 选题, {date}]
type: 选题
status: 持续更新
created: {date}
---

# 🔥每日热点雷达

更新时间：{pretty_date}

{today_placeholder}
"""

TODAY_PLACEHOLDER = """## ⭐ 今日值得做的

> [!warning] 待加工——本区由你或 AI 填写，抓取脚本不会自动生成。
>
> 下一步：对 AI 说「**刷新热点雷达**」。它会读下面的「📡 全量抓取」，
> 逐条过方向三问，挑出方向内的几条，补上「你要讲的角度」和「钩子」写到这里。
> 详见 `docs/热点刷新流程.md`。
"""


def merge_into_radar(existing: str, full_section: str, now: datetime) -> str:
    """保留精选区与文件头，只替换「📡 全量抓取」整段。

    这样两步流程谁先谁后都安全：抓取不会覆盖 AI 写的精选，AI 也不用管抓取格式。
    """
    date = now.strftime("%Y-%m-%d")
    if not existing.strip():
        head = NEW_FILE_TEMPLATE.format(
            date=date,
            pretty_date=now.strftime("%Y年%m月%d日"),
            today_placeholder=TODAY_PLACEHOLDER,
        )
    else:
        head = existing.split(FULL_HEADING, 1)[0]
        if TODAY_HEADING not in head:
            head = head.rstrip() + "\n\n" + TODAY_PLACEHOLDER + "\n"
    return head.rstrip() + "\n\n" + full_section


# ---------------------------------------------------------------------------

def update_state(vault: Path, now: datetime, count: int) -> None:
    """回填 .cheat-state.json 的抓取时间。

    不写的话，会话状态报告会一直按旧值报「上次抓热点 N 天前」——
    雷达其实是新的，告警却在撒谎，比没有告警更糟。
    """
    path = vault / ".cheat-state.json"
    if not path.exists():
        return
    try:
        state = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        print("⚠️  .cheat-state.json 读不动，跳过抓取时间回填", file=sys.stderr)
        return
    state["last_trends_run_at"] = now.astimezone().isoformat(timespec="seconds")
    state["last_trends_added_count"] = count
    path.write_text(json.dumps(state, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="抓取公开热点写入雷达文件的全量抓取区")
    parser.add_argument("--vault", type=Path, default=DEFAULT_VAULT, help="vault 根目录")
    parser.add_argument("--sources", default="", help="只跑指定源（逗号分隔的 id）")
    parser.add_argument("--limit", type=int, default=None, help="覆盖每个源的条数上限")
    parser.add_argument("--dry-run", action="store_true", help="只打印结果，不写文件")
    args = parser.parse_args(argv)

    sources = [s for s in load_sources() if s.get("enabled", True)]
    if args.sources:
        wanted = {s.strip() for s in args.sources.split(",") if s.strip()}
        sources = [s for s in sources if s.get("id") in wanted]
    if not sources:
        print("没有启用的数据源——检查 tools/trends-sources.json", file=sys.stderr)
        return 2

    groups: list[tuple[str, list[dict]]] = []
    failures: list[str] = []
    for source in sources:
        adapter = ADAPTERS.get(source.get("type", ""))
        label = source.get("label") or source.get("id") or source.get("type", "未知源")
        if adapter is None:
            failures.append(f"{label}：未知的源类型 `{source.get('type')}`")
            continue
        config = dict(source)
        if args.limit:
            config["limit"] = args.limit
        try:
            items = adapter(config)
        except (urllib.error.URLError, urllib.error.HTTPError, ValueError, ElementTree.ParseError, OSError) as exc:
            failures.append(f"{label}：抓取失败（{type(exc).__name__}: {exc}）")
            print(f"⚠️  {label} 抓取失败：{exc}", file=sys.stderr)
            continue
        groups.append((label, items))
        print(f"✅ {label}：{len(items)} 条")

    if not groups and failures:
        print("❌ 全部数据源都失败了，不写文件（避免用空内容覆盖上一次的抓取）", file=sys.stderr)
        return 1

    now = datetime.now()
    section = render_full_section(groups, failures, now.strftime("%Y-%m-%d %H:%M"))

    if args.dry_run:
        print("\n" + section)
        return 0

    radar_path = args.vault / RADAR_REL
    radar_path.parent.mkdir(parents=True, exist_ok=True)
    existing = radar_path.read_text(encoding="utf-8") if radar_path.exists() else ""
    radar_path.write_text(merge_into_radar(existing, section, now), encoding="utf-8")

    total = sum(len(items) for _, items in groups)
    update_state(args.vault, now, total)
    print(f"\n📡 已写入 {radar_path}（{total} 条，精选区未改动）")
    print("下一步：对 AI 说「刷新热点雷达」，让它挑选并补角度/钩子")
    print("然后：cd dashboard && python3 build.py")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
