#!/usr/bin/env python3
"""Build the Obsidian-backed static dashboard.

The script intentionally uses only the Python standard library so the
dashboard can be rebuilt anywhere the vault can be opened.
"""

from __future__ import annotations

import argparse
import hashlib
import html
import json
import re
import shutil
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


DASHBOARD_DIR = Path(__file__).resolve().parent
PAGES = ("index", "ideas", "auto-hotspots", "radar", "pipeline", "analytics", "library", "cheat", "dbs")
CONTENT_TYPES = ["共鸣类", "AI教程向", "AI赚钱方式", "方法论", "热点"]
SCORE_KEYS = ("ER", "SR", "HP", "QL", "NA", "AB", "SAT")

# ---------------------------------------------------------------------------
# rubric v0 生效口径（唯一真源 = rubric_notes.md，不是 CLAUDE.md）
#   composite = (ER + HP + QL + NA + AB + SR + SAT) / 7 × 2.0，每维 0-5
# CLAUDE.md 里的加权 / 0-10 / SAT=满足感 是过时描述；看板只读只报，绝不改写。
# ---------------------------------------------------------------------------
RUBRIC_DIMS = (
    ("ER", "情感共鸣", "Emotional Resonance"),
    ("HP", "钩子强度", "Hook Potential"),
    ("QL", "金句密度", "Quotable Lines"),
    ("NA", "叙事性", "Narrativity"),
    ("AB", "受众广度", "Audience Breadth"),
    ("SR", "社会议题共振", "Social Resonance"),
    ("SAT", "讽刺深度", "Satire Depth"),
)
RUBRIC_DIM_CODES = tuple(code for code, _, _ in RUBRIC_DIMS)
RUBRIC_DIM_CN = {code: cn for code, cn, _ in RUBRIC_DIMS}
RUBRIC_DIM_EN = {code: en for code, _, en in RUBRIC_DIMS}
RUBRIC_FORMULA = "(ER + HP + QL + NA + AB + SR + SAT) / 7 × 2.0"
RUBRIC_SCALE = "0-5"
# v2.1 roadmap 候选维度——当前未生效，页面只以幽灵 chip 呈现，不参与任何计算。
RUBRIC_CANDIDATE_DIMS = (
    {
        "code": "MS",
        "name_cn": "模因可挪用性",
        "name_en": "Memetic Shareability",
        "status": "v2.1 候选 · 未生效",
    },
    {
        "code": "TS",
        "name_cn": "议题分享冲动",
        "name_en": "Topic Shareability",
        "status": "v2.1 候选 · 未生效",
    },
)
RUBRIC_CANDIDATE_NOTE = "v2.1 计划用 TS 替代 AB、砍 NA — 尚未 bump"
# §6.4：与 cheat-bump Phase 5d 相同的实绩语句 grep（只读只报，绝不改文件）
CONTAM = re.compile(r"\d+\s*[wWmMkK万]|播放|阅读|点赞|评论数|转发|实绩|实际")
# ⑤ 拍摄站的判定常量（页面渲染为 12px 注）
V2_TRIGGER_THRESHOLD = "30%"
DIFF_METRIC = "char_levenshtein_normalized"
DOSSIER_STAGES = (
    ("draft", "① 草稿"),
    ("review", "② 诊断"),
    ("predict_v1", "③ 盲评 v1"),
    ("predict_v2", "④ 重判 v2"),
    ("shoot", "⑤ 拍摄"),
    ("publish", "⑥ 发布"),
    ("retro", "⑦ T+3 复盘"),
    ("bump", "⑧ rubric 去向"),
)
RETRO_ONLY_NA_HINT = "n/a — 数据已被看过，按盲测协议不可补写预测"
LIBRARY_USAGE = {
    "概念": "可复用的理论框架——写稿时引用，省得每次从零解释概念",
    "金句": "能直接抄进文案/标题的高质量句子",
    "案例": "AI 领域真实案例/数据——给观点托底",
    "爆款": "已验证的内容结构模板——仿写套用",
    "研究": "选题与内容研究材料——用于拆角度和补证据",
    "其他": "暂未归类的素材——复盘后再归档到具体弹药箱",
}
LIBRARY_CATEGORY_ORDER = ("概念", "金句", "案例", "爆款", "研究", "其他")


def read_text(path: Path, warnings: list[str]) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except FileNotFoundError:
        warnings.append(f"missing file: {path}")
    except UnicodeDecodeError as exc:
        warnings.append(f"cannot decode {path}: {exc}")
    except OSError as exc:
        warnings.append(f"cannot read {path}: {exc}")
    return ""


def parse_simple_yaml_value(value: str) -> Any:
    value = value.strip()
    if not value:
        return ""
    if value.startswith("[") and value.endswith("]"):
        inner = value[1:-1].strip()
        if not inner:
            return []
        return [parse_simple_yaml_value(part) for part in split_csv_like(inner)]
    if (value.startswith('"') and value.endswith('"')) or (
        value.startswith("'") and value.endswith("'")
    ):
        return value[1:-1]
    lower = value.lower()
    if lower in {"null", "none", "~"}:
        return None
    if lower == "true":
        return True
    if lower == "false":
        return False
    if re.fullmatch(r"-?\d+", value):
        try:
            return int(value)
        except ValueError:
            return value
    if re.fullmatch(r"-?\d+\.\d+", value):
        try:
            return float(value)
        except ValueError:
            return value
    return value


def split_csv_like(text: str) -> list[str]:
    parts: list[str] = []
    current: list[str] = []
    quote: str | None = None
    for char in text:
        if char in {"'", '"'}:
            quote = None if quote == char else char if quote is None else quote
            current.append(char)
        elif char == "," and quote is None:
            parts.append("".join(current).strip())
            current = []
        else:
            current.append(char)
    if current:
        parts.append("".join(current).strip())
    return parts


def parse_front_matter(text: str) -> tuple[dict[str, Any], str]:
    if not text.startswith("---"):
        return {}, text
    normalized = text.replace("\r\n", "\n")
    end = normalized.find("\n---", 3)
    if end == -1:
        return {}, text
    block = normalized[3:end].strip("\n")
    body = normalized[end + 4 :].lstrip("\n")
    data: dict[str, Any] = {}
    for raw_line in block.splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or ":" not in line:
            continue
        key, value = line.split(":", 1)
        data[key.strip()] = parse_simple_yaml_value(value)
    return data, body


def clean_markdown(text: Any) -> str:
    if text is None:
        return ""
    value = str(text).strip()
    value = re.sub(r"<!--.*?-->", "", value, flags=re.S)
    value = re.sub(r"\[\[([^\]|]+)\|([^\]]+)\]\]", r"\2", value)
    value = re.sub(r"\[\[([^\]]+)\]\]", r"\1", value)
    value = value.replace("**", "").replace("__", "")
    value = value.replace("`", "")
    value = re.sub(r"<br\s*/?>", " ", value, flags=re.I)
    value = re.sub(r"\s+", " ", value)
    return value.strip()


def first_heading(body: str, fallback: str) -> str:
    for line in body.splitlines():
        match = re.match(r"^#\s+(.+)", line.strip())
        if match:
            return clean_markdown(match.group(1))
    return fallback


def strip_first_h1(body: str) -> str:
    lines = body.replace("\r\n", "\n").splitlines()
    removed = False
    kept: list[str] = []
    for line in lines:
        if not removed and re.match(r"^#\s+.+", line.strip()):
            removed = True
            continue
        kept.append(line)
    return "\n".join(kept).strip("\n")


def first_method_summary(body: str) -> str:
    for line in body.splitlines():
        match = re.match(r"^\s*>\s*💡\s*(.+)$", line)
        if match:
            return clean_markdown(match.group(1))[:80]
    for line in strip_first_h1(body).splitlines():
        text = line.strip()
        if not text or text.startswith("#") or text in {"---", "***"}:
            continue
        return clean_markdown(text.lstrip("> ").strip())[:80]
    return ""


def safe_href(url: str) -> str:
    value = html.unescape(url).strip()
    if re.match(r"(?i)^\s*javascript:", value):
        return "#"
    return html.escape(value, quote=True)


def render_inline_markdown(text: str) -> str:
    value = html.escape(text, quote=True)
    value = re.sub(r"\[\[([^\]|]+)\|([^\]]+)\]\]", lambda m: m.group(2), value)
    value = re.sub(r"\[\[([^\]]+)\]\]", lambda m: m.group(1), value)
    value = re.sub(r"`([^`]+)`", r"<code>\1</code>", value)

    def link_repl(match: re.Match[str]) -> str:
        label = match.group(1)
        url = safe_href(match.group(2))
        return f'<a href="{url}" target="_blank" rel="noopener noreferrer">{label}</a>'

    value = re.sub(r"\[([^\]]+)\]\(([^)\s]+)\)", link_repl, value)
    value = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", value)
    return value


def is_table_separator(line: str) -> bool:
    text = line.strip().strip("|").strip()
    return bool(text) and all(set(cell.strip()) <= {"-", ":"} for cell in text.split("|"))


def render_table_block(lines: list[str]) -> str:
    rows = [[cell.strip() for cell in line.strip().strip("|").split("|")] for line in lines]
    if len(rows) < 2 or not is_table_separator(lines[1]):
        return "".join(f"<p>{render_inline_markdown(line.strip())}</p>" for line in lines if line.strip())
    headers = rows[0]
    body_rows = rows[2:]
    head = "".join(f"<th>{render_inline_markdown(cell)}</th>" for cell in headers)
    body = "".join(
        "<tr>" + "".join(f"<td>{render_inline_markdown(cell)}</td>" for cell in row) + "</tr>"
        for row in body_rows
    )
    return f"<table><thead><tr>{head}</tr></thead><tbody>{body}</tbody></table>"


def md_to_safe_html(body: str) -> str:
    lines = strip_first_h1(body).replace("\r\n", "\n").splitlines()
    out: list[str] = []
    paragraph: list[str] = []
    list_type: str | None = None
    i = 0

    def close_paragraph() -> None:
        nonlocal paragraph
        if paragraph:
            out.append(f"<p>{' '.join(paragraph)}</p>")
            paragraph = []

    def close_list() -> None:
        nonlocal list_type
        if list_type:
            out.append(f"</{list_type}>")
            list_type = None

    while i < len(lines):
        raw = lines[i]
        stripped = raw.strip()
        if not stripped:
            close_paragraph()
            close_list()
            i += 1
            continue

        if stripped.startswith("```"):
            close_paragraph()
            close_list()
            code_lines: list[str] = []
            i += 1
            while i < len(lines) and not lines[i].strip().startswith("```"):
                code_lines.append(lines[i])
                i += 1
            if i < len(lines):
                i += 1
            code = html.escape("\n".join(code_lines), quote=True)
            out.append(f"<pre><code>{code}</code></pre>")
            continue

        if stripped.startswith("|") and i + 1 < len(lines) and is_table_separator(lines[i + 1]):
            close_paragraph()
            close_list()
            table_lines: list[str] = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                table_lines.append(lines[i])
                i += 1
            out.append(render_table_block(table_lines))
            continue

        heading = re.match(r"^(#{1,3})\s+(.+)$", stripped)
        if heading:
            close_paragraph()
            close_list()
            level = min(len(heading.group(1)) + 1, 4)
            out.append(f"<h{level}>{render_inline_markdown(heading.group(2))}</h{level}>")
            i += 1
            continue

        if re.fullmatch(r"-{3,}|\*{3,}", stripped):
            close_paragraph()
            close_list()
            out.append("<hr>")
            i += 1
            continue

        quote = re.match(r"^>\s*(.+)$", stripped)
        if quote:
            close_paragraph()
            close_list()
            out.append(f"<blockquote>{render_inline_markdown(quote.group(1))}</blockquote>")
            i += 1
            continue

        unordered = re.match(r"^[-*]\s+(.+)$", stripped)
        ordered = re.match(r"^\d+\.\s+(.+)$", stripped)
        if unordered or ordered:
            close_paragraph()
            wanted = "ul" if unordered else "ol"
            if list_type != wanted:
                close_list()
                out.append(f"<{wanted}>")
                list_type = wanted
            content = unordered.group(1) if unordered else ordered.group(1)
            out.append(f"<li>{render_inline_markdown(content)}</li>")
            i += 1
            continue

        close_list()
        paragraph.append(render_inline_markdown(stripped))
        i += 1

    close_paragraph()
    close_list()
    return "\n".join(out)


def normalize_type(value: Any) -> str:
    text = clean_markdown(value)
    if "教程" in text:
        return "AI教程向"
    if "赚钱" in text or "变现" in text:
        return "AI赚钱方式"
    if "共鸣" in text or "观点" in text:
        return "共鸣类"
    if "方法论" in text:
        return "方法论"
    if "热点" in text:
        return "热点"
    return text or "未分类"


def normalize_status(value: Any) -> str:
    text = clean_markdown(value)
    if "已复盘" in text:
        return "已复盘"
    if "已发" in text:
        return "已发"
    if "已拍" in text:
        return "已拍"
    if "待补" in text or text in {"-", "—"}:
        return "待补"
    if "待剪" in text or "⬜" in str(value):
        return "待剪"
    return text or "待剪"


def tier_rank(tier: Any) -> int:
    match = re.search(r"tier\s*(\d+)", clean_markdown(tier), re.I)
    return int(match.group(1)) if match else 9


def normalize_title_key(value: Any) -> str:
    return re.sub(r"\s+", "", clean_markdown(value)).lower()


def parse_number(value: Any) -> float | None:
    if value is None:
        return None
    text = clean_markdown(value).replace(",", "")
    if not text or text in {"—", "-", "待填充"}:
        return None
    multiplier = 1.0
    if text.endswith("万"):
        multiplier = 10000.0
        text = text[:-1]
    elif text.lower().endswith("k"):
        multiplier = 1000.0
        text = text[:-1]
    match = re.search(r"-?\d+(?:\.\d+)?", text)
    if not match:
        return None
    try:
        return float(match.group(0)) * multiplier
    except ValueError:
        return None


def parse_candidates(path: Path, warnings: list[str]) -> list[dict[str, Any]]:
    text = read_text(path, warnings)
    candidates: list[dict[str, Any]] = []
    current: dict[str, Any] | None = None
    quote_lines: list[str] = []
    section = ""

    def finish_current() -> None:
        nonlocal current, quote_lines
        if not current:
            return
        if "归档" in current.get("section", ""):
            current = None
            quote_lines = []
            return
        fields = current.pop("_fields", {})
        current.update(fields)
        current["type"] = normalize_type(current.get("type"))
        current["status"] = clean_markdown(current.get("status")) or "候选"
        current["tier_rank"] = tier_rank(current.get("tier"))
        current["excerpt"] = clean_markdown(" ".join(quote_lines))[:220]
        candidates.append(current)
        current = None
        quote_lines = []

    for line in text.splitlines():
        section_heading = re.match(r"^##\s+(?P<section>.+?)\s*$", line)
        if section_heading:
            section = clean_markdown(section_heading.group("section"))
            continue
        heading = re.match(r"^###\s+(?:\[(?P<tier>[^\]]+)\]\s*)?(?P<title>.+?)\s*$", line)
        if heading:
            finish_current()
            current = {
                "title": clean_markdown(heading.group("title")),
                "tier": clean_markdown(heading.group("tier") or ""),
                "section": section,
                "_fields": {},
            }
            continue
        if not current:
            continue
        if "归档" in current.get("section", ""):
            continue
        field = re.match(r"^\s*-\s+\*\*(?P<key>[^*]+)\*\*:\s*(?P<value>.*)$", line)
        if field:
            key = clean_markdown(field.group("key"))
            current["_fields"][key] = clean_markdown(field.group("value"))
            continue
        if line.lstrip().startswith(">"):
            quote_lines.append(line.lstrip("> ").strip())

    finish_current()
    return candidates


def candidate_source_label(candidate: dict[str, Any]) -> str:
    source = clean_markdown(candidate.get("source"))
    section = clean_markdown(candidate.get("section"))
    if "自动化" in section or source.startswith(("aihot", "follow-builders")):
        return "自动化热点"
    return "我的灵感"


def split_table_row(line: str) -> list[str] | None:
    stripped = line.strip()
    if not stripped.startswith("|") or not stripped.endswith("|"):
        return None
    return [clean_markdown(cell) for cell in stripped.strip("|").split("|")]


def is_separator_row(cells: list[str]) -> bool:
    return bool(cells) and all(re.fullmatch(r":?-{2,}:?", cell.replace(" ", "")) for cell in cells)


def parse_table_block(lines: list[str]) -> tuple[list[str], list[dict[str, str]]]:
    rows = [split_table_row(line) for line in lines]
    rows = [row for row in rows if row]
    if len(rows) < 2:
        return [], []
    header = rows[0]
    body_rows = rows[1:]
    if body_rows and is_separator_row(body_rows[0]):
        body_rows = body_rows[1:]
    data_rows: list[dict[str, str]] = []
    for row in body_rows:
        if is_separator_row(row):
            continue
        padded = row + [""] * max(0, len(header) - len(row))
        data_rows.append({header[i]: padded[i] for i in range(len(header))})
    return header, data_rows


def iter_tables_by_section(text: str) -> list[tuple[str, list[str], list[dict[str, str]]]]:
    tables: list[tuple[str, list[str], list[dict[str, str]]]] = []
    lines = text.splitlines()
    section = ""
    index = 0
    while index < len(lines):
        line = lines[index]
        heading = re.match(r"^#{2,4}\s+(.+)", line.strip())
        if heading:
            section = clean_markdown(heading.group(1))
        if line.strip().startswith("|"):
            block: list[str] = []
            while index < len(lines) and lines[index].strip().startswith("|"):
                block.append(lines[index])
                index += 1
            header, rows = parse_table_block(block)
            if header:
                tables.append((section, header, rows))
            continue
        index += 1
    return tables


