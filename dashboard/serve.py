#!/usr/bin/env python3
"""Dev preview server for the dashboard.

Same as `python3 -m http.server` but sends Cache-Control: no-cache so the
browser always revalidates HTML/assets (bare http.server sends no cache
headers and Chrome's heuristic caching then serves stale pages for hours).
Optionally rebuild from another vault before serving, which lets the OSS
workbench preview a private vault without copying private source files into
the repository.

Usage: python3 serve.py [port] [--vault /path/to/vault]   (default 8765)
"""

import argparse
import json
import os
import re
import sys
import tempfile
import threading
import uuid
from datetime import date
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse


WRITE_LOCK = threading.Lock()
LIBRARY_DIRS = {
    "核心概念": "核心概念库",
    "金句": "金句库",
    "案例": "案例库",
    "爆款文稿": "爆款文稿库",
}


def short_text(value: object, field: str, limit: int = 160, required: bool = False) -> str:
    if not isinstance(value, str):
        raise ValueError(f"{field}格式不正确")
    cleaned = " ".join(value.split()).strip()
    if required and not cleaned:
        raise ValueError(f"请填写{field}")
    if len(cleaned) > limit:
        raise ValueError(f"{field}不能超过{limit}字")
    return cleaned.replace("|", "｜")


def body_text(value: object, field: str, limit: int = 5000) -> str:
    if not isinstance(value, str):
        raise ValueError(f"{field}格式不正确")
    cleaned = value.strip()
    if not cleaned:
        raise ValueError(f"请填写{field}")
    if len(cleaned) > limit:
        raise ValueError(f"{field}不能超过{limit}字")
    return cleaned


def valid_date(value: object, field: str = "日期") -> str:
    text = short_text(value, field, 10, required=True)
    try:
        return date.fromisoformat(text).isoformat()
    except ValueError as exc:
        raise ValueError(f"{field}应为 YYYY-MM-DD") from exc


