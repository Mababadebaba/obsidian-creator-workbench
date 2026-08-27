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
import os
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()


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

    handler = partial(NoCacheHandler, directory=str(dashboard_dir))
    server = ThreadingHTTPServer(("127.0.0.1", args.port), handler)
    print(f"serving dashboard at http://localhost:{args.port}/ (Cache-Control: no-cache)")
    server.serve_forever()


if __name__ == "__main__":
    main()