def parse_schedule(path: Path, warnings: list[str]) -> dict[str, Any]:
    fm, body = parse_front_matter(read_text(path, warnings))
    schedule: list[dict[str, Any]] = []
    inventory: list[dict[str, Any]] = []
    performance_rows: list[dict[str, str]] = []

    for section, header, rows in iter_tables_by_section(body):
        header_set = set(header)
        if {"序", "发布日", "类型", "选题", "状态"}.issubset(header_set):
            for row in rows:
                topic = clean_markdown(row.get("选题", ""))
                status = normalize_status(row.get("状态", ""))
                schedule.append(
                    {
                        "week": section,
                        "sequence": int(parse_number(row.get("序")) or len(schedule) + 1),
                        "publish_day": clean_markdown(row.get("发布日")),
                        "type": normalize_type(row.get("类型")),
                        "topic": topic,
                        "status": status,
                        "is_placeholder": bool(
                            "待补" in topic or "现抓" in topic or topic.startswith("←") or status == "待补"
                        ),
                    }
                )
        elif {"类型", "剩余", "选题"}.issubset(header_set):
            for row in rows:
                remaining = parse_number(row.get("剩余"))
                inventory.append(
                    {
                        "type": normalize_type(row.get("类型")),
                        "remaining": int(remaining or 0),
                        "raw_remaining": clean_markdown(row.get("剩余")),
                        "topics": clean_markdown(row.get("选题")),
                        "is_gap": (remaining or 0) <= 0 or "🔴" in row.get("剩余", ""),
                    }
                )
        elif {"类型", "已发篇数", "播放中位数", "赞播比"}.issubset(header_set):
            for row in rows:
                extended = dict(row)
                extended.setdefault("完播率中位", "—")
                extended.setdefault("跳出率中位", "—")
                performance_rows.append(extended)

    filled = [item for item in schedule if not item["is_placeholder"]]
    gaps = [item for item in inventory if item["is_gap"]]
    return {
        "front_matter": fm,
        "schedule": schedule,
        "filled_count": len(filled),
        "placeholder_count": len(schedule) - len(filled),
        "inventory": inventory,
        "gaps": gaps,
        "performance_rows": performance_rows,
    }


def extract_callout_title(raw: str) -> str:
    title = clean_markdown(re.sub(r"`[^`]+`", "", raw))
    title = re.sub(r"^[🔥🧠💰🔵🔴🟣🟢\s]+", "", title)
    title = re.sub(r"^(热点位|方法论位|赚钱位|共鸣/反常识备选|共鸣位)\s*[①-⑩\d]*[　\s-]*", "", title)
    return title.strip(" -")


def parse_radar_metrics(text: str) -> dict[str, Any]:
    metrics: dict[str, Any] = {}
    cleaned = clean_markdown(text)
    likes = re.search(r"(\d+(?:\.\d+)?)\s*(?:likes?|赞)", cleaned, re.I)
    retweets = re.search(r"(\d+(?:\.\d+)?)\s*(?:RT|retweets?|转发)", cleaned, re.I)
    replies = re.search(r"(\d+(?:\.\d+)?)\s*(?:replies?|评论|回复)", cleaned, re.I)
    score = re.search(r"(?:score|推荐分)\s*(\d+(?:\.\d+)?)", cleaned, re.I)
    if likes:
        metrics["likes"] = parse_number(likes.group(1))
    if retweets:
        metrics["retweets"] = parse_number(retweets.group(1))
    if replies:
        metrics["replies"] = parse_number(replies.group(1))
    if score:
        metrics["score"] = parse_number(score.group(1))
    return {key: value for key, value in metrics.items() if value is not None}


def parse_radar(path: Path, warnings: list[str]) -> dict[str, Any]:
    fm, body = parse_front_matter(read_text(path, warnings))
    lines = body.splitlines()
    signals: list[dict[str, Any]] = []
    full_fetch: list[dict[str, Any]] = []
    overview_count: int | None = None
    in_today = False
    in_full = False
    current_signal: dict[str, Any] | None = None
    current_fetch: dict[str, Any] | None = None
    current_group = ""
    callout_type = {
        "danger": "热点",
        "example": "方法论",
        "success": "AI赚钱方式",
        "tip": "共鸣类",
    }

    def finish_signal() -> None:
        nonlocal current_signal
        if current_signal:
            source_lines = current_signal.pop("_source_lines", [])
            if not current_signal.get("source"):
                current_signal["source"] = "；".join(clean_markdown(line) for line in source_lines if line)
            metrics = current_signal.get("metrics") or parse_radar_metrics(current_signal.get("source", ""))
            current_signal["metrics"] = metrics
            current_signal["likes"] = metrics.get("likes") or sum(
                int(num) for num in re.findall(r"(\d+)\s*赞", current_signal.get("source", ""))
            )
            current_signal["excerpt"] = current_signal.get("excerpt") or current_signal.get("source") or ""
            current_signal["url"] = current_signal.get("url") or ""
            signals.append(current_signal)
        current_signal = None

    def finish_fetch() -> None:
        nonlocal current_fetch
        if current_fetch:
            current_fetch["excerpt"] = current_fetch.get("excerpt") or current_fetch.get("text") or ""
            current_fetch["source"] = current_fetch.get("source") or current_fetch.get("group") or ""
            current_fetch["url"] = current_fetch.get("url") or ""
            current_fetch["metrics"] = current_fetch.get("metrics") or {}
            current_fetch["selected"] = bool(current_fetch.get("selected"))
            full_fetch.append(current_fetch)
        current_fetch = None

    for line in lines:
        if "筛出" in line and overview_count is None:
            match_count = re.search(r"筛出\s*\*?\*?(\d+)\s*条\*?\*?", line)
            if match_count:
                overview_count = int(match_count.group(1))
        if line.startswith("## ⭐"):
            in_today = True
            in_full = False
            continue
        if line.startswith("## 📊"):
            in_today = False
            finish_signal()
            continue
        if line.startswith("## 📡"):
            in_full = True
            in_today = False
            finish_signal()
            continue

        callout = re.match(r"^>\s*\[!(?P<kind>\w+)\][+-]?\s*(?P<title>.+)$", line)
        if in_today and callout:
            finish_signal()
            kind = callout.group("kind")
            title_raw = callout.group("title")
            tier = re.search(r"`([^`]*tier[^`]*)`", title_raw, re.I)
            current_signal = {
                "title": extract_callout_title(title_raw),
                "type": callout_type.get(kind, "热点"),
                "tier": clean_markdown(tier.group(1)) if tier else "",
                "tier_rank": tier_rank(tier.group(1) if tier else ""),
                "angle": "",
                "hook": "",
                "excerpt": "",
                "url": "",
                "source": "",
                "metrics": {},
                "_source_lines": [],
            }
            continue

        if current_signal and in_today:
            cleaned = line.lstrip("> ").strip()
            if "抓到的料" in cleaned:
                continue
            if cleaned.startswith("- "):
                current_signal["_source_lines"].append(cleaned[2:])
            field = re.match(r"^\*\*(原文|来源|互动|热度|链接)\*\*[:：]\s*(.+)$", cleaned)
            if field:
                key = field.group(1)
                value = clean_markdown(field.group(2))
                if key == "原文":
                    current_signal["excerpt"] = value
                elif key == "来源":
                    current_signal["source"] = value
                elif key in {"互动", "热度"}:
                    current_signal["metrics"] = parse_radar_metrics(value)
                elif key == "链接":
                    current_signal["url"] = value.strip("<>")
            if "你要讲的角度" in cleaned:
                current_signal["angle"] = clean_markdown(cleaned.split("➜", 1)[-1])
            if "钩子" in cleaned:
                current_signal["hook"] = clean_markdown(cleaned.split("：", 1)[-1])
            continue

        if in_full:
            full_callout = re.match(r"^>\s*\[!note\]-\s*(?P<title>.+)$", line)
            if full_callout:
                finish_fetch()
                current_group = clean_markdown(full_callout.group("title"))
                continue
            item = re.match(r"^>\s*(?P<num>\d+)\.\s*(?P<text>.+)$", line)
            if item:
                finish_fetch()
                raw_text = item.group("text")
                category = re.search(r"`([^`]+)`", raw_text)
                text = clean_markdown(re.sub(r"`[^`]+`", "", raw_text))
                category_text = clean_markdown(category.group(1)) if category else ""
                if category_text:
                    text = re.sub(rf"\s+{re.escape(category_text)}$", "", text).strip()
                else:
                    tail = re.search(r"\s(ai-models|ai-products|industry|paper|tip|builder)$", text)
                    if tail:
                        category_text = tail.group(1)
                        text = text[: tail.start()].strip()
                current_fetch = {
                    "group": current_group,
                    "text": text.replace("✅ ", ""),
                    "category": category_text,
                    "selected": "✅" in item.group("text"),
                    "excerpt": "",
                    "url": "",
                    "source": "",
                    "metrics": {},
                }
                continue
            if current_fetch:
                field = re.match(r"^>\s*-\s*(原文|来源|互动|热度|链接|时间)[:：]\s*(.+)$", line)
                field = field or re.match(r"^>\s{3,}-\s*(原文|来源|互动|热度|链接|时间)[:：]\s*(.+)$", line)
                if field:
                    key = field.group(1)
                    value = clean_markdown(field.group(2))
                    if key == "原文":
                        current_fetch["excerpt"] = value
                    elif key == "来源":
                        current_fetch["source"] = value
                    elif key in {"互动", "热度"}:
                        current_fetch["metrics"] = parse_radar_metrics(value)
                    elif key == "链接":
                        current_fetch["url"] = value.strip("<>")
                    elif key == "时间":
                        current_fetch["created_at"] = value

    finish_signal()
    finish_fetch()
    counts = Counter(signal["type"] for signal in signals)
    return {
        "front_matter": fm,
        "signals": signals,
        "hit_count": len(signals),
        "reported_hit_count": overview_count,
        "type_counts": dict(counts),
        "full_fetch": full_fetch,
        "updated": fm.get("updated") or fm.get("created") or "",
    }


def parse_idea_notes(path: Path, warnings: list[str]) -> list[dict[str, Any]]:
    text = read_text(path, warnings)
    if not text:
        return []
    lines = text.splitlines()
    in_pending = False
    notes: list[dict[str, Any]] = []
    for line in lines:
        heading = re.match(r"^##\s+(.+)", line.strip())
        if heading:
            in_pending = "待筛选" in clean_markdown(heading.group(1))
            continue
        if not in_pending:
            continue
        match = re.match(r"^\s*-\s+(?:\[(?P<date>[^\]]+)\]\s*)?(?P<body>.+)$", line)
        if not match:
            continue
        body = clean_markdown(match.group("body"))
        if not body or body.startswith("<!--"):
            continue
        title, source = (split_once(body, "|") or split_once(body, "｜") or (body, ""))
        notes.append(
            {
                "title": clean_markdown(title),
                "type": "未分类",
                "tier": "待筛选",
                "tier_rank": 8,
                "source_label": "随手记",
                "angle": "",
                "hook": "",
                "excerpt": clean_markdown(source),
                "note": clean_markdown(match.group("date") or source),
                "likes": None,
                "score": None,
                "score_parts": {},
            }
        )
    return notes


def split_once(text: str, separator: str) -> tuple[str, str] | None:
    if separator not in text:
        return None
    left, right = text.split(separator, 1)
    return left, right


def idea_score(item: dict[str, Any]) -> int:
    fields = ["title", "type", "tier", "angle", "hook", "excerpt", "note"]
    return sum(1 for field in fields if clean_markdown(item.get(field))) + (1 if item.get("likes") else 0)


def extract_score_parts_from_text(text: str) -> dict[str, float]:
    parts: dict[str, float] = {}
    for key in SCORE_KEYS:
        patterns = [
            rf"\b{key}\b[^\d]{{0,12}}([0-5](?:\.\d+)?)",
            rf"{key}\s*[：:|]\s*([0-5](?:\.\d+)?)",
        ]
        for pattern in patterns:
            match = re.search(pattern, text, re.I)
            if match:
                value = parse_number(match.group(1))
                if value is not None:
                    parts[key] = max(0.0, min(5.0, float(value)))
                    break
    return parts


def composite_score(parts: dict[str, float]) -> float | None:
    """v0 综合分：7 维等权。

    唯一权威是 rubric_notes.md（盲评白名单）里的 v0 公式：
        composite = (ER + SR + HP + QL + NA + AB + SAT) / 7 × 2.0
    每维 0-5 分，综合分 0-10。

    注意：v0 是 cold-start 占位，**刻意等权**——没有数据支持任何差异化权重。
    此前这里用的是 ER/SR/HP ×1.5 ÷8.5 的加权式（源自 CLAUDE.md 的过时描述），
    与不可篡改的预测日志算法不一致；两者只在各维分值均匀时碰巧相等。
    将来 cheat-bump 升到 v1 后，必须同步改这里并在 rubric-memo.md 留痕。
    """
    if not all(key in parts for key in SCORE_KEYS):
        return None
    total = sum(parts[key] for key in SCORE_KEYS)
    return round(total / len(SCORE_KEYS) * 2.0, 1)


def score_from_record(record: dict[str, Any]) -> tuple[float | None, dict[str, float]]:
    text = " ".join(clean_markdown(record.get(key, "")) for key in record)
    parts = extract_score_parts_from_text(text)
    explicit = (
        record.get("score")
        or record.get("综合分")
        or record.get("composite")
        or record.get("composite_score")
    )
    explicit_score = parse_number(explicit)
    if explicit_score is not None:
        return round(max(0.0, min(10.0, explicit_score)), 1), parts
    return composite_score(parts), parts


def parse_prediction_scores(root: Path, warnings: list[str]) -> dict[str, dict[str, Any]]:
    scores: dict[str, dict[str, Any]] = {}
    if not root.exists():
        return scores
    for path in sorted(root.rglob("*.md")):
        fm, body = parse_front_matter(read_text(path, warnings))
        title = first_heading(body, path.stem)
        for candidate_title in [title, fm.get("title"), fm.get("选题"), fm.get("topic")]:
            key = normalize_title_key(candidate_title)
            if not key:
                continue
            parts = extract_score_parts_from_text(body)
            score = composite_score(parts)
            explicit = parse_number(fm.get("score") or fm.get("综合分") or fm.get("composite_score"))
            if explicit is not None:
                score = round(max(0.0, min(10.0, explicit)), 1)
            if score is not None:
                scores[key] = {"score": score, "score_parts": parts, "score_source": str(path.relative_to(root.parent))}
    return scores


def attach_score(item: dict[str, Any], score_index: dict[str, dict[str, Any]], source: dict[str, Any] | None = None) -> dict[str, Any]:
    score_data = score_index.get(normalize_title_key(item.get("title")))
    if not score_data and source:
        score, parts = score_from_record(source)
        if score is not None:
            score_data = {"score": score, "score_parts": parts, "score_source": "candidates.md"}
    item["score"] = score_data.get("score") if score_data else None
    item["score_parts"] = score_data.get("score_parts", {}) if score_data else {}
    item["score_source"] = score_data.get("score_source", "") if score_data else ""
    return item


def build_ideas(
    candidates: list[dict[str, Any]],
    radar_data: dict[str, Any],
    notes: list[dict[str, Any]],
    score_index: dict[str, dict[str, Any]] | None = None,
) -> dict[str, Any]:
    ideas: dict[str, dict[str, Any]] = {}
    scores = score_index or {}

    def add(item: dict[str, Any]) -> None:
        title = clean_markdown(item.get("title"))
        if not title:
            return
        normalized = re.sub(r"\s+", "", title).lower()
        current = ideas.get(normalized)
        if not current or idea_score(item) > idea_score(current):
            ideas[normalized] = item

    for candidate in candidates:
        note = clean_markdown(candidate.get("note"))
        excerpt = clean_markdown(candidate.get("excerpt"))
        source_label = candidate_source_label(candidate)
        add(attach_score(
            {
                "title": candidate.get("title", ""),
                "type": normalize_type(candidate.get("type")),
                "tier": clean_markdown(candidate.get("tier")) or "候选",
                "tier_rank": tier_rank(candidate.get("tier")),
                "source_label": source_label,
                "source": clean_markdown(candidate.get("source")),
                "url": clean_markdown(candidate.get("url") or candidate.get("链接")),
                "angle": note or excerpt,
                "hook": "",
                "excerpt": excerpt,
                "note": note,
                "likes": parse_radar_metrics(candidate.get("互动", "")).get("likes"),
            },
            scores,
            candidate,
        )
        )
    for note in notes:
        add(attach_score(note, scores, note))

    items = sorted(
        ideas.values(),
        key=lambda item: (
            0 if item.get("score") is not None else 1,
            -(item.get("score") or 0),
            item.get("tier_rank", 9),
            item.get("source_label", ""),
            item.get("title", ""),
        ),
    )
    type_counts = Counter(item.get("type", "未分类") for item in items)
    source_counts = Counter(item.get("source_label", "未知") for item in items)
    tier1_count = sum(1 for item in items if item.get("tier_rank") == 1)
    return {
        "items": items,
        "summary": {
            "total": len(items),
            "tier1_count": tier1_count,
            "type_counts": dict(type_counts),
            "source_counts": dict(source_counts),
        },
    }


