"""Erzeugt die App-Icons (PNG + SVG). Aufruf: python tools/make_icons.py"""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent / "icons"
ROOT.mkdir(exist_ok=True)

NAVY = (0, 31, 63)
RED = (255, 65, 54)
ORANGE = (255, 133, 27)
WHITE = (244, 247, 251)

# Figur in 512er-Koordinaten: Ausfallschritt mit Armen nach oben
HEAD = (256, 148, 30)
LINES = [
    [(256, 196), (256, 300)],               # Rumpf
    [(256, 212), (196, 160), (176, 104)],   # Arm links
    [(256, 212), (316, 160), (336, 104)],   # Arm rechts
    [(256, 300), (330, 322), (334, 398)],   # vorderes Bein
    [(256, 300), (204, 352), (146, 384)],   # hinteres Bein
]
STROKE = 30


def render(size, pad_scale=1.0, rounded=False):
    s = 4  # Supersampling
    W = 512 * s
    img = Image.new("RGBA", (W, W), NAVY + (255,))
    # Verlaufskreis
    grad = Image.new("RGBA", (W, W))
    # diagonaler Verlauf
    px = grad.load()
    for y in range(0, W, 2):
        for x in range(0, W, 2):
            t = (x + y) / (2 * (W - 1))
            c = tuple(round(RED[k] + (ORANGE[k] - RED[k]) * t) for k in range(3)) + (255,)
            px[x, y] = c
            if x + 1 < W: px[x + 1, y] = c
            if y + 1 < W:
                px[x, y + 1] = c
                if x + 1 < W: px[x + 1, y + 1] = c
    mask = Image.new("L", (W, W), 0)
    r = 196 * pad_scale * s
    c0 = W / 2
    ImageDraw.Draw(mask).ellipse([c0 - r, c0 - r, c0 + r, c0 + r], fill=255)
    img.paste(grad, (0, 0), mask)

    d = ImageDraw.Draw(img)

    def P(p):
        x, y = p
        return (c0 + (x - 256) * pad_scale * s, c0 + (y - 256) * pad_scale * s)

    w = STROKE * pad_scale * s
    for line in LINES:
        pts = [P(p) for p in line]
        d.line(pts, fill=WHITE, width=round(w), joint="curve")
        for (x, y) in pts:
            d.ellipse([x - w / 2, y - w / 2, x + w / 2, y + w / 2], fill=WHITE)
    hx, hy = P(HEAD[:2])
    hr = HEAD[2] * pad_scale * s
    d.ellipse([hx - hr, hy - hr, hx + hr, hy + hr], fill=WHITE)

    if rounded:
        m = Image.new("L", (W, W), 0)
        ImageDraw.Draw(m).rounded_rectangle([0, 0, W, W], radius=W * 0.22, fill=255)
        out = Image.new("RGBA", (W, W), (0, 0, 0, 0))
        out.paste(img, (0, 0), m)
        img = out
    return img.resize((size, size), Image.LANCZOS)


render(192).save(ROOT / "icon-192.png")
render(512).save(ROOT / "icon-512.png")
render(512, pad_scale=0.78).save(ROOT / "icon-maskable-512.png")
render(180).convert("RGB").save(ROOT / "apple-touch-icon.png")
render(64, rounded=True).save(ROOT / "favicon-64.png")

# SVG-Variante
def svg():
    paths = "".join(
        f'<polyline points="{" ".join(f"{x},{y}" for x, y in line)}"/>' for line in LINES
    )
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FF4136"/><stop offset="1" stop-color="#FF851B"/></linearGradient></defs>
<rect width="512" height="512" rx="112" fill="#001f3f"/>
<circle cx="256" cy="256" r="196" fill="url(#g)"/>
<g fill="none" stroke="#F4F7FB" stroke-width="{STROKE}" stroke-linecap="round" stroke-linejoin="round">{paths}</g>
<circle cx="{HEAD[0]}" cy="{HEAD[1]}" r="{HEAD[2]}" fill="#F4F7FB"/>
</svg>
'''

(ROOT / "icon.svg").write_text(svg(), encoding="utf-8")
print("Icons erzeugt in", ROOT)
