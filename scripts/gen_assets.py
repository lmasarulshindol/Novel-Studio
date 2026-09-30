"""見本用の透過立ち絵、背景、ロゴ、短い音声を生成する。"""
import math
import struct
import wave
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "projects" / "sample"


def chunk(tag: bytes, data: bytes) -> bytes:
    crc = zlib.crc32(tag + data) & 0xFFFFFFFF
    return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", crc)


def write_png(path: Path, width: int, height: int, pixels: bytearray) -> None:
    raw = bytearray()
    stride = width * 4
    for y in range(height):
        raw.append(0)
        raw.extend(pixels[y * stride:(y + 1) * stride])
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(bytes(raw), 9)) + chunk(b"IEND", b"")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(png)


def lerp(a: int, b: int, t: float) -> int:
    return int(a + (b - a) * t)


def mix(a: tuple[int, int, int], b: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    return tuple(lerp(a[i], b[i], t) for i in range(3))


def paint_bg(mode: str) -> tuple[bytearray, int, int]:
    width, height = 960, 540
    pixels = bytearray(width * height * 4)
    if mode == "day":
        top, bottom, ground = (120, 186, 232), (232, 244, 250), (92, 140, 96)
        window = (255, 244, 210)
    elif mode == "dusk":
        top, bottom, ground = (92, 58, 96), (232, 132, 78), (62, 72, 64)
        window = (255, 196, 120)
    else:
        top, bottom, ground = (10, 16, 40), (28, 42, 78), (24, 36, 34)
        window = (255, 214, 120)
    horizon = int(height * 0.62)
    for y in range(height):
        for x in range(width):
            if y < horizon:
                color = mix(top, bottom, y / horizon)
            else:
                shade = 0.85 + 0.15 * ((x * 3 + y) % 11) / 11
                color = tuple(int(c * shade) for c in ground)
            hill = horizon + int(math.sin(x / 70) * 18 + math.sin(x / 23) * 6)
            if y > hill and y < horizon + 30:
                color = mix(color, (70, 110, 72) if mode != "night" else (18, 32, 36), 0.45)
            building = 80 < x < 880 and horizon - 150 < y < horizon + 8
            if building and (x // 140) % 2 == 0 and 160 < x < 800:
                color = (214, 206, 196) if mode == "day" else (86, 72, 78) if mode == "dusk" else (32, 36, 52)
                wx, wy = (x - 160) % 70, (y - (horizon - 140)) % 48
                if 18 < wx < 42 and 12 < wy < 32:
                    color = window if mode != "day" or (x + y) % 5 else (186, 214, 228)
            i = (y * width + x) * 4
            pixels[i:i + 4] = bytes((*color, 255))
    return pixels, width, height


def paint_logo() -> tuple[bytearray, int, int]:
    width, height = 520, 180
    pixels = bytearray(width * height * 4)
    for y in range(height):
        for x in range(width):
            dx = max(18 - x, x - (width - 18), 0)
            dy = max(18 - y, y - (height - 18), 0)
            outside = dx * dx + dy * dy > 18 * 18 and (x < 18 or x > width - 18 or y < 18 or y > height - 18)
            if outside:
                continue
            color = (196, 92, 38, 255)
            cx, cy = width // 2, height // 2 + 4
            if abs(x - cx) + abs(y - cy) * 1.4 < 46:
                color = (243, 230, 200, 255)
            i = (y * width + x) * 4
            pixels[i:i + 4] = bytes(color)
    return pixels, width, height


def paint_char(expr: str) -> tuple[bytearray, int, int]:
    width, height = 360, 640
    pixels = bytearray(width * height * 4)
    cx = width // 2
    hair = (58, 42, 40, 255)
    skin = (242, 199, 176, 255)
    dress = (212, 83, 126, 255) if expr == "smile" else (150, 104, 132, 255)
    eye = (42, 36, 34, 255)
    blush = (240, 140, 156, 180)
    for y in range(height):
        for x in range(width):
            color = None
            body_t = (y - 250) / 360
            if 250 <= y <= 620:
                half = 46 + body_t * 78
                if abs(x - cx) <= half:
                    color = dress
            dx = (x - cx) / 78
            dy = (y - 168) / 96
            if dx * dx + dy * dy <= 1:
                color = hair
            fx = (x - cx) / 62
            fy = (y - 188) / 74
            if fx * fx + fy * fy <= 1:
                color = skin
            if expr == "smile":
                for ex in (cx - 22, cx + 22):
                    if (x - ex) ** 2 / 36 + (y - 186) ** 2 / 20 <= 1:
                        color = eye
                if (x - cx) ** 2 / 80 + (y - 214) ** 2 / 16 <= 1 and y > 214:
                    color = (196, 92, 104, 255)
            else:
                for ex in (cx - 20, cx + 20):
                    if (x - ex) ** 2 / 28 + (y - 188) ** 2 / 14 <= 1:
                        color = eye
                if (x - (cx - 34)) ** 2 / 50 + (y - 204) ** 2 / 24 <= 1 or (x - (cx + 34)) ** 2 / 50 + (y - 204) ** 2 / 24 <= 1:
                    color = blush
                if abs(x - cx) < 10 and 210 < y < 214:
                    color = (180, 100, 112, 255)
            if color:
                i = (y * width + x) * 4
                pixels[i:i + 4] = bytes(color)
    return pixels, width, height


def write_wav(path: Path, frames: bytes, rate: int = 22050) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "w") as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(rate)
        handle.writeframes(frames)


def synth_bgm() -> bytes:
    rate = 22050
    seconds = 4
    notes = [262, 330, 392, 494]
    data = bytearray()
    total = rate * seconds
    for i in range(total):
        env = min(1, i / 400) * min(1, (total - i) / 800)
        tone = 0
        step = (i * 4) // rate
        freq = notes[step % len(notes)]
        tone += math.sin(2 * math.pi * freq * i / rate) * 0.35
        tone += math.sin(2 * math.pi * (freq / 2) * i / rate) * 0.2
        sample = int(max(-1, min(1, tone * env)) * 12000)
        data += struct.pack("<h", sample)
    return bytes(data)


def synth_click() -> bytes:
    rate = 22050
    total = int(rate * 0.18)
    data = bytearray()
    for i in range(total):
        env = math.exp(-i / (rate * 0.04))
        sample = int(math.sin(2 * math.pi * 880 * i / rate) * env * 16000)
        data += struct.pack("<h", sample)
    return bytes(data)


def main() -> None:
    for mode in ("day", "dusk", "night"):
        pixels, width, height = paint_bg(mode)
        write_png(ROOT / "backgrounds" / f"classroom_{mode}.png", width, height, pixels)
    for expr in ("smile", "shy"):
        pixels, width, height = paint_char(expr)
        write_png(ROOT / "chars" / f"mitsuki_{expr}.png", width, height, pixels)
    pixels, width, height = paint_logo()
    write_png(ROOT / "ui" / "logo.png", width, height, pixels)
    write_wav(ROOT / "audio" / "daily.wav", synth_bgm())
    write_wav(ROOT / "audio" / "click.wav", synth_click())
    print("assets written", ROOT)


if __name__ == "__main__":
    main()