def parse_auto_hotspots(root: Path, radar_data: dict[str, Any], warnings: list[str]) -> dict[str, Any]:
    history_dir = root / "trends-history"
    items: list[dict[str, Any]] = []
    seen: set[tuple[str, str, str]] = set()
    url_lookup: dict[str, dict[str, Any]] = {}

    def remember_detail(row: dict[str, Any]) -> None:
        url = clean_markdown(row.get("url"))
        if not url:
            return
        excerpt = clean_markdown(row.get("excerpt") or row.get("text") or row.get("source"))
        if not excerpt:
            return
        url_lookup[url] = {
            "excerpt": excerpt,
            "source": clean_markdown(row.get("source")),
            "metrics": row.get("metrics") or {},
        }

    for signal in radar_data.get("signals", []):
        remember_detail(signal)
    for row in radar_data.get("full_fetch", []):
        remember_detail(row)

    def fallback_summary(item: dict[str, Any]) -> str:
        title = clean_markdown(item.get("title"))
        source = clean_markdown(item.get("source"))
        kind = normalize_type(item.get("type"))
        if not title:
            return ""
        if kind == "热点":
            lens = "这个热点适合判断产品/模型/平台方向变化。"
        elif kind == "方法论":
            lens = "这个信号适合拆成可复用的操作方法或工作流。"
        elif kind == "AI赚钱方式":
            lens = "这个信号适合观察商业闭环、可复制服务或工具机会。"
        elif kind == "共鸣类":
            lens = "这个信号适合讲 builder 的共同焦虑、反常识或情绪共鸣。"
        else:
            lens = "这个信号可作为选题线索继续深挖。"
        return f"{title}。来源：{source or '未标注'}。{lens}历史索引未保存完整原文，点原文链接可继续核验。"

    def add_item(item: dict[str, Any]) -> None:
        date = clean_markdown(item.get("date"))
        url = clean_markdown(item.get("url"))
        key = (date, url) if url else (date, normalize_title_key(item.get("title")), "")
        if key in seen:
            return
        seen.add(key)
        detail = url_lookup.get(url, {})
        if not clean_markdown(item.get("excerpt")) and detail.get("excerpt"):
            item["excerpt"] = detail["excerpt"]
        if not clean_markdown(item.get("source")) and detail.get("source"):
            item["source"] = detail["source"]
        if not item.get("metrics") and detail.get("metrics"):
            item["metrics"] = detail["metrics"]
        item["type"] = normalize_type(item.get("type"))
        item["tier"] = clean_markdown(item.get("tier")) or "精选"
        item["tier_rank"] = tier_rank(item.get("tier")) if item.get("tier") else 1
        item["summary"] = clean_markdown(item.get("excerpt")) or fallback_summary(item)
        items.append(item)

    if history_dir.exists():
        for path in sorted(history_dir.glob("*.md")):
            text = read_text(path, warnings)
            date = path.stem
            heading_date = re.search(r"^#\s*(\d{4}-\d{2}-\d{2})", text, re.M)
            if heading_date:
                date = heading_date.group(1)
            selected: list[dict[str, Any]] = []
            current_selected: dict[str, Any] | None = None
            for line in text.splitlines():
                match = re.match(r"^-\s+\[(?P<slot>[^\]]*位[^\]]*)\]\s+(?P<title>.+?)\s*\|\s*(?P<source>.+?)\s*\|\s*(?P<url>https?://\S+)\s*$", line.strip())
                if match:
                    slot = clean_markdown(match.group("slot"))
                    current_selected = {
                        "date": date,
                        "slot": slot,
                        "type": slot,
                        "title": clean_markdown(match.group("title")),
                        "source": clean_markdown(match.group("source")),
                        "url": clean_markdown(match.group("url")),
                        "metrics": {},
                        "excerpt": "",
                        "angle": "",
                        "hook": "",
                        "origin": str(path.relative_to(root)),
                    }
                    selected.append(current_selected)
                    continue
                if current_selected:
                    field = re.match(r"^\s*-\s*(原文/摘要|原文|摘要|互动|角度|钩子)[:：]\s*(.+)$", line)
                    if field:
                        key = field.group(1)
                        value = clean_markdown(field.group(2))
                        if key in {"原文/摘要", "原文", "摘要"}:
                            current_selected["excerpt"] = value
                        elif key == "互动":
                            current_selected["metrics"] = parse_radar_metrics(value)
                        elif key == "角度":
                            current_selected["angle"] = value
                        elif key == "钩子":
                            current_selected["hook"] = value
            for item in selected[-8:]:
                add_item(item)
    else:
        warnings.append(f"missing directory: {history_dir}")

    radar_date = clean_markdown(radar_data.get("updated")) or datetime.now().strftime("%Y-%m-%d")
    for signal in radar_data.get("signals", []):
        add_item(
            {
                "date": radar_date,
                "slot": normalize_type(signal.get("type")),
                "type": normalize_type(signal.get("type")),
                "title": clean_markdown(signal.get("title")),
                "source": clean_markdown(signal.get("source")),
                "url": clean_markdown(signal.get("url")),
                "metrics": signal.get("metrics") or {},
                "likes": signal.get("likes"),
                "excerpt": clean_markdown(signal.get("excerpt")),
                "angle": clean_markdown(signal.get("angle")),
                "hook": clean_markdown(signal.get("hook")),
                "origin": "今日热点雷达",
                "tier": clean_markdown(signal.get("tier")) or "精选",
                "tier_rank": signal.get("tier_rank") or 1,
            }
        )

    items.sort(key=lambda item: (item.get("date", ""), item.get("type", ""), item.get("title", "")), reverse=True)
    by_date: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for item in items:
        by_date[item["date"]].append(item)
    type_counts = Counter(item.get("type", "未分类") for item in items)
    source_counts = Counter(item.get("source", "未知") for item in items)
    dates = sorted(by_date.keys(), reverse=True)
    return {
        "items": items,
        "days": [{"date": date, "items": by_date[date], "count": len(by_date[date])} for date in dates],
        "summary": {
            "total": len(items),
            "day_count": len(dates),
            "latest_date": dates[0] if dates else "",
            "type_counts": dict(type_counts),
            "source_counts": dict(source_counts),
        },
    }


def category_for_library_file(path: Path) -> str:
    parts = set(path.parts)
    if "核心概念库" in parts:
        return "概念"
    if "金句库" in parts:
        return "金句"
    if "案例库" in parts:
        return "案例"
    if "爆款文稿库" in parts:
        return "爆款"
    if "选题研究" in parts:
        return "研究"
    return "其他"


def parse_library(root: Path, warnings: list[str]) -> dict[str, Any]:
    items: list[dict[str, Any]] = []
    timeline: Counter[str] = Counter()
    if not root.exists():
        warnings.append(f"missing directory: {root}")
        return {"items": [], "counts": {}, "categories": [], "timeline": [], "summary": {"total": 0}}

    for path in sorted(root.rglob("*.md")):
        if path.name.startswith("_"):
            continue
        fm, body = parse_front_matter(read_text(path, warnings))
        title = first_heading(body, path.stem)
        tags = fm.get("tags") if isinstance(fm.get("tags"), list) else []
        category = category_for_library_file(path)
        created = clean_markdown(fm.get("created"))
        if created:
            timeline[created] += 1
        items.append(
            {
                "title": title,
                "category": category,
                "usage": LIBRARY_USAGE.get(category, LIBRARY_USAGE["其他"]),
                "status": clean_markdown(fm.get("status")) or "未标注",
                "type": clean_markdown(fm.get("type")) or category,
                "created": created,
                "tags": [clean_markdown(tag) for tag in tags],
                "path": str(path.relative_to(root.parent)),
            }
        )

    counts = Counter(item["category"] for item in items)
    ordered_timeline = [{"date": key, "count": timeline[key]} for key in sorted(timeline)]
    categories = [
        {
            "name": key,
            "count": counts.get(key, 0),
            "usage": LIBRARY_USAGE.get(key, LIBRARY_USAGE["其他"]),
            "items": [item for item in items if item["category"] == key],
        }
        for key in LIBRARY_CATEGORY_ORDER
        if counts.get(key, 0)
    ]
    return {
        "items": items,
        "counts": {key: counts.get(key, 0) for key in LIBRARY_CATEGORY_ORDER},
        "categories": categories,
        "timeline": ordered_timeline,
        "summary": {"total": len(items)},
    }


def parse_methodology(root: Path, warnings: list[str]) -> dict[str, Any]:
    items: list[dict[str, Any]] = []
    # Future methodology categories only need another source/category tuple here.
    # (目录, 分类, 是否必需)。必需目录缺失才告警；vault 外的可选目录缺失属正常。
    sources = [
        (root / "05-方法论沉淀", "创作方法论", True),
        (root.parent / "05-商业与自媒体", "运营·商业", False),
        (root / "07-赚钱方法收集", "赚钱方法", True),
        (root / "08-低粉爆款", "低粉爆款", True),
    ]
    for source_dir, category, required in sources:
        if not source_dir.exists():
            if required:
                warnings.append(f"missing directory: {source_dir}")
            continue
        for path in sorted(source_dir.rglob("*.md")):
            if path.name.startswith("_"):
                continue
            fm, body = parse_front_matter(read_text(path, warnings))
            tags = (
                [clean_markdown(tag) for tag in fm.get("tags", [])]
                if isinstance(fm.get("tags"), list)
                else []
            )
            items.append(
                {
                    "title": first_heading(body, path.stem),
                    "category": category,
                    "tags": tags,
                    "summary": first_method_summary(body),
                    "updated": clean_markdown(fm.get("updated") or fm.get("created")) or "未标注",
                    "source_path": str(path.relative_to(root.parent)),
                    "body_html": md_to_safe_html(body),
                    "status": clean_markdown(fm.get("status")) or "已收录",
                    "type": clean_markdown(fm.get("type")) or "方法论",
                    "created": clean_markdown(fm.get("created")),
                    "path": str(path.relative_to(root.parent)),
                }
            )
    counts = Counter(item["category"] for item in items)
    return {
        "items": items,
        "summary": {
            "total": len(items),
            "creative_count": counts.get("创作方法论", 0),
            "business_count": counts.get("运营·商业", 0),
            "money_count": counts.get("赚钱方法", 0),
            "low_follower_hit_count": counts.get("低粉爆款", 0),
            "category_counts": dict(counts),
        },
    }


def parse_published(root: Path, warnings: list[str]) -> dict[str, Any]:
    items: list[dict[str, Any]] = []
    if not root.exists():
        warnings.append(f"missing directory: {root}")
    else:
        for path in sorted(root.rglob("*.md")):
            fm, body = parse_front_matter(read_text(path, warnings))
            views = parse_number(
                fm.get("播放")
                or fm.get("播放量")
                or fm.get("views")
                or fm.get("plays")
                or fm.get("浏览量")
            )
            likes = parse_number(fm.get("点赞") or fm.get("likes"))
            comments = parse_number(fm.get("评论") or fm.get("comments"))
            shares = parse_number(fm.get("转发") or fm.get("shares"))
            completion_rate = parse_number(fm.get("完播率") or fm.get("completion_rate"))
            drop_rate = parse_number(fm.get("跳出率") or fm.get("drop_rate"))
            avg_watch_seconds = parse_number(fm.get("平均观看秒数") or fm.get("avg_watch_seconds"))
            like_rate = (likes / views * 100.0) if likes is not None and views else None
            publish_date = clean_markdown(
                fm.get("发布日期")
                or fm.get("publish_date")
                or fm.get("published_at")
                or fm.get("published")
                or fm.get("date")
            )
            content_type = normalize_type(
                fm.get("内容类型") or fm.get("选题类型") or fm.get("type") or fm.get("category")
            )
            platform = clean_markdown(fm.get("平台") or fm.get("platform") or path.parent.name)
            items.append(
                {
                    "title": first_heading(body, path.stem),
                    "platform": platform,
                    "type": content_type,
                    "publish_date": publish_date,
                    "published_at": publish_date,
                    "views": int(views) if views is not None else None,
                    "likes": int(likes) if likes is not None else None,
                    "comments": int(comments) if comments is not None else None,
                    "shares": int(shares) if shares is not None else None,
                    "completion_rate": round(completion_rate, 2) if completion_rate is not None else None,
                    "drop_rate": round(drop_rate, 2) if drop_rate is not None else None,
                    "avg_watch_seconds": round(avg_watch_seconds, 2) if avg_watch_seconds is not None else None,
                    "like_rate": round(like_rate, 2) if like_rate is not None else None,
                    "predicted_tier": clean_markdown(fm.get("predicted_tier") or fm.get("预测档位")),
                    "actual_tier": clean_markdown(fm.get("actual_tier") or fm.get("实际档位")),
                    "path": str(path.relative_to(root.parent)),
                }
            )

    type_values: defaultdict[str, list[int]] = defaultdict(list)
    type_completion: defaultdict[str, list[float]] = defaultdict(list)
    type_drop: defaultdict[str, list[float]] = defaultdict(list)
    type_likes: defaultdict[str, int] = defaultdict(int)
    type_views_for_rate: defaultdict[str, int] = defaultdict(int)
    weekly_values: defaultdict[str, defaultdict[str, list[int]]] = defaultdict(lambda: defaultdict(list))
    for item in items:
        views_value = item.get("views")
        if views_value:
            type_values[item["type"]].append(views_value)
            week = week_label(item.get("publish_date", ""))
            weekly_values[item["type"]][week].append(views_value)
            type_views_for_rate[item["type"]] += views_value
        if item.get("likes") is not None:
            type_likes[item["type"]] += item["likes"]
        if item.get("completion_rate") is not None:
            type_completion[item["type"]].append(item["completion_rate"])
        if item.get("drop_rate") is not None:
            type_drop[item["type"]].append(item["drop_rate"])

    medians = {content_type: median(values) for content_type, values in type_values.items() if values}
    leading_type = max(medians.items(), key=lambda pair: pair[1])[0] if medians else None
    weekly_series = []
    all_weeks = sorted({week for by_week in weekly_values.values() for week in by_week})
    for content_type, by_week in weekly_values.items():
        weekly_series.append(
            {
                "name": content_type,
                "points": [
                    {"label": week, "value": median(by_week.get(week, [])) or 0} for week in all_weeks
                ],
            }
        )

    total_views = sum(item.get("views") or 0 for item in items)
    total_likes = sum(item.get("likes") or 0 for item in items)
    completion_values = [item["completion_rate"] for item in items if item.get("completion_rate") is not None]
    drop_values = [item["drop_rate"] for item in items if item.get("drop_rate") is not None]
    type_medians = []
    for key, value in sorted(medians.items(), key=lambda pair: pair[1], reverse=True):
        views_for_rate = type_views_for_rate.get(key, 0)
        type_medians.append(
            {
                "type": key,
                "name": key,
                "median_views": value,
                "value": value,
                "median_completion": median(type_completion.get(key, [])),
                "median_drop": median(type_drop.get(key, [])),
                "like_rate": round(type_likes[key] / views_for_rate * 100.0, 2) if views_for_rate else None,
                "count": len([item for item in items if item.get("type") == key]),
            }
        )
    avg_like_rate = round(total_likes / total_views * 100.0, 2) if total_views else None
    return {
        "items": sorted(items, key=lambda item: item.get("published_at", "") or item.get("title", "")),
        "summary": {
            "published_count": len(items),
            "total_views": total_views,
            "avg_completion_rate": round(sum(completion_values) / len(completion_values), 2) if completion_values else None,
            "avg_drop_rate": round(sum(drop_values) / len(drop_values), 2) if drop_values else None,
            "average_like_rate": avg_like_rate,
            "avg_like_rate": avg_like_rate,
            "leading_type": leading_type,
            "prediction_accuracy": None,
        },
        "type_medians": type_medians,
        "weekly_series": weekly_series,
    }


def week_label(date_text: str) -> str:
    match = re.search(r"(\d{4})-(\d{1,2})-(\d{1,2})", date_text or "")
    if not match:
        return "未标日期"
    try:
        date = datetime(int(match.group(1)), int(match.group(2)), int(match.group(3)))
    except ValueError:
        return "未标日期"
    year, week, _ = date.isocalendar()
    return f"{year}-W{week:02d}"


def median(values: list[int | float]) -> int | float | None:
    if not values:
        return None
    ordered = sorted(values)
    mid = len(ordered) // 2
    if len(ordered) % 2:
        return ordered[mid]
    value = (ordered[mid - 1] + ordered[mid]) / 2
    return round(value, 2) if isinstance(value, float) else int(value)


def load_state(path: Path, warnings: list[str]) -> dict[str, Any]:
    text = read_text(path, warnings)
    if not text:
        return {}
    try:
        value = json.loads(text)
        return value if isinstance(value, dict) else {}
    except json.JSONDecodeError as exc:
        warnings.append(f"bad json in {path}: {exc}")
        return {}


