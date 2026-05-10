"""Generate PNG icons from scratch using stdlib only (no Pillow).

Run from the service root:
    python3 scripts/gen_icons.py

Writes web/icon-192.png and web/icon-512.png. The icons are pixel art on a
Game Boy green background. Re-run if you change the design.
"""

from __future__ import annotations

import struct
import zlib
from pathlib import Path

# Game Boy palette
GB_LIGHTEST = (0x9b, 0xbc, 0x0f)
GB_LIGHT    = (0x8b, 0xac, 0x0f)
GB_DARK     = (0x30, 0x62, 0x30)
GB_DARKEST  = (0x0f, 0x38, 0x0f)


def write_png(path: Path, pixels: list[list[tuple[int, int, int]]]) -> None:
    h = len(pixels)
    w = len(pixels[0])

    raw = bytearray()
    for row in pixels:
        raw.append(0)
        for r, g, b in row:
            raw.extend((r, g, b))

    def chunk(tag: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)
    idat = zlib.compress(bytes(raw), 9)
    iend = b""

    path.write_bytes(sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", iend))


# 32x32 pixel art template: . = background, l = light, d = dark, X = darkest
TEMPLATE = [
    "................................",
    "................................",
    "..............XXXXX.............",
    "............XXXXXXXXX...........",
    "..........XXXXXXXXXXXXX.........",
    ".........XXdddddddddddXX........",
    "........XXdddddddddddddXX.......",
    ".......XXdddllldddllldddXX......",
    ".......XXddlllllldlllllddXX.....",
    "......XXdddllldddddllldddXX.....",
    "......XXddddddddddddddddddXX....",
    "......XXddddddddddddddddddXX....",
    "......XXdddddddXXXXdddddddXX....",
    "......XXdddddXXdddXXdddddddXX...",
    "......XXdddddXdddddXdddddddXX...",
    "......XXdddddXXdddXXdddddddXX...",
    "......XXdddddddXXXXdddddddXX....",
    "......XXddddddddddddddddddXX....",
    "......XXddddddddddddddddddXX....",
    "......XXdddddddddddddddddXX.....",
    ".......XXdddddddddddddddXX......",
    ".......XXdddddddddddddddXX......",
    "........XXdddddddddddddXX.......",
    ".........XXdddddddddddXX........",
    "..........XXXXXXXXXXXXX.........",
    "............XXXXXXXXX...........",
    "..............XXXXX.............",
    "................................",
    "................................",
    "................................",
    "................................",
    "................................",
]


def render(size: int) -> list[list[tuple[int, int, int]]]:
    color_map = {
        ".": GB_LIGHTEST,
        "l": GB_LIGHT,
        "d": GB_DARK,
        "X": GB_DARKEST,
    }
    src_h = len(TEMPLATE)
    src_w = len(TEMPLATE[0])
    scale = size // src_w
    extra = size - scale * src_w
    pad_left = extra // 2
    pad_top = (size - scale * src_h) // 2

    pixels: list[list[tuple[int, int, int]]] = [
        [GB_LIGHTEST for _ in range(size)] for _ in range(size)
    ]
    for sy, row in enumerate(TEMPLATE):
        for sx, ch in enumerate(row):
            color = color_map.get(ch, GB_LIGHTEST)
            for dy in range(scale):
                for dx in range(scale):
                    x = pad_left + sx * scale + dx
                    y = pad_top + sy * scale + dy
                    if 0 <= x < size and 0 <= y < size:
                        pixels[y][x] = color
    return pixels


def main() -> None:
    web = Path(__file__).resolve().parent.parent / "web"
    web.mkdir(exist_ok=True)
    for size in (192, 512):
        write_png(web / f"icon-{size}.png", render(size))
        print(f"wrote {web / f'icon-{size}.png'}")


if __name__ == "__main__":
    main()
