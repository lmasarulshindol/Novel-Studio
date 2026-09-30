"""見本用の BGM と SE を生成する。画像ファイルは変更しない。"""
import math
import struct
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "projects" / "sample" / "audio"
RATE = 22050


def write_wav(name: str, samples: list[float]) -> None:
    ROOT.mkdir(parents=True, exist_ok=True)
    frames = bytearray()
    for sample in samples:
        value = max(-1.0, min(1.0, sample))
        frames += struct.pack("<h", int(value * 32767))
    with wave.open(str(ROOT / name), "w") as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(RATE)
        handle.writeframes(frames)


def normalize(samples: list[float], peak: float) -> list[float]:
    loudest = max(abs(sample) for sample in samples) or 1.0
    scale = peak / loudest
    return [sample * scale for sample in samples]


def pad(seconds: float, chord: list[float], volume: float) -> list[float]:
    count = int(RATE * seconds)
    samples = [0.0] * count
    for freq in chord:
        for index in range(count):
            samples[index] += math.sin(2 * math.pi * freq * (index / RATE)) * volume
    return samples


def mix(buffer: list[float], start: int, clip: list[float]) -> None:
    for index, sample in enumerate(clip):
        pos = start + index
        if 0 <= pos < len(buffer):
            buffer[pos] += sample


def pluck(freq: float, seconds: float, volume: float) -> list[float]:
    count = int(RATE * seconds)
    clip = []
    for index in range(count):
        t = index / RATE
        env = math.exp(-t / max(0.05, seconds * 0.55))
        clip.append(math.sin(2 * math.pi * freq * t) * volume * env)
    return clip


def melody(buffer: list[float], notes: list[tuple[float, float]], step: float) -> None:
    cursor = 0
    for freq, beats in notes:
        if freq:
            mix(buffer, cursor, pluck(freq, step * beats * 0.95, 0.22))
        cursor += int(RATE * step * beats)


def loop(seconds: float, chord: list[float], notes: list[tuple[float, float]], step: float, peak: float) -> list[float]:
    buffer = pad(seconds, chord, 0.045)
    melody(buffer, notes, step)
    return normalize(buffer, peak)


def click() -> list[float]:
    count = int(RATE * 0.05)
    return normalize([(math.sin(2 * math.pi * 1400 * (i / RATE)) + (math.sin(i * 12.9898) * 2 - 1) * 0.4) * math.exp(-i / (RATE * 0.012)) for i in range(count)], 0.7)


def appear() -> list[float]:
    first = pluck(784, 0.18, 0.4)
    second = pluck(1176, 0.28, 0.32)
    buffer = [0.0] * (len(first) + len(second))
    mix(buffer, 0, first)
    mix(buffer, int(RATE * 0.08), second)
    return normalize(buffer, 0.65)


def shake() -> list[float]:
    count = int(RATE * 0.32)
    samples = []
    for index in range(count):
        t = index / RATE
        env = math.exp(-t / 0.12)
        rumble = math.sin(2 * math.pi * 70 * t) * 0.7
        grit = (math.sin(index * 0.37) * 2 - 1) * 0.35
        samples.append((rumble + grit) * env)
    return normalize(samples, 0.75)


def main() -> None:
    day = loop(8.0, [262, 330, 392], [
        (523, 1), (659, 1), (784, 1), (659, 1),
        (698, 1), (659, 1), (523, 2),
        (440, 1), (523, 1), (659, 1), (784, 1),
        (880, 1), (784, 1), (659, 2),
    ], 0.5, 0.55)
    dusk = loop(8.0, [196, 247, 294], [
        (392, 2), (370, 1), (330, 1),
        (294, 2), (247, 2),
        (330, 1), (294, 1), (247, 2),
        (220, 4),
    ], 0.5, 0.48)
    night = loop(8.0, [174, 220, 261], [
        (349, 2), (0, 2),
        (330, 2), (0, 2),
        (294, 2), (262, 2),
        (220, 4),
    ], 0.5, 0.4)
    write_wav("day.wav", day)
    write_wav("dusk.wav", dusk)
    write_wav("night.wav", night)
    write_wav("click.wav", click())
    write_wav("appear.wav", appear())
    write_wav("shake.wav", shake())
    print("wrote", ROOT)


if __name__ == "__main__":
    main()