def compute_radar_freshness(root: Path, radar_data: dict[str, Any]) -> dict[str, Any]:
    """雷达数据新鲜度。

    只读 vault 内文件（trends-history/ 与雷达笔记 front matter），
    绝不触碰 vault 外的路径，保持整个 build 可移植。
    """
    unknown = {"radar_last_date": None, "radar_stale_days": None, "data_freshness": "unknown"}
    last_date = ""

    history_dir = root / "trends-history"
    if history_dir.is_dir():
        dates = sorted(
            path.stem
            for path in history_dir.glob("*.md")
            if re.fullmatch(r"\d{4}-\d{2}-\d{2}", path.stem)
        )
        if dates:
            last_date = dates[-1]

    if not last_date:
        match = re.search(r"(\d{4}-\d{2}-\d{2})", str(radar_data.get("updated") or ""))
        if match:
            last_date = match.group(1)

    if not last_date:
        return unknown

    try:
        parsed = datetime.strptime(last_date, "%Y-%m-%d").date()
    except ValueError:
        return unknown

    stale_days = (datetime.now().date() - parsed).days
    if stale_days <= 1:
        freshness = "fresh"
    elif stale_days <= 3:
        freshness = "stale"
    else:
        freshness = "critical"
    return {
        "radar_last_date": last_date,
        "radar_stale_days": stale_days,
        "data_freshness": freshness,
    }


def build_global(
    state: dict[str, Any],
    candidates: list[dict[str, Any]],
    schedule_data: dict[str, Any],
    radar_data: dict[str, Any],
    analytics_data: dict[str, Any],
    library_data: dict[str, Any],
    methodology_data: dict[str, Any],
    freshness: dict[str, Any] | None = None,
) -> dict[str, Any]:
    shoots = state.get("shoots") if isinstance(state.get("shoots"), list) else []
    buffer_count = len(shoots)
    target_cadence = state.get("target_publish_cadence_days")
    stage = "发布期" if state.get("last_published_at") else "囤货期"
    type_counts = Counter(candidate.get("type", "未分类") for candidate in candidates)
    alert_level = "critical" if buffer_count <= 0 else "ok"
    if stage == "囤货期":
        alert_text = "囤货期 buffer 为 0：先补拍摄库存，发布前不启动预测。"
    elif buffer_count <= 0:
        alert_text = "断更预警：buffer 为 0。"
    else:
        alert_text = "发布 buffer 正常。"
    return {
        "generated_at": datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds"),
        "today": datetime.now().strftime("%Y-%m-%d"),
        "stage": stage,
        "state": state,
        "buffer_count": buffer_count,
        "target_publish_cadence_days": target_cadence,
        "calibration_samples": state.get("calibration_samples", 0),
        "candidate_count": len(candidates),
        "scheduled_count": len(schedule_data.get("schedule", [])),
        "scheduled_filled_count": schedule_data.get("filled_count", 0),
        "radar_signal_count": radar_data.get("hit_count", 0),
        "published_count": analytics_data.get("summary", {}).get("published_count", 0),
        "library_count": library_data.get("summary", {}).get("total", 0),
        "methodology_count": methodology_data.get("summary", {}).get("total", 0),
        "signal_sources": state.get("enabled_trend_sources", []),
        "type_counts": dict(type_counts),
        "alert": {"level": alert_level, "text": alert_text},
        # 数据过期告警：雷达最后一次成功刷新日期 / 距今天数 / 新鲜度分档
        "radar_last_date": (freshness or {}).get("radar_last_date"),
        "radar_stale_days": (freshness or {}).get("radar_stale_days"),
        "data_freshness": (freshness or {}).get("data_freshness", "unknown"),
    }


def md_field(scope: str, name: str) -> str:
    """读 `- **Name**: value` 型 header 字段。

    BUG-1：大小写不敏感（文件里既有 `Published at` 也有 `Predicted At`），
    并容忍键名与冒号之间的括注（如 `- **BlindScore Disagreement**（全维度记录）:`）。
    """
    pattern = rf"(?m)^\s*[-*]?\s*\*\*{re.escape(name)}\*\*[^:：\n]*[:：]\s*(.*)$"
    match = re.search(pattern, scope, re.I)
    return clean_markdown(match.group(1)) if match else ""


def collect_meta_fields(header: str) -> dict[str, str]:
    """⑤ header 全字段：原样收集所有 `- **X**: Y`（含跨行续值）。"""
    meta: dict[str, str] = {}
    lines = header.replace("\r\n", "\n").splitlines()
    for index, line in enumerate(lines):
        match = re.match(r"^\s*[-*]\s*\*\*(?P<key>[^*]+?)\*\*(?P<paren>[^:：\n]*)[:：]\s*(?P<val>.*)$", line)
        if not match:
            continue
        key = clean_markdown(match.group("key"))
        value = match.group("val").strip()
        if not value:
            follow: list[str] = []
            for nxt in lines[index + 1 :]:
                if not nxt.strip() or re.match(r"^\s*[-*]\s*\*\*", nxt) or nxt.startswith("#"):
                    break
                follow.append(nxt.strip())
            value = " ".join(follow)
        note = clean_markdown(match.group("paren"))
        meta[key] = clean_markdown(value) or note
    return meta


def first_date(value: str) -> str:
    """从 `2026-07-08 抖音（链接 pending）` 这类串里取出日期/时间戳给履历站用。"""
    match = re.search(r"\d{4}-\d{2}-\d{2}(?:T[\d:+\-]+)?", value or "")
    return match.group(0) if match else clean_markdown(value)


def first_hash(value: str) -> str:
    match = re.search(r"\b[0-9a-f]{8,16}\b", value or "")
    return match.group(0) if match else clean_markdown(value)


def split_prediction_sections(text: str) -> list[tuple[str, str]]:
    """按 `## 预测` 切出各版本段（复盘段不算），返回 [(version, section_text)]。"""
    out: list[tuple[str, str]] = []
    heads = list(re.finditer(r"(?m)^##\s*预测(?P<tail>[^\n]*)$", text))
    for index, head in enumerate(heads):
        end = heads[index + 1].start() if index + 1 < len(heads) else len(text)
        body = text[head.end() : end]
        retro = re.search(r"(?m)^##\s*复盘", body)
        if retro:
            body = body[: retro.start()]
        version_match = re.search(r"v\s*(\d+)", head.group("tail"), re.I)
        version = f"v{version_match.group(1)}" if version_match else f"v{index + 1}"
        out.append((version, body))
    return out


def parse_dim_table(section: str, version: str) -> dict[str, dict[str, Any]]:
    """BUG-2：按表头判定分数列。

    v1 段表头 = `维度 | 分 | confidence | 理由`（4 列，分数在第 2 格）；
    v2 段表头 = `维度 | v1 | v2 | confidence | 理由`（5 列，分数在第 3 格）。
    旧实现固定取第 2 格，于是在 v2 段抓到的是 v1 列——SR/AB 两根柱子长期是错的。
    """
    dims: dict[str, dict[str, Any]] = {}
    score_idx = 1
    conf_idx: int | None = None
    reason_idx: int | None = None
    for line in section.splitlines():
        cells = split_table_row(line)
        if not cells or is_separator_row(cells):
            continue
        lowered = [cell.lower() for cell in cells]
        if "维度" in cells[0] or lowered[0] in {"dim", "dimension"}:
            has_v1 = any(cell == "v1" for cell in lowered)
            has_v2 = any(cell == "v2" for cell in lowered)
            score_idx = 2 if (has_v1 and has_v2 and len(cells) > 2) else 1
            conf_idx = next(
                (i for i, cell in enumerate(lowered) if "confidence" in cell or "置信" in cell),
                None,
            )
            reason_idx = next(
                (i for i, cell in enumerate(lowered) if "理由" in cell or "reason" in cell),
                None,
            )
            continue
        code = cells[0].strip().upper()
        if code not in RUBRIC_DIM_CODES or len(cells) <= score_idx:
            continue
        score_match = re.search(r"\d+", cells[score_idx])
        if not score_match:
            continue
        dims[code] = {
            "score": int(score_match.group(0)),
            "confidence": cells[conf_idx] if conf_idx is not None and len(cells) > conf_idx else "",
            "reason": cells[reason_idx] if reason_idx is not None and len(cells) > reason_idx else "",
            "source_version": version,
            "name_cn": RUBRIC_DIM_CN.get(code, ""),
            "name_en": RUBRIC_DIM_EN.get(code, ""),
        }
    return dims


def parse_inline_disagreement(scope: str) -> list[dict[str, Any]]:
    match = re.search(r"\[\{[^\n]*?\"dim\"[^\n]*?\}\]", scope)
    if not match:
        return []
    try:
        parsed = json.loads(match.group(0))
    except json.JSONDecodeError:
        return []
    return parsed if isinstance(parsed, list) else []


def parse_bucket_table(section: str) -> list[dict[str, Any]]:
    """BUG-4：定位 `### Bucket 押注` 子段后逐行解析表格。

    旧正则要求首列必须含 `×`，导致 v1 的绝对桶（底部/基础盘/命中/小爆/大爆）整表丢失。
    """
    start = re.search(r"(?m)^#{3,4}\s*.*Bucket\s*押注", section)
    scope = section[start.end() :] if start else section
    stop = re.search(r"(?m)^#{2,4}\s+(?!.*Bucket)", scope)
    if stop:
        scope = scope[: stop.start()]
    buckets: list[dict[str, Any]] = []
    for line in scope.splitlines():
        cells = split_table_row(line)
        if not cells or is_separator_row(cells) or len(cells) < 3:
            continue
        label = cells[0].strip()
        if not label or "Bucket" in label or "范围" in label:
            continue
        prob_match = re.search(r"(\d+(?:\.\d+)?)\s*%", cells[2])
        if not prob_match:
            continue
        buckets.append(
            {
                "label": label,
                "ratio": label,
                "plays": cells[1].strip(),
                "range": cells[1].strip(),
                "prob": float(prob_match.group(1)),
                "hit": False,
            }
        )
    return buckets


def bucket_range_bounds(text: str) -> tuple[float | None, float | None]:
    """把 `< 17,000` / `17,000 - 56,400` / `> 564,000` 解析成 (low, high)。"""
    cleaned = text.replace(",", "").replace("，", "")
    numbers = [float(n) for n in re.findall(r"\d+(?:\.\d+)?", cleaned)]
    if not numbers:
        return None, None
    if re.search(r"[<＜]", cleaned) and len(numbers) == 1:
        return None, numbers[0]
    if re.search(r"[>＞]", cleaned) and len(numbers) == 1:
        return numbers[0], None
    if len(numbers) >= 2:
        return numbers[0], numbers[1]
    return numbers[0], numbers[0]


def mark_bucket_hits(buckets: list[dict[str, Any]], views: int | None) -> None:
    if views is None:
        return
    for bucket in buckets:
        low, high = bucket_range_bounds(bucket.get("plays", ""))
        if low is None and high is None:
            continue
        if (low is None or views >= low) and (high is None or views < high):
            bucket["hit"] = True


def parse_diff_rows(section: str) -> list[dict[str, str]]:
    """v2 段的 changelog diff 表：稿内版本 / 日期 / 改动 / 影响维度。"""
    rows: list[dict[str, str]] = []
    for line in section.splitlines():
        cells = split_table_row(line)
        if not cells or is_separator_row(cells) or len(cells) < 4:
            continue
        if "稿内版本" in cells[0] or "版本" == cells[0]:
            continue
        if not re.match(r"^v?\d+(?:\.\d+)?$", cells[0].strip()):
            continue
        rows.append(
            {"ver": cells[0].strip(), "date": cells[1].strip(), "change": cells[2].strip(), "dims": cells[3].strip()}
        )
    return rows


def section_slice(text: str, pattern: str, level: int = 3) -> str:
    """取 `### <pattern>` 到下一个同级或更高级标题之间的正文。"""
    start = re.search(rf"(?m)^#{{{level}}}\s*.*{pattern}.*$", text)
    if not start:
        return ""
    rest = text[start.end() :]
    stop = re.search(rf"(?m)^#{{1,{level}}}\s+", rest)
    return rest[: stop.start()] if stop else rest


def bullet_items(scope: str) -> list[str]:
    """无序 `- ` 与有序 `1. ` 列表项都收（复盘段两种写法都存在）。"""
    items: list[str] = []
    for line in scope.splitlines():
        match = re.match(r"^\s*(?:[-*]|\d+[.、])\s+(.+)$", line)
        if match:
            items.append(clean_markdown(match.group(1)))
    return items


def parse_counterfactuals(section: str) -> list[dict[str, str]]:
    """⑦ 反事实场景：每条 `- **落 X** → Y`。"""
    scope = section_slice(section, "反事实场景")
    out: list[dict[str, str]] = []
    for raw in bullet_items(scope):
        parts = re.split(r"\s*(?:→|->)\s*", raw, maxsplit=1)
        if len(parts) == 2:
            out.append({"bucket": parts[0].strip(), "implication": parts[1].strip()})
        elif raw:
            out.append({"bucket": "", "implication": raw})
    return out


def parse_assumptions(section: str) -> list[dict[str, Any]]:
    """⑦ 关键校准假设：编号 / 断言 / 阈值 / 对照样本 / 防污染条款。"""
    scope = section_slice(section, "关键校准假设")
    if not scope:
        return []
    marks = list(re.finditer(r"(?m)^\s*(?:\*\*)?(\d+)[.、]?\s*(?:【[^】]*】)?", scope))
    marks = [m for m in marks if m.group(1)]
    out: list[dict[str, Any]] = []
    for index, mark in enumerate(marks):
        end = marks[index + 1].start() if index + 1 < len(marks) else len(scope)
        block = scope[mark.start() : end]
        if not block.strip():
            continue
        first = next((line.strip() for line in block.splitlines() if line.strip()), "")
        claim = clean_markdown(re.sub(r"^\s*\*{0,2}\d+[.、]?\s*", "", first))
        anchor_match = re.search(r"对照\s*[=＝:：]\s*([^\n。]+)", block)
        anti = " ".join(
            clean_markdown(line.lstrip("> ").strip())
            for line in block.splitlines()
            if line.lstrip().startswith(">")
        ).strip()
        out.append(
            {
                "n": int(mark.group(1)),
                "claim": claim,
                "threshold": "；".join(re.findall(r"[><≥≤]\s*[\d.]+\s*%?s?", block)),
                "anchor": clean_markdown(anchor_match.group(1)) if anchor_match else "",
                "anti_contamination": anti,
                "verdict": "",
            }
        )
    return out


RETRO_METRIC_PATTERNS = {
    "views": r"播放[：:]\s*\*{0,2}([\d,]+)",
    "likes": r"点赞[：:]\s*\*{0,2}([\d,]+)",
    "favs": r"收藏[：:]\s*\*{0,2}([\d,]+)",
    "comments": r"评论[：:]\s*\*{0,2}([\d,]+)",
    "shares": r"(?:分享|转发)[：:]\s*\*{0,2}([\d,]+)",
    "danmu": r"弹幕[：:]\s*\*{0,2}([\d,]+)",
}


def parse_retro_metrics(scope: str) -> dict[str, float | None]:
    metrics: dict[str, float | None] = {}
    for key, pattern in RETRO_METRIC_PATTERNS.items():
        match = re.search(pattern, scope)
        metrics[key] = float(match.group(1).replace(",", "")) if match else None
    duration = re.search(r"成片时长[：:]\s*[^（(\n]*[（(]\s*(\d+)\s*s", scope)
    if not duration:
        duration = re.search(
            r"(?:平均播放时长|均播时长|均播)[：:]\s*[\d.]+\s*s\s*/\s*[≈约]?\s*(\d+)\s*s", scope
        )
    metrics["duration_s"] = float(duration.group(1)) if duration else None
    avg = re.search(r"(?:平均播放时长|均播时长|均播)[：:]\s*\*{0,2}([\d.]+)\s*s", scope)
    metrics["avg_play_s"] = float(avg.group(1)) if avg else None
    depth = re.search(r"(?:播放深度|平均播放占比)\s*\*{0,2}([\d.]+)\s*%", scope)
    metrics["depth_pct"] = float(depth.group(1)) if depth else None
    completion = re.search(r"(?m)^\s*[-*]?\s*完播率[：:]\s*\*{0,2}([\d.]+)\s*%", scope)
    metrics["completion_pct"] = float(completion.group(1)) if completion else None
    drop2s = re.search(r"2s\s*跳出率[：:]?\s*\*{0,2}([\d.]+)\s*%", scope)
    metrics["drop2s_pct"] = float(drop2s.group(1)) if drop2s else None
    pass5s = re.search(r"5s\s*完播率[：:]?\s*\*{0,2}([\d.]+)\s*%", scope)
    metrics["pass5s_pct"] = float(pass5s.group(1)) if pass5s else None
    ctr = re.search(r"封面点击率[：:]\s*\*{0,2}([\d.]+)\s*%", scope)
    metrics["ctr_pct"] = float(ctr.group(1)) if ctr else None
    return metrics


def parse_retro_ratios(scope: str) -> dict[str, float | None]:
    ratios: dict[str, float | None] = {}
    for key, label in (("like", "赞播比"), ("fav", "藏播比"), ("comment", "评播比"), ("share", "分播比")):
        match = re.search(rf"{label}\s*\*{{0,2}}([\d.]+)\s*%", scope)
        ratios[key] = float(match.group(1)) if match else None
    return ratios


def parse_retro_funnel(retro_text: str) -> list[dict[str, Any]]:
    """BUG-3：留存漏斗优先从复盘段自算（数据统计表只作 fallback）。"""
    if not retro_text:
        return []
    metrics = parse_retro_metrics(retro_text)
    drop2s = metrics.get("drop2s_pct")
    pass5s = metrics.get("pass5s_pct")
    depth = metrics.get("depth_pct")
    avg = metrics.get("avg_play_s")
    completion = metrics.get("completion_pct")
    if drop2s is None and pass5s is None and depth is None:
        return []
    return [
        {"label": "进入", "pct": 100.0},
        {"label": "过2s", "pct": round(100.0 - drop2s, 2) if drop2s is not None else None},
        {"label": "过5s", "pct": pass5s},
        {"label": "均播", "pct": depth, "note": f"{avg:g}s" if avg is not None else ""},
        {"label": "完播", "pct": completion},
    ]


