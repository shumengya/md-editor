"""将思源宋体压缩为常用字符子集（会丢失完整 CJK 字库，默认不再使用）。"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
FONTS_DIR = ROOT / "public" / "fonts"
CHARS_FILE = ROOT / "scripts" / "subset-chars.txt"
CHARS_SOURCE = ROOT / "scripts" / "3500-chars.txt"
CHARS_URL = "https://raw.githubusercontent.com/elephantnose/characters/master/3500%E5%B8%B8%E7%94%A8%E6%B1%89%E5%AD%97.txt"

WEIGHTS = (
    ("SourceHanSerifSC-Regular.woff2", 400),
    ("SourceHanSerifSC-Bold.woff2", 700),
)

EXTRA_SYMBOLS = "←→↑↓↔↕•·—–…「」『』【】《》〈〉“”‘’￥℃±×÷"


def download_chars() -> str:
    import urllib.request

    CHARS_SOURCE.parent.mkdir(parents=True, exist_ok=True)
    print(f"下载常用 3500 字表 ...")
    urllib.request.urlretrieve(CHARS_URL, CHARS_SOURCE)
    han = CHARS_SOURCE.read_text(encoding="utf-8").replace("\n", "").replace("\r", "")
    return han


def build_charset() -> str:
    han = download_chars() if not CHARS_SOURCE.exists() else CHARS_SOURCE.read_text(encoding="utf-8").replace("\n", "").replace("\r", "")

    parts = [
        "".join(chr(c) for c in range(0x20, 0x7F)),
        "".join(chr(c) for c in range(0xA0, 0x100)),
        "".join(chr(c) for c in range(0x2000, 0x206F + 1)),
        "".join(chr(c) for c in range(0x2190, 0x21FF + 1)),
        "".join(chr(c) for c in range(0x2200, 0x22FF + 1)),
        "".join(chr(c) for c in range(0x2460, 0x24FF + 1)),
        "".join(chr(c) for c in range(0x2500, 0x257F + 1)),
        "".join(chr(c) for c in range(0x3000, 0x303F + 1)),
        "".join(chr(c) for c in range(0xFF00, 0xFFEF + 1)),
        EXTRA_SYMBOLS,
        han,
    ]
    chars = "".join(dict.fromkeys("".join(parts)))
    CHARS_FILE.parent.mkdir(parents=True, exist_ok=True)
    CHARS_FILE.write_text(chars, encoding="utf-8")
    print(f"字符集共 {len(chars)} 个字符 -> {CHARS_FILE.name}")
    return chars


def subset_font(src: Path, dst: Path) -> None:
    cmd = [
        sys.executable,
        "-m",
        "fontTools.subset",
        str(src),
        f"--text-file={CHARS_FILE}",
        "--flavor=woff2",
        f"--output-file={dst}",
    ]
    subprocess.run(cmd, check=True)


def main() -> None:
    print("当前项目使用完整 CJK 可变字体，请运行 convert_fonts.py 而非本脚本。")
    print("若仍要子集化，请删除 public/fonts/SourceHanSerifSC-VF.woff2 后重试。")
    if (FONTS_DIR / "SourceHanSerifSC-VF.woff2").exists():
        sys.exit(1)

    FONTS_DIR.mkdir(parents=True, exist_ok=True)
    build_charset()

    for filename, _ in WEIGHTS:
        src = FONTS_DIR / filename
        if not src.exists():
            print(f"缺少源字体: {src}")
            print("请先将完整 woff2 字体放入 public/fonts/ 后再运行本脚本。")
            sys.exit(1)

    tmp_dir = FONTS_DIR / "_subset_tmp"
    tmp_dir.mkdir(exist_ok=True)

    total_kb = 0
    for filename, _ in WEIGHTS:
        src = FONTS_DIR / filename
        tmp = tmp_dir / filename
        print(f"子集化 {filename} ...", end=" ")
        subset_font(src, tmp)
        kb = tmp.stat().st_size // 1024
        total_kb += kb
        print(f"ok ({kb} KB)")

    # 删除多余字重与临时测试文件
    keep = {name for name, _ in WEIGHTS}
    for path in FONTS_DIR.glob("*.woff2"):
        if path.name not in keep and not path.name.startswith("_"):
            print(f"删除 {path.name}")
            path.unlink()

    for path in FONTS_DIR.glob("_*.woff2"):
        path.unlink(missing_ok=True)

    for filename, _ in WEIGHTS:
        tmp = tmp_dir / filename
        dst = FONTS_DIR / filename
        if dst.exists():
            dst.unlink()
        tmp.replace(dst)

    tmp_dir.rmdir()
    print(f"完成，保留 {len(WEIGHTS)} 个字重，合计约 {total_kb / 1024:.2f} MB")


if __name__ == "__main__":
    main()
