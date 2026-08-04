#!/usr/bin/env python3
"""Dev preview server for the dashboard.

Same as `python3 -m http.server` but sends Cache-Control: no-cache so the
browser always revalidates HTML/assets (bare http.server sends no cache
headers and Chrome's heuristic caching then serves stale pages for hours).
Usage: python3 serve.py [port]   (default 8765)
"""

import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()


def main() -> None:
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    handler = partial(NoCacheHandler, directory=str(Path(__file__).resolve().parent))
    server = ThreadingHTTPServer(("127.0.0.1", port), handler)
    print(f"serving dashboard at http://localhost:{port}/ (Cache-Control: no-cache)")
    server.serve_forever()


if __name__ == "__main__":
    main()