def parse_retro_block(text: str) -> dict[str, Any]:
    """⑥ 复盘结构化。"""
    split = re.split(r"(?m)^##\s*复盘\s*$", text, maxsplit=1)
    if len(split) < 2:
        return {}
    scope = split[1]
    facts = section_slice(scope, "实绩数据") or scope
    verify = section_slice(scope, "哪些预测被验证")
    verified: list[str] = []
    refuted: list[str] = []
    if verify:
        parts = re.split(r"\*\*被推翻[^*]*\*\*", verify, maxsplit=1)
        verified = bullet_items(re.sub(r"\*\*被验证[^*]*\*\*", "", parts[0]))
        refuted = bullet_items(parts[1]) if len(parts) > 1 else []
    observations = bullet_items(section_slice(scope, "新观察"))
    if not observations:
        obs_scope = section_slice(scope, "新观察")
        observations = [
            clean_markdown(m.group(1))
            for m in re.finditer(r"(?m)^\*\*(\d+\.\s*[^*]+)\*\*", obs_scope)
        ]
    top_comments = clean_markdown(section_slice(scope, "Top 评论关键词"))
    return {
        "collected_at": md_field(scope, "抓取时间") or md_field(scope, "复盘时间"),
        "retro_at": md_field(scope, "复盘时间"),
        "source": md_field(scope, "数据来源"),
        "comments_status": md_field(scope, "评论状态"),
        "metrics": parse_retro_metrics(facts),
        "ratios": parse_retro_ratios(scope),
        "confounds": bullet_items(section_slice(scope, "干扰")),
        "credibility": bullet_items(section_slice(scope, "数据可信度")),
        "verified": verified,
        "refuted": refuted,
        "observations": observations,
        "rubric_actions": bullet_items(section_slice(scope, "Rubric")),
        "top_comments": top_comments,
    }


def parse_predictions_detail(root: Path, warnings: list[str]) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    if not root.exists():
        return items
    for path in sorted(root.glob("*.md"), reverse=True):
        text = read_text(path, warnings)
        if not text:
            continue
        title = re.sub(
            r"^(?:预测|Reconstructed Retrospective)[:：]\s*", "", first_heading(text, path.stem)
        )
        retro_only = bool(
            re.search(r"(?m)^(?:#|>).*Reconstructed [Rr]etrospective", text[:600])
        )
        header_stop = re.search(r"(?m)^##\s+", text)
        header = text[: header_stop.start()] if header_stop else text
        meta = collect_meta_fields(header)

        def field(name: str) -> str:
            return md_field(text, name)

        sections = split_prediction_sections(text)
        versions_detail: list[dict[str, Any]] = []
        for index, (version, section) in enumerate(sections):
            dims_detail = parse_dim_table(section, version)
            composite_match = None
            for match in re.finditer(r"×\s*2\.0\s*=\s*(\d+(?:\.\d+)?)", section):
                composite_match = match.group(1)
            buckets = parse_bucket_table(section)
            headline = ""
            headline_match = re.search(r"(?m)^\**\s*Headline[：:]\s*(.+)$", section)
            if headline_match:
                headline = clean_markdown(headline_match.group(1))
            baseline_match = re.search(r"baseline\s*[=＝]\s*([\d,]+)", section)
            # 中枢先从 Headline 行取（作废理由的引用块里也有一个「中枢 ~400」，不能抢先）
            midpoint_match = re.search(r"中枢\s*[~≈]?\s*([\d,]+)", headline) or re.search(
                r"中枢\s*[~≈]?\s*([\d,]+)", section
            )
            void_reason = ""
            void_match = re.search(r"(?m)^>\s*\*\*v1 bucket 作废原因[^*]*\*\*[：:]\s*(.+)$", section)
            if void_match:
                void_reason = clean_markdown(void_match.group(1))
            versions_detail.append(
                {
                    "v": version,
                    "predicted_at": md_field(section, "Predicted At") or (meta.get("Predicted At", "") if index == 0 else ""),
                    "script_hash": first_hash(
                        md_field(section, "Script Hash (v2)")
                        or (meta.get("Script Hash", "") if index == 0 else "")
                    ),
                    "basis": md_field(section, "Prediction Basis") or (meta.get("Prediction Basis", "") if index == 0 else ""),
                    "trigger": md_field(section, "重判触发"),
                    "scored_by": md_field(section, "Scored By") or (meta.get("Scored By", "") if index == 0 else ""),
                    "blind_scored_by": md_field(section, "BlindScored By") or (meta.get("BlindScored By", "") if index == 0 else ""),
                    "blind_status": md_field(section, "Blind Status") or (meta.get("Blind Status", "") if index == 0 else ""),
                    "confidence": md_field(section, "Confidence") or (meta.get("Confidence", "") if index == 0 else ""),
                    "calibration_samples": md_field(section, "Calibration Samples") or (meta.get("Calibration Samples", "") if index == 0 else ""),
                    "user_override": md_field(section, "User Override") or (meta.get("User Override", "") if index == 0 else ""),
                    "contamination_notice": md_field(section, "⚠️ 主 Claude 通道污染声明"),
                    "shoot_notice": md_field(section, "拍摄变量声明"),
                    "diff_rows": parse_diff_rows(section),
                    "diff_note": md_field(section, "Diff vs v1"),
                    "composite": composite_match,
                    # 代入式直接当徽章渲染，不自己重算（规格 §3.2 ③）
                    "composite_expr": next(
                        (
                            line.strip()
                            for line in section.splitlines()
                            if re.search(r"/\s*7\s*×\s*2\.0", line)
                        ),
                        "",
                    ),
                    "dims_detail": dims_detail,
                    "dims": {code: value["score"] for code, value in dims_detail.items()},
                    "disagreement": parse_inline_disagreement(section)
                    or (parse_inline_disagreement(header) if index == 0 else []),
                    "buckets": buckets,
                    "headline": headline,
                    "baseline": int(baseline_match.group(1).replace(",", "")) if baseline_match else None,
                    "midpoint": int(midpoint_match.group(1).replace(",", "")) if midpoint_match else None,
                    "frame": "ratio" if any("×" in b["label"] for b in buckets) else "absolute",
                    "v1_void_reason": void_reason,
                    "counterfactuals": parse_counterfactuals(section),
                    "assumptions": parse_assumptions(section),
                }
            )

        latest = versions_detail[-1] if versions_detail else {}
        dims_detail = latest.get("dims_detail", {})
        dims = {code: value["score"] for code, value in dims_detail.items()}
        composite = latest.get("composite")
        if composite is None:
            for match in re.finditer(r"×\s*2\.0\s*=\s*(\d+(?:\.\d+)?)", text):
                composite = match.group(1)

        bet = ""
        headline_bets = re.findall(
            r"Headline[:：][^\n]*?(\d[\d,]*\s*[–—~-]\s*\d[\d,]*)\s*播放", text
        )
        band_bets = re.findall(
            r"押[^\n]*?(\d[\d.,]*\s*[kw万]\s*[–—~-]\s*\d[\d.,]*\s*[kw万]?)", text
        )
        if headline_bets:
            bet = re.sub(r"\s+", "", headline_bets[-1]) + " 播放"
        elif band_bets:
            bet = re.sub(r"[\s*]+", "", band_bets[-1])

        version_count = len(sections)
        retro_pending = bool(re.search(r"##\s*复盘\s*\n+\s*[（(]\s*待填", text))
        retro = parse_retro_block(text) if not retro_pending else {}
        # BUG-1：`Published at` 是小写 at；旧代码只找 `Published At`，
        # 于是 workbench_stage 永远停在 predicted，场景分析法被错标成「已盲测」。
        published_at = field("Published at") or field("发布时间") or field("发布")
        platform = field("Platform") or field("平台")
        url = field("URL")
        video_folder = field("Video Folder")
        aweme_id = field("Aweme ID")
        ad_hoc_raw = field("Ad Hoc Publish")
        ad_hoc = ad_hoc_raw.lower().startswith("true")
        platform_id = field("Platform ID") or field("Published URL") or aweme_id
        if platform_id.lower() in {"pending", "—", "-"}:
            platform_id = ""

        views = None
        retro_views = (retro.get("metrics") or {}).get("views")
        if retro_views is not None:
            views = int(retro_views)
        else:
            views_match = re.search(r"-\s*播放[:：]\s*([\d,]+)", text)
            views = int(views_match.group(1).replace(",", "")) if views_match else None

        buckets_v1 = versions_detail[0]["buckets"] if versions_detail else []
        buckets_v2 = versions_detail[-1]["buckets"] if len(versions_detail) > 1 else []
        for group in (buckets_v1, buckets_v2):
            mark_bucket_hits(group, views)
        latest_buckets = buckets_v2 or buckets_v1

        assumptions = latest.get("assumptions", [])
        verdict_text = " ".join((retro.get("verified") or []) + (retro.get("refuted") or []))
        for assumption in assumptions:
            token = f"假设 {assumption['n']}"
            if token in " ".join(retro.get("verified") or []):
                assumption["verdict"] = "verified"
            elif token in " ".join(retro.get("refuted") or []):
                assumption["verdict"] = "refuted"
            elif token in verdict_text:
                assumption["verdict"] = "mixed"

        items.append(
            {
                "file": path.name,
                "path": f"predictions/{path.name}",
                "title": title,
                "article_id": meta.get("Article ID", ""),
                "script_path": meta.get("Script Path", ""),
                "predicted_at": field("Predicted At"),
                "rubric_version": field("Rubric Version"),
                "confidence": field("Confidence"),
                "basis": field("Prediction Basis"),
                "content_form": field("Content Form") or field("内容类型"),
                "composite": composite,
                "bet": bet,
                "versions": version_count,
                "retro_only": retro_only,
                "views": views,
                "dims": dims,
                "dims_detail": dims_detail,
                "disagreement": latest.get("disagreement") or parse_inline_disagreement(text),
                "buckets": latest_buckets,
                "bet_detail": {
                    "headline": latest.get("headline", ""),
                    "midpoint": latest.get("midpoint"),
                    "baseline": latest.get("baseline"),
                    "frame": latest.get("frame", "absolute"),
                    "buckets_v1": buckets_v1,
                    "buckets_v2": buckets_v2,
                    "v1_void_reason": latest.get("v1_void_reason", ""),
                },
                "meta": meta,
                "versions_detail": versions_detail,
                "assumptions": assumptions,
                "counterfactuals": latest.get("counterfactuals", []),
                "retro": retro,
                "funnel": parse_retro_funnel(text.split("## 复盘", 1)[1] if "## 复盘" in text else ""),
                "body_html": md_to_safe_html(text),
                "published": bool(published_at or platform_id),
                "published_at": published_at,
                "platform": platform,
                "url": url,
                "video_folder": video_folder,
                "aweme_id": aweme_id,
                "ad_hoc_publish": ad_hoc,
                "retro_pending": retro_pending,
                "retro_done": ("## 复盘" in text) and not retro_pending,
            }
        )
    return items


def parse_retention_funnels(root: Path, warnings: list[str]) -> dict[str, list[dict[str, Any]]]:
    """从数据统计表提取每条视频的留存漏斗五点（进入/过2s/过5s/均播/完播）。"""
    text = read_text(root / "04-数据统计" / "数据统计表.md", warnings)
    funnels: dict[str, list[dict[str, Any]]] = {}
    if not text:
        return funnels
    sections = re.split(r"(?m)^###\s+", text)
    for section in sections[1:]:
        title_match = re.match(r"\[\[(?:[^\]|]+\|)?([^\]|]+)\]\]", section)
        if not title_match:
            continue
        title_key = re.sub(r"[\s？?！!，,。.]", "", title_match.group(1)).lower()
        past_2s = re.search(r"([\d.]+)%\s*撑过\s*2s", section)
        past_5s = re.search(r"5s\s*完播率\s*\|\s*([\d.]+)%", section)
        depth = re.search(r"(?:平均播放占比|播放深度)\s*[|≈]?\s*([\d.]+)%", section)
        finish = re.search(r"\|\s*完播率\s*\|\s*([\d.]+)%", section)
        if not (past_2s and past_5s and finish):
            continue
        funnels[title_key] = [
            {"label": "进入", "pct": 100.0},
            {"label": "过2s", "pct": float(past_2s.group(1))},
            {"label": "过5s", "pct": float(past_5s.group(1))},
            {"label": "均播", "pct": float(depth.group(1)) if depth else None},
            {"label": "完播", "pct": float(finish.group(1))},
        ]
    return funnels