def optional_number(value: object, field: str, maximum: float = 1_000_000_000) -> float | None:
    if value in (None, ""):
        return None
    try:
        number = float(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{field}必须是数字") from exc
    if not 0 <= number <= maximum or not (number < float("inf")):
        raise ValueError(f"{field}超出允许范围")
    return number


def optional_url(value: object) -> str:
    text = short_text(value, "链接", 600)
    if text:
        parsed = urlparse(text)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise ValueError("链接必须以 http:// 或 https:// 开头")
    return text


def atomic_write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", newline="\n", dir=path.parent, delete=False) as handle:
        temporary = Path(handle.name)
        handle.write(text)
    try:
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


def append_to_section(path: Path, heading: str, line: str) -> None:
    if not path.is_file():
        raise ValueError(f"未找到数据文件：{path.name}")
    original = path.read_text(encoding="utf-8")
    marker = f"## {heading}"
    start = original.find(marker)
    if start < 0:
        raise ValueError(f"数据文件缺少「{heading}」区，未写入")
    next_heading = re.search(r"(?m)^##\s+", original[start + len(marker):])
    end = start + len(marker) + next_heading.start() if next_heading else len(original)
    before, after = original[:end].rstrip(), original[end:]
    atomic_write(path, before + "\n\n" + line + "\n\n" + after.lstrip("\n"))


def yaml_field(value: str) -> str:
    return json.dumps(value, ensure_ascii=False)


def add_entry(vault: Path, kind: str, payload: dict) -> Path:
    """Only four fixed local write paths are allowed; no request-supplied paths."""
    today = date.today().isoformat()
    if kind == "idea":
        title = short_text(payload.get("title", ""), "灵感", 180, required=True)
        source = short_text(payload.get("source", ""), "来源", 180)
        path = vault / "01-内容生产" / "选题管理" / "00-选题记录.md"
        line = f"- [{today}] {title}" + (f" | {source}" if source else "")
        append_to_section(path, "待筛选", line)
        return path
    if kind == "schedule":
        topic = short_text(payload.get("topic", ""), "选题", 180, required=True)
        publish_day = valid_date(payload.get("publish_day", ""), "发布日期")
        content_type = short_text(payload.get("type", ""), "类型", 30, required=True)
        if content_type not in {"共鸣类", "AI教程向", "AI赚钱方式", "方法论", "热点", "其他"}:
            raise ValueError("请选择有效类型")
        status = short_text(payload.get("status", "待拍"), "状态", 30)
        if status not in {"待剪", "待拍", "已拍", "已剪", "待发布"}:
            raise ValueError("请选择有效状态")
        path = vault / "01-内容生产" / "选题管理" / "02-选题排期.md"
        original = path.read_text(encoding="utf-8") if path.is_file() else ""
        if "## 当前批次" not in original:
            raise ValueError("排期文件缺少「当前批次」区，未写入")
        sequences = [int(x) for x in re.findall(r"(?m)^\|\s*(\d+)\s*\|", original)]
        sequence = max(sequences, default=0) + 1
        lines = original.splitlines(keepends=True)
        header_index = next((index for index, line in enumerate(lines) if line.lstrip().startswith("| 序 | 发布日 | 类型 | 选题 | 状态 |")), -1)
        if header_index < 0:
            raise ValueError("排期表头不匹配，未写入")
        insert_at = header_index + 1
        while insert_at < len(lines) and lines[insert_at].lstrip().startswith("|"):
            insert_at += 1
        lines.insert(insert_at, f"| {sequence} | {publish_day} | {content_type} | {topic} | {status} |\n")
        atomic_write(path, "".join(lines))
        return path
    if kind == "video":
        title = short_text(payload.get("title", ""), "视频标题", 180, required=True)
        publish_day = valid_date(payload.get("publish_day", ""), "发布日期")
        platform = short_text(payload.get("platform", "抖音"), "平台", 30, required=True)
        if platform not in {"抖音", "快手", "小红书", "视频号", "B站", "TikTok", "其他"}:
            raise ValueError("请选择有效平台")
        content_type = short_text(payload.get("type", "热点"), "类型", 30, required=True)
        link = optional_url(payload.get("url", ""))
        fields = {"播放量": "views", "点赞": "likes", "评论": "comments", "转发": "shares", "完播率": "completion_rate", "跳出率": "drop_rate"}
        numbers = {label: optional_number(payload.get(key), label, 100 if "率" in label else 1_000_000_000) for label, key in fields.items()}
        lines = ["---", f"tags: [数据, {platform}, 手工录入]", "type: 数据", "status: 已发布", f"created: {today}", f"发布日期: {publish_day}", f"平台: {yaml_field(platform)}", f"内容类型: {yaml_field(content_type)}"]
        lines += [f"{label}: {int(number) if number.is_integer() else number}" for label, number in numbers.items() if number is not None]
        lines += ["---", "", f"# {title}", ""]
        if link:
            lines += [f"视频链接：{link}", ""]
        path = vault / "03-已发布内容" / platform / f"{publish_day}-{uuid.uuid4().hex[:8]}.md"
        atomic_write(path, "\n".join(lines))
        return path
    if kind == "library":
        category = short_text(payload.get("category", ""), "素材分类", 20, required=True)
        if category not in LIBRARY_DIRS:
            raise ValueError("请选择有效素材分类")
        title = short_text(payload.get("title", ""), "素材标题", 180, required=True)
        content = body_text(payload.get("content", ""), "素材内容")
        source = optional_url(payload.get("source", ""))
        path = vault / "02-素材库" / LIBRARY_DIRS[category] / f"{today}-{uuid.uuid4().hex[:8]}.md"
        lines = ["---", f"tags: [素材, {category}]", f"type: {category}", "status: 待核验", f"created: {today}", "---", "", f"# {title}", "", content, ""]
        if source:
            lines += [f"来源：{source}", ""]
        atomic_write(path, "\n".join(lines))
        return path
    raise ValueError("未知录入类型")


class NoCacheHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, vault_path: Path, **kwargs):
        self.vault_path = vault_path
        super().__init__(*args, **kwargs)

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def send_json(self, status: int, payload: dict) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self) -> None:
        if self.path != "/api/entries":
            self.send_json(404, {"error": "接口不存在"})
            return
        host = self.headers.get("Host", "")
        origin = self.headers.get("Origin", "")
        if host not in {f"127.0.0.1:{self.server.server_port}", f"localhost:{self.server.server_port}"} or origin != f"http://{host}":
            self.send_json(403, {"error": "仅允许本机工作台页面写入"})
            return
        if self.headers.get("X-Workbench-Write") != "1" or self.headers.get("Content-Type", "").split(";", 1)[0] != "application/json":
            self.send_json(403, {"error": "请求格式不允许"})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if not 0 < length <= 16_384:
                raise ValueError("内容过长或为空")
            request = json.loads(self.rfile.read(length).decode("utf-8"))
            if not isinstance(request, dict) or not isinstance(request.get("payload"), dict):
                raise ValueError("录入内容格式不正确")
            with WRITE_LOCK:
                path = add_entry(self.vault_path, request.get("kind", ""), request["payload"])
                from build import build_site
                build_site(self.vault_path, Path(__file__).resolve().parent)
            self.send_json(200, {"ok": True, "file": str(path.relative_to(self.vault_path))})
        except (ValueError, UnicodeDecodeError, json.JSONDecodeError) as exc:
            self.send_json(400, {"error": str(exc)})
        except Exception as exc:
            print(f"entry save/build failed: {exc}", file=sys.stderr)
            self.send_json(500, {"error": "保存或重建失败；请检查本机工作台日志"})


def main() -> None:
    dashboard_dir = Path(__file__).resolve().parent
    env_vault = os.environ.get("CONTENT_WORKBENCH_VAULT", "").strip()
    parser = argparse.ArgumentParser(description="Build and serve the content workbench dashboard.")
    parser.add_argument("port", nargs="?", type=int, default=8765)
    parser.add_argument(
        "--vault",
        type=Path,
        default=Path(env_vault).expanduser() if env_vault else None,
        help="Build from this vault before serving (or set CONTENT_WORKBENCH_VAULT)",
    )
    args = parser.parse_args()

    if args.vault:
        from build import build_site

        data, warnings = build_site(args.vault, dashboard_dir)
        for warning in warnings:
            print(f"warning: {warning}", file=sys.stderr)
        print(
            "rebuilt dashboard from "
            f"{args.vault.resolve()} · {data['global']['radar_signal_count']} signals · "
            f"{data['global']['published_count']} published"
        )

    vault = args.vault or dashboard_dir.parent
    handler = partial(NoCacheHandler, directory=str(dashboard_dir), vault_path=vault.resolve())
    server = ThreadingHTTPServer(("127.0.0.1", args.port), handler)
    print(f"serving dashboard at http://localhost:{args.port}/ (Cache-Control: no-cache)")
    server.serve_forever()


if __name__ == "__main__":
    main()
