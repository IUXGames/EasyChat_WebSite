#!/usr/bin/env python3
"""
Ensambla content/{lang}/docs.md con marcadores doc-shell a partir de README.{lang}.md
(útil solo si mantienes los README monolíticos como fuente temporal).

Marcador por página (línea propia, antes del markdown de esa página):
  <!-- doc-shell:page slug="installation" -->

Uso (desde webSite):
  python doc-shell/tools/build_docs.py
"""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CONTENT = ROOT / "content"

SLUGS_TAIL = [
    "features",
    "requirements",
    "installation",
    "architecture",
    "first-use",
    "node-easychat",
    "config-resource",
    "chatcommand-resource",
    "singleton",
    "signals",
    "keyboard",
    "messages",
    "commands",
    "multiplayer",
    "animations",
    "notifications",
    "sounds",
    "editor-preview",
    "limitations",
    "scaling",
    "modifying",
    "troubleshooting",
    "credits",
]


def is_toc_chunk(first_line: str) -> bool:
    return "Tabla de contenidos" in first_line or "Table of contents" in first_line


def build_docs_from_readme(readme: Path, out: Path) -> None:
    text = readme.read_text(encoding="utf-8")
    chunks = re.split(r"\n(?=## )", text)
    parts: list[str] = []

    overview = chunks[0].strip()
    parts.append('<!-- doc-shell:page slug="overview" -->\n\n')
    parts.append(overview)
    parts.append("\n\n")

    idx = 0
    for chunk in chunks[1:]:
        first = chunk.split("\n", 1)[0].strip()
        if is_toc_chunk(first):
            parts.append(chunk.strip())
            parts.append("\n\n")
            continue
        slug = SLUGS_TAIL[idx]
        idx += 1
        parts.append(f'<!-- doc-shell:page slug="{slug}" -->\n\n')
        parts.append(chunk.strip())
        parts.append("\n\n")

    if idx != len(SLUGS_TAIL):
        raise SystemExit(f"Sección count mismatch: {idx} != {len(SLUGS_TAIL)}")

    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text("".join(parts).rstrip() + "\n", encoding="utf-8")
    print(f"Wrote {out.relative_to(ROOT)}")


def main() -> None:
    es_readme = CONTENT / "README.es.md"
    en_readme = CONTENT / "README.en.md"
    if not es_readme.is_file() or not en_readme.is_file():
        raise SystemExit("Need content/README.es.md and content/README.en.md to build docs.md")
    build_docs_from_readme(es_readme, CONTENT / "es" / "docs.md")
    build_docs_from_readme(en_readme, CONTENT / "en" / "docs.md")


if __name__ == "__main__":
    main()