def parse_scripts_index(
    root: Path,
    warnings: list[str],
    reviews: list[dict[str, Any]],
    predictions: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """scripts/ 顶层稿件清单，按文件名里的 article id 关联诊断与预测。"""
    scripts_dir = root / "scripts"
    items: list[dict[str, Any]] = []
    if not scripts_dir.exists():
        return items
    for path in sorted(scripts_dir.glob("*.md"), reverse=True):
        name_match = re.match(r"(\d{4}-\d{2}-\d{2})_([0-9a-f]{6,16})_", path.name)
        date = name_match.group(1) if name_match else ""
        article_id = name_match.group(2) if name_match else ""
        text = read_text(path, warnings)
        front_matter, body = parse_front_matter(text)
        title = first_heading(body, path.stem)
        transcript = section_slice(body, "逐字稿", level=2)
        word_count = len(re.sub(r"\s", "", re.sub(r"[#>*`|\-]", "", transcript)))
        section_count = len(re.findall(r"(?m)^###\s+", transcript))
        changelog: list[dict[str, str]] = []
        for line in body.splitlines():
            if not line.lstrip().startswith(">"):
                continue
            entry = re.match(
                r"^>\s*\**\s*(v\d+(?:\.\d+)?)\s*[（(]\s*(\d{4}-\d{2}-\d{2})?([^）)]*)[）)]\s*\**\s*[：:]\s*(.+)$",
                line.strip(),
            )
            if entry:
                changelog.append(
                    {
                        "version": entry.group(1),
                        "date": entry.group(2) or "",
                        "label": clean_markdown(entry.group(3)),
                        "change": clean_markdown(entry.group(4)),
                    }
                )
        matched_reviews = [r for r in reviews if article_id and article_id in r["file"]]
        prediction = next(
            (p for p in predictions if article_id and article_id in p["file"]), None
        )
        blind_score = None
        if prediction and prediction.get("composite"):
            try:
                blind_score = float(prediction["composite"])
            except ValueError:
                pass
        self_score = next((r["score"] for r in matched_reviews if r.get("score")), None)
        issue_total = sum(r.get("issue_total") or 0 for r in matched_reviews)
        issue_open = sum(r.get("issue_open") or 0 for r in matched_reviews)
        fm_keys = (
            "tags", "type", "status", "platform", "平台", "内容类型", "内容类型轮播", "轮播类型",
            "时长", "content_form", "stage", "source", "review", "选题卡", "created",
            "published_at", "published_platform", "published_url", "retro_mode", "数据录入",
        )
        front = {}
        for key in fm_keys:
            if key not in front_matter:
                continue
            value = front_matter[key]
            front[key] = (
                [clean_markdown(v) for v in value] if isinstance(value, list) else clean_markdown(value)
            )
        items.append(
            {
                "file": path.name,
                "path": f"scripts/{path.name}",
                "title": title,
                "date": date,
                "article_id": article_id,
                "self_score": self_score,
                "blind_score": blind_score,
                "issue_open": issue_open if matched_reviews else None,
                "issue_total": issue_total if matched_reviews else None,
                "published": bool(prediction and prediction.get("published")),
                "retro_only": bool(prediction and prediction.get("retro_only")),
                "front_matter": front,
                "changelog": changelog,
                "word_count": word_count,
                "section_count": section_count,
            }
        )
    return items


def parse_memo_observations(root: Path, warnings: list[str]) -> list[dict[str, Any]]:
    """⑭ rubric-memo.md「观察记录」区 —— 每条取全 6 组件。

    旧实现只截第一个粗体 highlight（76 字），丢掉了预测 / 实绩 / 评论 / 判断 /
    调整 / 详见 六块中的五块。
    """
    text = read_text(root / "rubric-memo.md", warnings)
    items: list[dict[str, Any]] = []
    if not text:
        return items
    section = text.split("## 观察记录", 1)
    if len(section) < 2:
        return items
    for match in re.finditer(
        r"(?m)^###\s*(\d{4}-\d{2}-\d{2})\s+(.+?)$([\s\S]*?)(?=^###\s|\Z)", section[1]
    ):
        date, heading, body = match.groups()
        heading = clean_markdown(heading)
        id_match = re.search(r"\(([0-9a-f]{6,16})\)", heading)
        article_id = id_match.group(1) if id_match else ""
        without_id = re.sub(r"\([0-9a-f]{6,16}\)\s*", "", heading)
        title_part, _, verdict = without_id.partition("—")
        highlights = [
            clean_markdown(h)
            for h in re.findall(r"\*\*(【[^*]+】|[^*]*?(?:pattern|短板|不能泛化|暂不 bump)[^*]*)\*\*", body)
        ]

        def component(label: str) -> str:
            found = re.search(rf"(?m)^\s*[-*]\s*{label}[：:]\s*(.*)$", body)
            return clean_markdown(found.group(1)) if found else ""

        judgments: list[str] = []
        judge_start = re.search(r"(?m)^\s*[-*]\s*判断[：:]\s*$", body)
        if judge_start:
            rest = body[judge_start.end() :]
            stop = re.search(r"(?m)^\s*[-*]\s+\S+[：:]", rest)
            judgments = [
                clean_markdown(m.group(1))
                for m in re.finditer(r"(?m)^\s+\d+\.\s+(.+)$", rest[: stop.start()] if stop else rest)
            ]

        cross_sample = ""
        if "跨样本 pattern 达到 3 条" in body:
            cross_sample = "跨样本 3/3"
        elif "跨样本 pattern 成立" in body:
            cross_sample = "跨样本 2/2"

        ref_match = re.search(r"(?m)^\s*[-*]\s*详见[：:]\s*\[?([^\]\n]+)\]?", body)
        items.append(
            {
                "date": date,
                "title": clean_markdown(title_part),
                "id": article_id,
                "verdict": clean_markdown(verdict),
                "predicted": component("预测"),
                "actual": component(r"实绩(?:[（(][^）)]*[）)])?"),
                "top_comments": component("Top 评论关键词"),
                "judgments": judgments,
                "rubric_action": component(r"Rubric\s*(?:/\s*Pattern\s*处理|调整)"),
                "credibility": component("数据可信度"),
                "process_gap": component("流程缺口"),
                "platform_note": component("平台环境假设"),
                "ref_file": clean_markdown(ref_match.group(1)) if ref_match else "",
                "cross_sample_tag": cross_sample,
                "highlight": highlights[0] if highlights else "",
            }
        )
    return list(reversed(items))


WORKBENCH_ACTIONS = {
    "draft": [
        ("诊断", "分析最新稿 scripts/{file}"),
        ("打分", "打分这篇 scripts/{file}"),
    ],
    "reviewed": [("盲测", "盲测 scripts/{file}")],
    "predicted": [("登记拍摄", "已拍 {title}")],
    "published": [("复盘", "复盘 scripts/{file}")],
    "retro_pending": [("复盘", "复盘 scripts/{file}")],
    "retro_done": [],
}


def workbench_stage(has_review: bool, prediction: dict[str, Any] | None) -> str:
    """状态机：draft → reviewed → predicted → published → retro_pending → retro_done，取最靠后成立的阶段。"""
    stage = "draft"
    if has_review:
        stage = "reviewed"
    if prediction:
        stage = "predicted"
        if prediction.get("published"):
            stage = "published"
            if prediction.get("retro_pending"):
                stage = "retro_pending"
            if prediction.get("retro_done"):
                stage = "retro_done"
    return stage


# 状态机 → 「当前站」。retro_done 时无 current 站，因此整份履历不挂任何指令按钮。
CURRENT_STAGE_FOR = {
    "draft": "review",
    "reviewed": "predict_v1",
    "predicted": "shoot",
    "published": "retro",
    "retro_pending": "retro",
    "retro_done": None,
}


def build_dossier(
    script: dict[str, Any],
    prediction: dict[str, Any] | None,
    review_list: list[dict[str, Any]],
    state: dict[str, Any] | None,
    root: Path | None = None,
) -> list[dict[str, Any]]:
    """⑰ 每稿 8 站履历。

    **指令按钮只挂在 status == "current" 的那一站**（§6.1 禁令 2：
    展示实绩的区块内不得出现打分 / 盲测按钮）。
    """
    prediction = prediction or {}
    state = state or {}
    front = script.get("front_matter") or {}
    retro_only = bool(prediction.get("retro_only"))
    versions = prediction.get("versions_detail") or []
    retro = prediction.get("retro") or {}
    has_review = bool(review_list)
    published = bool(prediction.get("published"))
    retro_done = bool(prediction.get("retro_done"))
    ad_hoc = bool(prediction.get("ad_hoc_publish"))
    stage = workbench_stage(has_review, prediction or None)
    current = CURRENT_STAGE_FOR.get(stage)
    file_name = script.get("file", "")
    title = script.get("title", "")
    article_id = script.get("article_id", "")

    def station(key: str, status: str, at: str = "", fields: dict[str, Any] | None = None, hint: str = "") -> dict[str, Any]:
        label = dict(DOSSIER_STAGES)[key]
        return {
            "stage": key,
            "status": status,
            "label": label,
            "at": at,
            "fields": fields or {},
            "empty_hint": hint,
            "actions": [],
        }

    stations: list[dict[str, Any]] = []

    # ① 草稿 —— 有稿件才有这一行，永远 done
    stations.append(
        station(
            "draft",
            "done",
            at=script.get("date", "") or str(front.get("created", "")),
            fields={
                "title": title,
                "file": file_name,
                "path": script.get("path", ""),
                "created": front.get("created", ""),
                "status": front.get("status", ""),
                "stage": front.get("stage", ""),
                "source": front.get("source", ""),
                "content_type": front.get("内容类型", ""),
                "duration": front.get("时长", ""),
                "content_form": front.get("content_form", ""),
                "platform": front.get("平台") or front.get("platform", ""),
                "topic_card": front.get("选题卡", ""),
                "changelog": script.get("changelog", []),
                "word_count": script.get("word_count"),
                "section_count": script.get("section_count"),
            },
        )
    )

    # ② 诊断
    if has_review:
        issues = [issue for review in review_list for issue in review.get("issues", [])]
        priorities = Counter(issue.get("priority", "") for issue in issues)
        pacing = next((r.get("pacing") for r in review_list if r.get("pacing")), [])
        stations.append(
            station(
                "review",
                "done",
                at=next((str(r.get("created", "")) for r in review_list if r.get("created")), ""),
                fields={
                    "files": [r.get("file", "") for r in review_list],
                    "count": len(review_list),
                    "baseline_score": next((r.get("score") for r in review_list if r.get("score")), None),
                    "baseline_source": "dbs 诊断",
                    "analysis_flow": next((r.get("flow", "") for r in review_list if r.get("flow")), ""),
                    "issues": issues,
                    "issue_total": len(issues),
                    "issue_open": sum(1 for issue in issues if "待" in issue.get("status", "")),
                    "issue_by_priority": dict(priorities),
                    "pacing": pacing,
                    "cold_zones": sum(1 for cell in pacing if cell.get("level") == "cold"),
                    "checklist_done": sum(r.get("checklist_done") or 0 for r in review_list),
                    "checklist_total": sum(r.get("checklist_total") or 0 for r in review_list),
                },
            )
        )
    else:
        stations.append(
            station(
                "review",
                "skipped" if published else ("current" if current == "review" else "pending"),
                fields={},
                hint=f"未做诊断 · [复制] 分析最新稿 scripts/{file_name}",
            )
        )

    def version_fields(entry: dict[str, Any]) -> dict[str, Any]:
        return {
            "predicted_at": entry.get("predicted_at", ""),
            "rubric_version": prediction.get("rubric_version", ""),
            "basis": entry.get("basis", ""),
            "calibration_samples": entry.get("calibration_samples", ""),
            "calibration_note": "写预测时",
            "confidence": entry.get("confidence", ""),
            "script_path": prediction.get("script_path", ""),
            "script_hash": entry.get("script_hash", ""),
            "scored_by": entry.get("scored_by", ""),
            "blind_scored_by": entry.get("blind_scored_by", ""),
            "blind_status": entry.get("blind_status", ""),
            "user_override": entry.get("user_override", ""),
            "dims_detail": entry.get("dims_detail", {}),
            "composite": entry.get("composite"),
            "composite_expr": entry.get("composite_expr", ""),
            "disagreement": entry.get("disagreement", []),
            "buckets": entry.get("buckets", []),
            "headline": entry.get("headline", ""),
            "midpoint": entry.get("midpoint"),
            "baseline": entry.get("baseline"),
            "frame": entry.get("frame", ""),
            "counterfactuals": entry.get("counterfactuals", []),
            "assumptions": entry.get("assumptions", []),
        }

    # ③ 盲评 v1 / ④ 重判 v2 —— retro_only 两篇一律 n/a（§3.3）
    if retro_only:
        stations.append(station("predict_v1", "na", hint=RETRO_ONLY_NA_HINT))
        stations.append(station("predict_v2", "na", hint=RETRO_ONLY_NA_HINT))
    else:
        if versions:
            entry = versions[0]
            stations.append(station("predict_v1", "done", at=entry.get("predicted_at", ""), fields=version_fields(entry)))
        else:
            stations.append(
                station(
                    "predict_v1",
                    "current" if current == "predict_v1" else "pending",
                    hint=f"未盲测 · [复制] 盲测 scripts/{file_name}",
                )
            )
        if len(versions) >= 2:
            entry = versions[1]
            fields = version_fields(entry)
            fields.update(
                {
                    "trigger": entry.get("trigger", ""),
                    "diff_note": entry.get("diff_note", ""),
                    "diff_rows": entry.get("diff_rows", []),
                    "v1_script_hash": versions[0].get("script_hash", ""),
                    "v1_composite": versions[0].get("composite"),
                    "v1_dims_detail": versions[0].get("dims_detail", {}),
                    "dim_deltas": [
                        {
                            "dim": code,
                            "v1": versions[0].get("dims", {}).get(code),
                            "v2": value.get("score"),
                            "delta": (value.get("score") or 0) - (versions[0].get("dims", {}).get(code) or 0),
                        }
                        for code, value in entry.get("dims_detail", {}).items()
                        if (value.get("score") or 0) != (versions[0].get("dims", {}).get(code) or 0)
                    ],
                    "composite_note": "composite 不变不代表判断不变——复盘应对维度而非总分",
                    "v1_void_reason": entry.get("v1_void_reason", ""),
                    "contamination_notice": entry.get("contamination_notice", ""),
                    "shoot_notice": entry.get("shoot_notice", ""),
                    "archive_gap": "v3.1 未存档，archive/ 只有 v1 原稿与 v2 方向校正版 → v1→v2 无法逐行 diff，仅依稿内 changelog",
                }
            )
            stations.append(station("predict_v2", "done", at=entry.get("predicted_at", ""), fields=fields))
        else:
            stations.append(
                station(
                    "predict_v2",
                    "skipped" if versions else "pending",
                    hint=f"未触发重判 · 稿子在 v1 后无 ≥{V2_TRIGGER_THRESHOLD} 改动",
                )
            )

    # ⑤ 拍摄
    video_folder = prediction.get("video_folder", "")
    shoots = state.get("shoots") if isinstance(state.get("shoots"), list) else []
    shoot = next(
        (s for s in shoots if video_folder and str(s.get("video_folder", "")).strip("/") == video_folder.strip("/")),
        None,
    )
    shoot_script_exists = False
    if root and video_folder:
        shoot_script_exists = (root / video_folder.strip("/") / "script.md").exists()
    shoot_fields = {
        "video_folder": video_folder,
        "shot_at": (shoot or {}).get("shot_at", ""),
        "script_consistency": (shoot or {}).get("script_consistency", ""),
        "script_diff_pct": (shoot or {}).get("script_diff_pct"),
        "v2_prediction_written": (shoot or {}).get("v2_prediction_written"),
        "shoot_script_exists": shoot_script_exists,
        "v2_trigger_threshold": V2_TRIGGER_THRESHOLD,
        "diff_metric": DIFF_METRIC,
    }
    if retro_only:
        stations.append(station("shoot", "na", hint=RETRO_ONLY_NA_HINT))
    elif ad_hoc:
        stations.append(
            station(
                "shoot",
                "skipped",
                fields=shoot_fields,
                hint="跳过拍摄登记（ad_hoc_publish）· 无实拍稿快照 · 写作 Pattern 无法 diff",
            )
        )
    elif shoot:
        stations.append(station("shoot", "done", at=shoot.get("shot_at", ""), fields=shoot_fields))
    else:
        stations.append(
            station(
                "shoot",
                "current" if current == "shoot" else "pending",
                fields=shoot_fields,
                hint=f"未登记拍摄 · [复制] 已拍 {title}",
            )
        )

    # ⑥ 发布
    published_at = prediction.get("published_at", "")
    url = prediction.get("url", "")
    aweme = prediction.get("aweme_id", "")
    pending_ids = {"pending", "—", "-", ""}
    stations.append(
        station(
            "publish",
            "done" if published else ("current" if current == "publish" else "pending"),
            at=first_date(published_at),
            fields={
                "published_at": published_at,
                "platform": prediction.get("platform", "") or front.get("published_platform", ""),
                "url": url,
                "aweme_id": aweme,
                "video_folder": video_folder,
                "ad_hoc_publish": ad_hoc,
                "id_pending": url.lower() in pending_ids or aweme.lower() in pending_ids,
                "id_pending_note": "平台 ID 未 resolve · 无法回抓与去重",
            },
            hint="" if published else "未发布",
        )
    )

    # ⑦ T+3 复盘
    if retro_done and retro:
        stations.append(
            station(
                "retro",
                "done",
                at=first_date(retro.get("retro_at", "")),
                fields={
                    "retro_at": retro.get("retro_at", ""),
                    "collected_at": retro.get("collected_at", ""),
                    "source": retro.get("source", ""),
                    "comments_status": retro.get("comments_status", ""),
                    "metrics": retro.get("metrics", {}),
                    "ratios": retro.get("ratios", {}),
                    "funnel": prediction.get("funnel", []),
                    "funnel_source": prediction.get("funnel_source", ""),
                    "buckets": (prediction.get("bet_detail") or {}).get("buckets_v2")
                    or (prediction.get("bet_detail") or {}).get("buckets_v1")
                    or [],
                    "bet_detail": prediction.get("bet_detail", {}),
                    "confounds": retro.get("confounds", []),
                    "state_confounds": state.get("last_sample_confounds", []),
                    "credibility": retro.get("credibility", []),
                    "verified": retro.get("verified", []),
                    "refuted": retro.get("refuted", []),
                    "observations": retro.get("observations", []),
                    "top_comments": retro.get("top_comments", ""),
                    "deviation": state.get("last_prediction_deviation", {}),
                },
            )
        )
    elif published:
        stations.append(
            station(
                "retro",
                "current" if current == "retro" else "pending",
                hint=f"待复盘 · [复制] 复盘 scripts/{file_name}",
                fields={"published_at": published_at},
            )
        )
    else:
        stations.append(station("retro", "pending", hint="未发布 · 复盘未到期"))

    # ⑧ rubric 去向
    deviation = state.get("last_prediction_deviation") or {}
    is_last_published = article_id and article_id in str(state.get("last_published_file", ""))
    bump_fields = {
        "rubric_actions": retro.get("rubric_actions", []),
        "eligible_for_directional_streak": deviation.get("eligible_for_directional_streak")
        if is_last_published
        else None,
        "deviation": deviation if is_last_published else {},
        "memo_ref": article_id,
        "last_bump_at": state.get("last_bump_at"),
        "retro_mode": (prediction.get("meta") or {}).get("retro_mode", "")
        or front.get("retro_mode", "")
        or ("learning-only" if retro_only else ""),
    }
    stations.append(
        station(
            "bump",
            "done" if (retro_done and retro.get("rubric_actions")) else ("pending" if not retro_done else "done"),
            at=first_date(retro.get("retro_at", "")),
            fields=bump_fields,
            hint="" if retro_done else "未产生 rubric 动作",
        )
    )

    # §6.1 禁令 2：指令按钮只挂在 current 站
    if current:
        actions = [
            {"label": label, "command": command.format(file=file_name, title=title)}
            for label, command in WORKBENCH_ACTIONS.get(stage, [])
        ]
        for item in stations:
            if item["stage"] == current:
                item["actions"] = actions
    return stations


def build_workbench(
    scripts: list[dict[str, Any]],
    predictions: list[dict[str, Any]],
    reviews: list[dict[str, Any]],
    state: dict[str, Any] | None = None,
    root: Path | None = None,
) -> list[dict[str, Any]]:
    """按稿件聚合的统一档案：scripts 为底，join 预测与诊断记录。"""
    items: list[dict[str, Any]] = []
    for script in scripts:
        article_id = script.get("article_id") or ""
        title_key = normalize_title_key(script.get("title"))
        matched_reviews = [r for r in reviews if article_id and article_id in r.get("file", "")]
        if not matched_reviews and title_key:
            matched_reviews = [
                r
                for r in reviews
                if normalize_title_key(r.get("topic"))
                and (
                    title_key in normalize_title_key(r.get("topic"))
                    or normalize_title_key(r.get("topic")) in title_key
                )
            ]
        prediction = next(
            (p for p in predictions if article_id and article_id in p.get("file", "")), None
        )
        if not prediction and title_key:
            prediction = next(
                (
                    p
                    for p in predictions
                    if normalize_title_key(p.get("title"))
                    and (
                        title_key in normalize_title_key(p.get("title"))
                        or normalize_title_key(p.get("title")) in title_key
                    )
                ),
                None,
            )
        stage = workbench_stage(bool(matched_reviews), prediction)
        latest_pacing = next((r.get("pacing") or [] for r in matched_reviews if r.get("pacing")), [])
        cold_zones = sum(1 for cell in latest_pacing if cell.get("level") == "cold")
        composite = None
        if prediction and prediction.get("composite"):
            composite = parse_number(prediction["composite"])
        actions = [
            {
                "label": label,
                "command": command.format(
                    file=script.get("file", ""), title=script.get("title", "")
                ),
            }
            for label, command in WORKBENCH_ACTIONS.get(stage, [])
        ]
        items.append(
            {
                "file": script.get("file", ""),
                "title": script.get("title", ""),
                "date": script.get("date", ""),
                "published": bool(script.get("published")),
                "retro_only": bool(script.get("retro_only")),
                "stage": stage,
                "scores": {
                    "self": script.get("self_score"),
                    "blind": script.get("blind_score"),
                    "composite": composite,
                    "bet": (prediction or {}).get("bet", ""),
                },
                "review": {
                    "issue_open": script.get("issue_open"),
                    "issue_total": script.get("issue_total"),
                    "cold_zones": cold_zones if matched_reviews else None,
                },
                "views": (prediction or {}).get("views"),
                "funnel": (prediction or {}).get("funnel") or [],
                "funnel_source": (prediction or {}).get("funnel_source", ""),
                "prediction_file": (prediction or {}).get("file", ""),
                "review_files": [r.get("file", "") for r in matched_reviews],
                "next_actions": actions,
                "article_id": article_id,
                "dims_detail": (prediction or {}).get("dims_detail") or {},
                "bet_detail": (prediction or {}).get("bet_detail") or {},
                "dossier": build_dossier(script, prediction, matched_reviews, state, root),
            }
        )
    return items


def parse_dbs_archives(
    warnings: list[str], sessions_dir: Path | None = None
) -> list[dict[str, Any]]:
    """~/.dbs/sessions/*/ 下的诊断存档（YAML frontmatter + 主诉/结论段）。"""
    root = sessions_dir if sessions_dir is not None else Path.home() / ".dbs" / "sessions"
    items: list[dict[str, Any]] = []
    if not root.exists():
        return items
    for path in sorted(root.rglob("*.md")):
        text = read_text(path, warnings)
        if not text:
            continue
        fm, body = parse_front_matter(text)
        sections: dict[str, list[str]] = {}
        current: str | None = None
        for line in body.replace("\r\n", "\n").splitlines():
            heading = re.match(r"^##\s+(.+?)\s*$", line)
            if heading:
                current = clean_markdown(heading.group(1))
                sections.setdefault(current, [])
                continue
            if current is not None:
                sections[current].append(line)

        def section_lines(name: str) -> list[str]:
            for key, lines in sections.items():
                if name in key:
                    return lines
            return []

        complaint = clean_markdown("\n".join(section_lines("用户主诉")))
        conclusions = [
            clean_markdown(match.group(1))
            for line in section_lines("已得出的结论")
            if (match := re.match(r"^\s*[-*]\s+(.+)$", line))
        ][:8]
        items.append(
            {
                "slug": clean_markdown(fm.get("slug")) or path.parent.name,
                "timestamp": clean_markdown(fm.get("timestamp")),
                "title": clean_markdown(fm.get("title")) or first_heading(body, path.stem),
                "source_skill": clean_markdown(fm.get("source_skill")),
                "status": clean_markdown(fm.get("status")),
                "next_skill": clean_markdown(fm.get("next_skill")),
                "complaint": complaint,
                "conclusions": conclusions,
            }
        )
    items.sort(key=lambda item: item.get("timestamp", ""), reverse=True)
    return items


def parse_rubric_definition(root: Path, warnings: list[str]) -> dict[str, Any]:
    """⑩ rubric_notes.md → 生效口径（唯一真源）。

    §6.4 污染自检同时跑：命中行**不进 dims/desc**，只把行号收进
    contamination_hits[] 由页面报警。**绝不修改文件。**
    """
    path = root / "rubric_notes.md"
    text = read_text(path, warnings)
    empty = {
        "version": "v0",
        "formula": RUBRIC_FORMULA,
        "scale": RUBRIC_SCALE,
        "dim_count": len(RUBRIC_DIMS),
        "dims": [],
        "buckets_absolute": [],
        "buckets_ratio": [],
        "candidate_dims": [dict(item) for item in RUBRIC_CANDIDATE_DIMS],
        "candidate_note": RUBRIC_CANDIDATE_NOTE,
        "coldstart_trust_table": [],
        "contamination_hits": [],
        "benchmark_signals_section_present": False,
        "source_path": "rubric_notes.md",
        "doc_conflicts": [],
    }
    if not text:
        return empty

    lines = text.replace("\r\n", "\n").splitlines()
    contamination_hits = [
        {"line": index + 1, "text": clean_markdown(line)[:120]}
        for index, line in enumerate(lines)
        if line.strip() and CONTAM.search(line)
    ]
    contaminated_lines = {hit["line"] for hit in contamination_hits}

    version = "v0"
    version_match = re.search(r"\bv(\d+(?:\.\d+)?)\b", text[:400])
    if version_match:
        version = f"v{version_match.group(1)}"

    formula = RUBRIC_FORMULA
    formula_match = re.search(r"composite\s*=\s*(.+)", text)
    if formula_match:
        formula = clean_markdown(formula_match.group(1))

    scale = RUBRIC_SCALE
    if re.search(r"每个维度\s*0-5", text) or re.search(r"每维\s*0-5", text):
        scale = "0-5"

    dims: list[dict[str, Any]] = []
    heading_re = re.compile(
        r"(?m)^###\s+(?P<code>[A-Z]{2,3})\s*[—\-–]\s*(?P<en>[^（(]+)[（(](?P<cn>[^）)]+)[）)]\s*$"
    )
    heads = list(heading_re.finditer(text))
    for index, head in enumerate(heads):
        end = heads[index + 1].start() if index + 1 < len(heads) else len(text)
        block = text[head.end() : end]
        stop = re.search(r"(?m)^#{1,3}\s+", block)
        if stop:
            block = block[: stop.start()]
        start_line = text[: head.end()].count("\n") + 1
        desc_parts: list[str] = []
        anchors: dict[str, str] = {}
        note_parts: list[str] = []
        for offset, line in enumerate(block.splitlines()):
            line_no = start_line + offset + 1
            if line_no in contaminated_lines:
                continue  # §6.4：命中行不渲染
            stripped = line.strip()
            if not stripped or re.fullmatch(r"-{3,}|\*{3,}", stripped):
                continue
            anchor = re.match(r"^[-*]\s*\*\*(\d)\*\*\s*[—\-–]\s*(.+)$", stripped)
            if anchor:
                anchors[anchor.group(1)] = clean_markdown(anchor.group(2))
                continue
            if stripped.startswith("*") and stripped.endswith("*"):
                desc_parts.append(clean_markdown(stripped.strip("*")))
                continue
            note_parts.append(clean_markdown(stripped))
        code = head.group("code")
        dims.append(
            {
                "code": code,
                "name_cn": clean_markdown(head.group("cn")) or RUBRIC_DIM_CN.get(code, ""),
                "name_en": clean_markdown(head.group("en")) or RUBRIC_DIM_EN.get(code, ""),
                "desc": " ".join(desc_parts),
                "anchors": anchors,
                "note": " ".join(note_parts),
            }
        )

    def table_rows(section_pattern: str) -> list[dict[str, str]]:
        start = re.search(rf"(?m)^#{{2,4}}\s*.*{section_pattern}.*$", text)
        if not start:
            return []
        rest = text[start.end() :]
        stop = re.search(r"(?m)^#{2,4}\s+", rest)
        scope = rest[: stop.start()] if stop else rest
        _, rows = parse_table_block([l for l in scope.splitlines() if l.strip().startswith("|")])
        return rows

    buckets_absolute = [
        {
            "label": row.get("Bucket", ""),
            "range": next((v for k, v in row.items() if "范围" in k), ""),
            "meaning": next((v for k, v in row.items() if "含义" in k), ""),
            "prior": next((v for k, v in row.items() if "概率" in k), ""),
        }
        for row in table_rows("第 1 篇")
    ]
    buckets_ratio = [
        {
            "label": row.get("Bucket", ""),
            "range": next((v for k, v in row.items() if "倍数" in k or "范围" in k), ""),
            "meaning": next((v for k, v in row.items() if "含义" in k), ""),
        }
        for row in table_rows("第 2 篇起")
    ]
    coldstart = [
        {
            "samples": next((v for k, v in row.items() if "校准样本" in k), ""),
            "trust": next((v for k, v in row.items() if "相信" in k), ""),
        }
        for row in table_rows("何时开始相信预测")
    ]

    result = dict(empty)
    result.update(
        {
            "version": version,
            "formula": formula,
            "scale": scale,
            "dim_count": len(dims) or len(RUBRIC_DIMS),
            "dims": dims,
            "buckets_absolute": buckets_absolute,
            "buckets_ratio": buckets_ratio,
            "coldstart_trust_table": coldstart,
            "contamination_hits": contamination_hits,
            "benchmark_signals_section_present": "Benchmark-derived initial signals" in text,
        }
    )
    return result


def check_rubric_doc_consistency(root: Path, rubric: dict[str, Any]) -> list[dict[str, Any]]:
    """⑪ 读 CLAUDE.md 的「7 维评分体系」段与生效口径比对。**只读只报，绝不改写。**"""
    path = root / "CLAUDE.md"
    conflicts: list[dict[str, Any]] = []
    try:
        text = path.read_text(encoding="utf-8")
    except OSError:
        return conflicts
    lines = text.replace("\r\n", "\n").splitlines()
    start = next((i for i, line in enumerate(lines) if re.match(r"^#{3}\s*7\s*维评分体系", line.strip())), None)
    if start is None:
        return conflicts
    end = next(
        (i for i in range(start + 1, len(lines)) if re.match(r"^#{1,4}\s+", lines[i].strip())),
        len(lines),
    )
    source = f"CLAUDE.md:{start + 1}-{end}"
    section = "\n".join(lines[start:end])

    formula_match = re.search(r"综合分公式[：:]\s*`?([^`\n]+)`?", section)
    found_formula = clean_markdown(formula_match.group(1)) if formula_match else ""
    expected_formula = rubric.get("formula") or RUBRIC_FORMULA
    if found_formula and re.sub(r"\s+", "", found_formula) != re.sub(r"\s+", "", expected_formula):
        conflicts.append(
            {
                "kind": "formula",
                "expected": expected_formula,
                "found": found_formula,
                "source": source,
                "note": "CLAUDE.md 写的是 opinion-video v2 参考加权公式，本 vault 未采用",
            }
        )

    scale_match = re.search(r"(\d+\s*-\s*\d+)\s*分", section)
    found_scale = scale_match.group(1).replace(" ", "") if scale_match else ""
    expected_scale = rubric.get("scale") or RUBRIC_SCALE
    if found_scale and found_scale != expected_scale.replace(" ", ""):
        conflicts.append(
            {
                "kind": "scale",
                "expected": f"每维 {expected_scale}",
                "found": f"每维 {found_scale}",
                "source": source,
                "note": "真实量程每维 0-5，composite 才是 0-10",
            }
        )

    sat_match = re.search(r"SAT\s*([^\n|]*)\|", section)
    found_sat = clean_markdown(sat_match.group(1)) if sat_match else ""
    dim_lookup = {dim["code"]: dim for dim in rubric.get("dims", [])}
    expected_sat = dim_lookup.get("SAT", {}).get("name_cn") or RUBRIC_DIM_CN["SAT"]
    if found_sat and expected_sat not in found_sat:
        conflicts.append(
            {
                "kind": "semantics",
                "expected": f"SAT {expected_sat}（{RUBRIC_DIM_EN['SAT']}）",
                "found": f"SAT {found_sat}",
                "source": source,
                "note": "同一 SAT 分在预测与复盘之间不可比——这是最危险的一条",
            }
        )
    return conflicts


def parse_benchmark(root: Path, warnings: list[str]) -> dict[str, Any]:
    """⑫ benchmark.md → 对标组样本 + 派生 rubric 信号。"""
    text = read_text(root / "benchmark.md", warnings)
    result: dict[str, Any] = {
        "name": "",
        "platform": "",
        "imported_at": "",
        "sample_count": 0,
        "complete_count": 0,
        "truncated_count": 0,
        "samples": [],
        "signals": {"important": [], "unstable": [], "not_in_rubric": [], "detail": {}},
        "metric_coverage": [],
        "missing_metrics": ["完播率", "均播时长", "CTR"],
        "fade_condition": "",
        "source_path": "benchmark.md",
        "advice": [],
    }
    if not text:
        return result

    result["name"] = md_field(text, "名字")
    result["platform"] = md_field(text, "平台")
    result["imported_at"] = md_field(text, "导入时间")
    sample_raw = md_field(text, "样本数")
    count_match = re.match(r"(\d+)", sample_raw)
    result["sample_count"] = int(count_match.group(1)) if count_match else 0
    complete = re.search(r"(\d+)\s*条?\s*完整", sample_raw)
    truncated = re.search(r"(\d+)\s*条?\s*截断", sample_raw)
    result["complete_count"] = int(complete.group(1)) if complete else result["sample_count"]
    result["truncated_count"] = int(truncated.group(1)) if truncated else 0

    for _, header, rows in iter_tables_by_section(text):
        if "#" not in header or "播放" not in header:
            continue
        result["metric_coverage"] = [key for key in header if key in {"播放", "点赞", "评论", "收藏"}]
        for row in rows:
            index_match = re.match(r"\d+", row.get("#", ""))
            if not index_match:
                continue
            result["samples"].append(
                {
                    "n": int(index_match.group(0)),
                    "account": row.get("账号", ""),
                    "title": row.get("视频标题", "") or row.get("标题", ""),
                    "plays": parse_number(row.get("播放")),
                    "likes": parse_number(row.get("点赞")),
                    "comments": parse_number(row.get("评论")),
                    "favs": parse_number(row.get("收藏")),
                    "impression": row.get("你的印象", "") or row.get("印象", ""),
                    "transcript": row.get("transcript", ""),
                    "truncated": "截断" in (row.get("你的印象", "") or ""),
                }
            )
        break

    def signal_codes(pattern: str) -> tuple[list[str], dict[str, str]]:
        scope = section_slice(text, pattern)
        codes: list[str] = []
        detail: dict[str, str] = {}
        for line in scope.splitlines():
            match = re.match(r"^\s*[-*]\s*\*\*([A-Z]{2,3})\s*([^*]*?)\*\*\s*[：:]\s*(.+)$", line.strip())
            if not match:
                continue
            code = match.group(1)
            codes.append(code)
            detail[code] = {
                "label": clean_markdown(match.group(2)),
                "text": clean_markdown(match.group(3)),
            }
        return codes, detail

    important, important_detail = signal_codes("高表现样本共有的维度")
    unstable, unstable_detail = signal_codes("看起来相对不稳定的维度")
    detail = dict(important_detail)
    detail.update(unstable_detail)
    result["signals"] = {
        "important": important,
        "unstable": unstable,
        "not_in_rubric": [code for code in important + unstable if code not in RUBRIC_DIM_CODES],
        "detail": detail,
    }
    result["advice"] = bullet_items(section_slice(text, "Claude 给的初始建议"))

    fade = re.search(r"calibration_samples\s*>=?\s*(\d+)", text)
    result["fade_condition"] = (
        f"calibration_samples ≥ {fade.group(1)}" if fade else "calibration_samples ≥ 10"
    )
    return result


def parse_script_patterns(root: Path, warnings: list[str]) -> dict[str, Any]:
    """⑬ script_patterns.md → Imported / 自有 pattern + 占位统计。"""
    text = read_text(root / "script_patterns.md", warnings)
    result: dict[str, Any] = {
        "imported": [],
        "own_verified": [],
        "own_pending": [],
        "placeholders": {"cheatsheet_todo": 0, "edit_history_rows": 0, "new_patterns": 0},
        "source_path": "script_patterns.md",
    }
    if not text:
        return result

    heads = list(re.finditer(r"(?m)^###\s*Imported Pattern\s*(\d+)\s*[：:]\s*(.+)$", text))
    for index, head in enumerate(heads):
        end = heads[index + 1].start() if index + 1 < len(heads) else len(text)
        block = text[head.end() : end]
        stop = re.search(r"(?m)^#{2,3}\s+(?!Imported Pattern)", block)
        if stop:
            block = block[: stop.start()]

        def grab(label: str) -> str:
            match = re.search(rf"(?m)^{label}[：:]\s*(.+(?:\n(?!\s*$)(?!\w+[：:]).*)*)", block)
            return clean_markdown(match.group(1)) if match else ""

        transferable = grab("可迁移句式") or grab("可迁移方向") or grab("可迁移栏目名")
        if not transferable:
            quote = re.search(r"(?m)^>\s*(.+)$", block)
            transferable = clean_markdown(quote.group(1)) if quote else ""
        transferable = re.sub(r"^>\s*", "", transferable).strip()
        result["imported"].append(
            {
                "n": int(head.group(1)),
                "title": clean_markdown(head.group(2)),
                "applies": grab("适用"),
                "structure": grab("结构"),
                "evidence": grab("样本依据"),
                "transferable": transferable,
                "note": grab("注意") or grab("迁移原则"),
                "untested": True,
                "partial": "partial transcript" in block,
            }
        )

    cheatsheet = section_slice(text, "结构选型 cheat sheet", level=2)
    result["placeholders"]["cheatsheet_todo"] = len(re.findall(r"（待填）", cheatsheet))
    history = section_slice(text, "用户改稿历史观察", level=2)
    history_rows = [
        row
        for line in history.splitlines()
        if (row := split_table_row(line))
        and not is_separator_row(row)
        and "视频" not in row[0]
        and "待填" not in "".join(row)
        and any(cell.strip() for cell in row)
    ]
    result["placeholders"]["edit_history_rows"] = len(history_rows)
    new_patterns = section_slice(text, "新发现的 Pattern", level=2)
    result["placeholders"]["new_patterns"] = len(
        re.findall(r"(?m)^###\s+", new_patterns)
    )
    return result


def build_cheat_data(
    state: dict[str, Any],
    predictions: list[dict[str, Any]],
    rubric: dict[str, Any] | None = None,
    benchmark: dict[str, Any] | None = None,
    patterns: dict[str, Any] | None = None,
) -> dict[str, Any]:
    shoots = state.get("shoots") if isinstance(state.get("shoots"), list) else []
    pending = state.get("pending_retros") if isinstance(state.get("pending_retros"), list) else []
    samples = state.get("calibration_samples", 0) or 0
    if samples <= 0:
        confidence = "🔴 极低 · 占星级，纯纪律训练"
    elif samples < 5:
        confidence = f"🟡 建立中 · {samples}/5 个校准配对"
    else:
        confidence = f"🟢 可用 · {samples} 个校准配对"
    deviation = state.get("last_prediction_deviation") or {}
    confounds = state.get("last_sample_confounds") or []
    directional = state.get("consecutive_directional_errors") or []
    return {
        # ⑮ state 直通字段
        "content_form": state.get("content_form", ""),
        "rubric_form_mismatch": bool(state.get("rubric_form_mismatch")),
        "typical_duration_seconds": state.get("typical_duration_seconds"),
        "hooks_installed": bool(state.get("hooks_installed")),
        "data_collection": state.get("data_collection", ""),
        "last_bump_at": state.get("last_bump_at"),
        "last_bump_self_audited": bool(state.get("last_bump_self_audited")),
        "last_published_file": state.get("last_published_file", ""),
        "last_published_video_folder": state.get("last_published_video_folder", ""),
        "last_publish_ad_hoc": bool(state.get("last_publish_ad_hoc")),
        "enabled_perf_adapters": state.get("enabled_perf_adapters", []),
        "deviation": deviation,
        "confounds": confounds,
        "bump_progress": {
            "samples": samples,
            "need": 5,
            "directional": len(directional),
            "directional_need": 3,
            "excluded_confounded": 1 if deviation.get("confounded") else 0,
        },
        "rubric": rubric or {},
        "benchmark": benchmark or {},
        "patterns": patterns or {},
        "rubric_version": state.get("rubric_version", "v0"),
        "calibration_samples": samples,
        "confidence": confidence,
        "buffer_count": len(shoots),
        "cadence_days": state.get("target_publish_cadence_days"),
        "baseline_plays": state.get("baseline_plays"),
        "benchmark_name": state.get("benchmark_name", ""),
        "benchmark_sample_count": state.get("benchmark_sample_count", 0),
        "last_published_at": state.get("last_published_at"),
        "last_retro_at": state.get("last_retro_at"),
        "last_trends_run_at": state.get("last_trends_run_at"),
        "pending_retros": pending,
        "shoots": shoots,
        "predictions": predictions,
        "scripts": [],
        "directional_errors": len(state.get("consecutive_directional_errors") or []),
        "in_progress": state.get("in_progress_session") or {},
        "benchmark_status": state.get("benchmark_status", ""),
    }


DBS_SKILLS = [
    {"cat": "定位与战略", "name": "dbs-goal", "trigger": "/dbs-goal · 「帮我搞清楚目标」", "desc": "维特根斯坦式目标审计：把模糊目标拆成可检查的交付物"},
    {"cat": "定位与战略", "name": "dbs-diagnosis", "trigger": "/dbs-diagnosis · 「诊断商业模式」", "desc": "问诊（消解问题）+ 体检（拆商业模式）双模式"},
    {"cat": "定位与战略", "name": "dbs-benchmark", "trigger": "/dbs-benchmark · 「帮我找对标」", "desc": "五重过滤法找值得模仿的对标，排除关于「我」的噪音"},
    {"cat": "定位与战略", "name": "dbs-slowisfast", "trigger": "/dbs-slowisfast · 「我是不是太快了」", "desc": "找看起来更慢但长期更快的方法，用摩擦建资产"},
    {"cat": "定位与战略", "name": "dbs-decision", "trigger": "/dbs-decision · /决策立案", "desc": "把任何长期领域做成四层结构的本地决策工程"},
    {"cat": "内容创作", "name": "dbs-resonate", "trigger": "/dbs-resonate · 「这稿有没有戳中人」", "desc": "文稿共鸣诊断：传播心理学框架定位问题 + 给改法（本地已装）"},
    {"cat": "内容创作", "name": "dbs-content", "trigger": "/dbs-content · 「这个内容怎么做」", "desc": "选题通过后诊断怎么做成好内容（本地已装）"},
    {"cat": "内容创作", "name": "dbs-hook", "trigger": "/dbs-hook · 「帮我优化开头」", "desc": "短视频开头诊断 + 优化方案"},
    {"cat": "内容创作", "name": "dbs-xhs-title", "trigger": "/dbs-xhs-title · 「起个小红书标题」", "desc": "75 个验证过的爆款标题公式，挑对的用对的"},
    {"cat": "内容创作", "name": "dbs-ai-check", "trigger": "/dbs-ai-check · 「有没有 AI 味」", "desc": "扫描 AI 生成痕迹，只诊断不改（本地已装）"},
    {"cat": "内容创作", "name": "dbs-spread", "trigger": "/dbs-spread · 「为什么这个能火」", "desc": "5 个传播学理论解码内容为什么共鸣"},
    {"cat": "内容创作", "name": "dbs-content-system", "trigger": "/dbs-content-system", "desc": "把本地文稿库搭成可持续生长的内容结构化工程"},
    {"cat": "思维工具", "name": "dbs-deconstruct", "trigger": "/dbs-deconstruct · 「拆解这个概念」", "desc": "维特根斯坦 + 奥派：把模糊商业概念拆到原子级"},
    {"cat": "思维工具", "name": "dbs-good-question", "trigger": "/dbs-good-question · 「把问题说清楚」", "desc": "把模糊问题改写成 Agent 可推理、可验证的问题说明书"},
    {"cat": "思维工具", "name": "dbs-action", "trigger": "/dbs-action · 「知道该做但就是不做」", "desc": "阿德勒框架诊断执行力卡点"},
    {"cat": "思维工具", "name": "dbs-learning", "trigger": "/dbs-learning · 「带我学一个课题」", "desc": "把课题拆成连续学习文章，按反馈调深度节奏"},
    {"cat": "思维工具", "name": "dbs-chatroom", "trigger": "/dbs-chatroom · /奥派", "desc": "多角色专家聊天室（含哈耶克×米塞斯奥派场）"},
    {"cat": "存档与报告", "name": "dbs-save", "trigger": "/dbs-save · 「保存这次诊断」", "desc": "把当前诊断状态存到本地，跨会话续用"},
    {"cat": "存档与报告", "name": "dbs-restore", "trigger": "/dbs-restore · 「接着上次」", "desc": "拉回上次诊断快照继续"},
    {"cat": "存档与报告", "name": "dbs-report", "trigger": "/dbs-report · 「出报告」", "desc": "把多次 dbs-save 合并成可交付的 markdown 报告"},
]


def parse_reviews(root: Path, warnings: list[str]) -> list[dict[str, Any]]:
    reviews_dir = root / "scripts" / "reviews"
    items: list[dict[str, Any]] = []
    if not reviews_dir.exists():
        return items
    for path in sorted(reviews_dir.glob("*.md"), reverse=True):
        text = read_text(path, warnings)
        if not text:
            continue
        fm, body = parse_front_matter(text)
        issues: list[dict[str, str]] = []
        for line in body.splitlines():
            issue_match = re.match(r"^\|\s*(P\d-\d+)\s*\|", line)
            if not issue_match:
                continue
            cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
            if len(cells) < 6:
                continue
            issues.append(
                {
                    "id": cells[0],
                    "priority": cells[1],
                    "problem": clean_markdown(cells[2]),
                    "status": cells[5],
                }
            )
        pacing: list[dict[str, Any]] = []
        for line in body.splitlines():
            pace_match = re.match(r"^\|\s*(\d{1,2})\s*\|\s*[\d.\s––\-s]+\|", line)
            if not pace_match:
                continue
            cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
            if len(cells) < 5:
                continue
            verdict_raw = clean_markdown(cells[4])
            if "冷" in verdict_raw:
                level = "cold"
            elif verdict_raw != "有效":
                level = "warn"
            else:
                level = "ok"
            pacing.append(
                {
                    "idx": int(cells[0]),
                    "time": cells[1],
                    "content": clean_markdown(cells[2]),
                    "verdict": verdict_raw,
                    "level": level,
                }
            )
        pacing = [p for p in pacing if 1 <= p["idx"] <= 12][:12]
        open_count = sum(1 for issue in issues if "待" in issue["status"])
        checklist = [
            {"text": clean_markdown(match.group(2)), "done": match.group(1).lower() == "x"}
            for match in re.finditer(r"(?m)^\s*[-*]\s*\[([ xX])\]\s*(.+)$", body)
        ]
        items.append(
            {
                "file": path.name,
                "path": f"scripts/reviews/{path.name}",
                "checklist": checklist,
                "checklist_total": len(checklist),
                "checklist_done": sum(1 for item in checklist if item["done"]),
                "topic": clean_markdown(fm.get("topic") or first_heading(body, path.stem)),
                "created": str(fm.get("created", "")),
                "flow": clean_markdown(fm.get("analysis_flow", "")),
                "score": parse_number(fm.get("baseline_score")),
                "status": clean_markdown(fm.get("status", "")),
                "issues": issues,
                "issue_total": len(issues),
                "issue_open": open_count,
                "pacing": pacing,
            }
        )
    return items


def build_dbs_data(root: Path, warnings: list[str]) -> dict[str, Any]:
    local_dir = root / "06-业务运营" / "skills"
    local = sorted(p.name for p in local_dir.iterdir() if p.is_dir()) if local_dir.exists() else []
    groups: dict[str, list[dict[str, Any]]] = {}
    for skill in DBS_SKILLS:
        entry = dict(skill)
        entry["local"] = skill["name"] in local
        groups.setdefault(skill["cat"], []).append(entry)
    return {
        "groups": [{"cat": cat, "skills": skills} for cat, skills in groups.items()],
        "total": len(DBS_SKILLS),
        "local_count": sum(1 for s in DBS_SKILLS if s["name"] in local),
        "local_skills": local,
        "reviews": parse_reviews(root, warnings),
        "archives": parse_dbs_archives(warnings),
        "pipeline": "dbs-resonate 共鸣诊断 → dbs-content 内容诊断 → 时钟理论节奏 → 爆款/传播方法论 → cheat-score 粗打分",
    }


def collect_data(vault_root: Path | str) -> tuple[dict[str, Any], list[str]]:
    root = Path(vault_root).resolve()
    warnings: list[str] = []
    state = load_state(root / ".cheat-state.json", warnings)
    candidates = parse_candidates(root / "candidates.md", warnings)
    schedule_data = parse_schedule(root / "01-内容生产/选题管理/02-选题排期.md", warnings)
    radar_data = parse_radar(root / "01-内容生产/选题管理/🔥每日热点雷达.md", warnings)
    auto_hotspots_data = parse_auto_hotspots(root, radar_data, warnings)
    idea_notes = parse_idea_notes(root / "01-内容生产/选题管理/00-选题记录.md", warnings)
    score_index = parse_prediction_scores(root / "predictions", warnings)
    analytics_data = parse_published(root / "03-已发布内容", warnings)
    library_data = parse_library(root / "02-素材库", warnings)
    methodology_data = parse_methodology(root, warnings)
    ideas_data = build_ideas(candidates, radar_data, idea_notes, score_index)
    predictions_detail = parse_predictions_detail(root / "predictions", warnings)
    funnels = parse_retention_funnels(root, warnings)
    def funnel_depth(funnel: list[dict[str, Any]]) -> int:
        return sum(1 for step in funnel if step.get("pct") is not None)

    for prediction in predictions_detail:
        # BUG-3：漏斗优先用复盘段自算的结果；数据统计表只在自算更薄时兜底。
        own = prediction.get("funnel") or []
        prediction["funnel_source"] = "复盘段自算" if own else ""
        pred_key = re.sub(r"[\s？?！!，,。.]", "", prediction["title"]).lower()
        for funnel_key, funnel in funnels.items():
            if funnel_key in pred_key or pred_key in funnel_key:
                if funnel_depth(funnel) > funnel_depth(own):
                    prediction["funnel"] = funnel
                    prediction["funnel_source"] = "数据统计表（fallback）"
                break
    rubric_data = parse_rubric_definition(root, warnings)
    # ⑪ 只读只报：把文档层冲突（CLAUDE.md 的加权公式 / 0-10 量程 / SAT=满足感）
    # 变成页面告警，绝不改写 CLAUDE.md。
    rubric_data["doc_conflicts"] = check_rubric_doc_consistency(root, rubric_data)
    benchmark_data = parse_benchmark(root, warnings)
    patterns_data = parse_script_patterns(root, warnings)
    cheat_data = build_cheat_data(
        state, predictions_detail, rubric_data, benchmark_data, patterns_data
    )
    cheat_data["doc_conflicts"] = rubric_data["doc_conflicts"]
    dbs_data = build_dbs_data(root, warnings)
    cheat_data["scripts"] = parse_scripts_index(
        root, warnings, dbs_data.get("reviews", []), predictions_detail
    )
    cheat_data["workbench"] = build_workbench(
        cheat_data["scripts"], predictions_detail, dbs_data.get("reviews", []), state, root
    )
    cheat_data["candidates"] = [
        {
            "title": c.get("title", ""),
            "type": normalize_type(c.get("type")),
            "tier": clean_markdown(c.get("tier")) or "候选",
        }
        for c in candidates
    ]
    cheat_data["memo_observations"] = parse_memo_observations(root, warnings)
    cheat_data["derived_assets"] = {
        "benchmark": (root / "benchmark.md").exists(),
        "audience": (root / "audience.md").exists(),
        "rubric_notes": (root / "rubric_notes.md").exists(),
        "rubric_memo": (root / "rubric-memo.md").exists(),
    }

    pipeline_data = {
        "candidates": candidates,
        "schedule": schedule_data["schedule"],
        "inventory": schedule_data["inventory"],
        "gaps": schedule_data["gaps"],
        "performance_rows": schedule_data["performance_rows"],
        "type_counts": {content_type: 0 for content_type in CONTENT_TYPES},
    }
    pipeline_data["type_counts"].update(Counter(candidate["type"] for candidate in candidates))
    data = {
        "global": build_global(
            state,
            candidates,
            schedule_data,
            radar_data,
            analytics_data,
            library_data,
            methodology_data,
            compute_radar_freshness(root, radar_data),
        ),
        "radar": radar_data,
        "auto_hotspots": auto_hotspots_data,
        "ideas": ideas_data,
        "pipeline": pipeline_data,
        "analytics": analytics_data,
        "library": library_data,
        "methodology": methodology_data,
        "cheat": cheat_data,
        "dbs": dbs_data,
        "warnings": warnings,
    }
    return data, warnings


def inline_json(data: dict[str, Any]) -> str:
    return json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")


def asset_stamps() -> dict[str, str]:
    # Content-hash query stamps so browsers never mix a fresh page with stale
    # cached assets (file:// ignores the query string, http busts the cache).
    stamps: dict[str, str] = {}
    for name in ("app.css", "app.js", "effects.js"):
        path = DASHBOARD_DIR / "assets" / name
        try:
            stamps[name] = hashlib.md5(path.read_bytes()).hexdigest()[:8]
        except OSError:
            continue
    return stamps


def render_page(page: str, data: dict[str, Any], stamps: dict[str, str] | None = None) -> str:
    template_path = DASHBOARD_DIR / "templates" / f"{page}.html"
    template = template_path.read_text(encoding="utf-8")
    rendered = template.replace("__DASHBOARD_DATA__", inline_json(data))
    for name, stamp in (stamps or {}).items():
        rendered = rendered.replace(f'"assets/{name}"', f'"assets/{name}?v={stamp}"')
    return rendered


def copy_assets(out_dir: Path) -> None:
    source = DASHBOARD_DIR / "assets"
    target = out_dir / "assets"
    target.mkdir(parents=True, exist_ok=True)
    for name in ("app.css", "app.js", "effects.js"):
        src = source / name
        dst = target / name
        if not src.exists():
            continue
        if src.resolve() == dst.resolve():
            continue
        shutil.copy2(src, dst)


def build_site(vault_root: Path | str, out_dir: Path | str | None = None) -> tuple[dict[str, Any], list[str]]:
    root = Path(vault_root).resolve()
    out = Path(out_dir).resolve() if out_dir else DASHBOARD_DIR
    out.mkdir(parents=True, exist_ok=True)
    (out / "assets").mkdir(parents=True, exist_ok=True)

    data, warnings = collect_data(root)
    copy_assets(out)
    (out / "assets" / "data.json").write_text(
        json.dumps(data, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    stamps = asset_stamps()
    for page in PAGES:
        (out / f"{page}.html").write_text(render_page(page, data, stamps), encoding="utf-8")
    return data, warnings


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Build the AI content dashboard.")
    parser.add_argument("--vault", type=Path, default=DASHBOARD_DIR.parent, help="Obsidian vault root")
    parser.add_argument("--out", type=Path, default=DASHBOARD_DIR, help="Output directory")
    args = parser.parse_args(argv)
    data, warnings = build_site(args.vault, args.out)
    for warning in warnings:
        print(f"warning: {warning}", file=sys.stderr)
    print(
        "built dashboard: "
        f"{len(PAGES)} pages, "
        f"{data['global']['candidate_count']} candidates, "
        f"{data['global']['radar_signal_count']} radar signals"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
