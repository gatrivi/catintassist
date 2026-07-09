"""One-shot: recolor CatIntAssist logo for dark theme + export icon sizes."""
from __future__ import annotations

import colorsys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "public" / "catintassist-logo-source.png"
PUBLIC = ROOT / "public"

# App palette (index.css + manifest theme)
INK = (226, 232, 240)       # --text-main #e2e8f0
ACCENT = (168, 85, 247)     # header hint purple #a855f7
BG_ALPHA_CUTOFF = 0.94  # legacy — kept for doc parity


def _rgb_to_hsl(r: int, g: int, b: int) -> tuple[float, float, float]:
    h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
    return h * 360, s, l


def _remap_pixel(r: int, g: int, b: int, a: int) -> tuple[int, int, int, int]:
    h, s, l = _rgb_to_hsl(r, g, b)

    if r > 228 and g > 228 and b > 228:
        return (2, 6, 23, 0)
    if l >= 0.86 and s < 0.14:
        return (2, 6, 23, 0)

    if 230 <= h <= 290 and s > 0.22 and l > 0.28:
        t = min(1.0, max(0.0, (s - 0.22) / 0.5))
        out = tuple(int(INK[i] + (ACCENT[i] - INK[i]) * t) for i in range(3))
        return (*out, 255)

    if 200 <= h <= 260 and l < 0.52 and s > 0.12:
        return (*INK, 255)

    if s < 0.1 or l > 0.72:
        return (2, 6, 23, 0)

    mix = min(1.0, max(0.0, (h - 210) / 70))
    out = tuple(int(INK[i] + (ACCENT[i] - INK[i]) * mix) for i in range(3))
    return (*out, 255)


def _alpha_bbox(img: Image.Image, pad: int = 12) -> tuple[int, int, int, int]:
    w, h = img.size
    xs, ys = [], []
    for y in range(h):
        for x in range(w):
            if img.getpixel((x, y))[3] > 40:
                xs.append(x)
                ys.append(y)
    if not xs:
        return 0, 0, w, h
    left, right = max(0, min(xs) - pad), min(w, max(xs) + pad)
    top, bottom = max(0, min(ys) - pad), min(h, max(ys) + pad)
    return left, top, right, bottom


def recolor(img: Image.Image) -> Image.Image:
    src = img.convert("RGBA")
    out = Image.new("RGBA", src.size)
    px = out.load()
    for y in range(src.height):
        for x in range(src.width):
            px[x, y] = _remap_pixel(*src.getpixel((x, y)))
    return out


def crop_cat_mark(img: Image.Image) -> Image.Image:
    w, _ = img.size
    head = img.crop((0, 150, w, 640))
    box = _alpha_bbox(head, pad=16)
    crop = head.crop(box)
    cw, ch = crop.size
    side = max(cw, ch)
    square = Image.new("RGBA", (side, side), (2, 6, 23, 0))
    square.paste(crop, ((side - cw) // 2, (side - ch) // 2))
    return square


def save_png(path: Path, img: Image.Image, size: int | None = None) -> None:
    out = img if size is None else img.resize((size, size), Image.Resampling.LANCZOS)
    out.save(path, format="PNG", optimize=True)


def save_ico(path: Path, img: Image.Image) -> None:
    sizes = [16, 32, 48, 64, 128, 256]
    frames = [img.resize((s, s), Image.Resampling.LANCZOS) for s in sizes]
    frames[0].save(
        path,
        format="ICO",
        sizes=[(s, s) for s in sizes],
        append_images=frames[1:],
    )


def save_favicon_svg(path: Path, png_path: Path) -> None:
    import base64

    data = base64.b64encode(png_path.read_bytes()).decode("ascii")
    svg = (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">'
        f'<image href="data:image/png;base64,{data}" width="512" height="512"/>'
        "</svg>"
    )
    path.write_text(svg, encoding="utf-8")


def main() -> None:
    if not SRC.exists():
        raise SystemExit(f"Missing source image: {SRC}")

    raw = Image.open(SRC)
    full = recolor(raw)
    mark = crop_cat_mark(full)

    save_png(PUBLIC / "catintassist-logo.png", full)
    save_png(PUBLIC / "catintassist-icon.png", mark)

    for size, name in [
        (96, "favicon-96x96.png"),
        (192, "favicon-192x192.png"),
        (512, "favicon-512x512.png"),
        (180, "apple-touch-icon.png"),
    ]:
        save_png(PUBLIC / name, mark, size)

    save_ico(PUBLIC / "favicon.ico", mark)
    save_favicon_svg(PUBLIC / "favicon.svg", PUBLIC / "favicon-512x512.png")

    print("Wrote icons to", PUBLIC)


if __name__ == "__main__":
    main()
