"""「終電のあとで」の生成画像をプロジェクトへ配置する。

背景とCGは 1920x1080 に拡大して JPEG のまま、立ち絵は rembg で背景を抜いて PNG にする。
立ち絵は表情差分で位置がずれないよう、トリミングせず元のキャンバスのまま保存する。
使い方: py -3 scripts/prepare_shuuden_assets.py <生成画像フォルダ>
"""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image
from rembg import new_session, remove

APP_ROOT = Path(__file__).resolve().parent.parent
PROJECT = APP_ROOT / "projects" / "shuuden"

BACKGROUNDS = ["office_night", "bar_night", "room_night", "room_morning"]
CGS = ["cg_bar", "cg_door", "cg_bed", "cg_bed_open", "cg_morning"]
SPRITES = ["rin_normal", "rin_smile", "rin_shy", "rin_heat"]


def wide(src: Path, dest: Path) -> None:
    image = Image.open(src).convert("RGB").resize((1920, 1080), Image.LANCZOS)
    dest.parent.mkdir(parents=True, exist_ok=True)
    image.save(dest, quality=92)


def sprite(src: Path, dest: Path, session) -> None:
    image = Image.open(src).convert("RGB")
    cut = remove(image, session=session, post_process_mask=True)
    dest.parent.mkdir(parents=True, exist_ok=True)
    cut.save(dest)


def main() -> None:
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    source = Path(sys.argv[1])
    for name in BACKGROUNDS:
        wide(source / f"{name}.jpg", PROJECT / "backgrounds" / f"{name}.jpg")
    for name in CGS:
        wide(source / f"{name}.jpg", PROJECT / "cgs" / f"{name}.jpg")
    session = new_session("isnet-anime")
    for name in SPRITES:
        sprite(source / f"{name}.jpg", PROJECT / "chars" / f"{name}.png", session)
    print(f"配置しました: {PROJECT}")


if __name__ == "__main__":
    main()
