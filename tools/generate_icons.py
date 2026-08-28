"""Génère les icônes PWA MonRéseau (badge léopard d'Abomey).

Usage:
    python tools/generate_icons.py

Produit static/icons/icon-192.png et static/icons/icon-512.png,
avec une vignette SVG assortie (static/icons/icon-192.svg).
"""
from pathlib import Path

from PIL import Image, ImageDraw

# Palette Terre d'Abomey
BORDEAUX = '#7B2D26'
BORDEAUX_DARK = '#5E1F1B'
BORDEAUX_DEEP = '#471713'
GOLD = '#C99A3C'
GOLD_LIGHT = '#E8C66A'
CREAM = '#FAF3E6'

ROOT = Path(__file__).resolve().parent.parent
ICONS = ROOT / 'static' / 'icons'


def make_icon(size: int) -> Image.Image:
    """Dessine le badge léopard sur fond bordeaux à la taille demandée."""
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    s = size / 48.0  # on travaille dans un repère 48x48 puis on met à l'échelle

    def rr(x0, y0, x1, y1, r, **kw):
        d.rounded_rectangle([x0 * s, y0 * s, x1 * s, y1 * s], radius=r * s, **kw)

    def poly(points, fill):
        d.polygon([(x * s, y * s) for x, y in points], fill=fill)

    def ellipse(cx, cy, rx, ry, fill):
        d.ellipse([(cx - rx) * s, (cy - ry) * s, (cx + rx) * s, (cy + ry) * s], fill=fill)

    def circle(cx, cy, r, fill):
        d.ellipse([(cx - r) * s, (cy - r) * s, (cx + r) * s, (cy + r) * s], fill=fill)

    # --- Fond du badge : dégradé bordeaux approximé (couches successives) ---
    rr(0, 0, 48, 48, 12, fill=BORDEAUX_DARK)
    rr(0, 0, 48, 48, 12, fill=BORDEAUX)
    # Voile plus clair en haut à gauche pour un effet de lumière
    highlight = Image.new('RGBA', img.size, (0, 0, 0, 0))
    hd = ImageDraw.Draw(highlight)
    hd.rounded_rectangle([0, 0, 48 * s, 48 * s], radius=12 * s, fill=(200, 120, 105, 70))
    img = Image.alpha_composite(img, highlight)
    d = ImageDraw.Draw(img)

    # --- Liseré appliqué (bordure brodée d'or) + cornes ---
    d.rounded_rectangle([3 * s, 3 * s, 45 * s, 45 * s], radius=9 * s,
                        outline=GOLD, width=max(1, round(1.4 * s)))
    for cx, cy in [(8, 8), (40, 8), (8, 40), (40, 40)]:
        circle(cx, cy, 1.3, GOLD_LIGHT)

    # --- Léopard ---
    # Oreilles
    poly([(13, 15), (7, 4), (19, 10)], GOLD)
    poly([(35, 15), (41, 4), (29, 10)], GOLD)
    poly([(13, 13), (10, 7), (16, 10)], BORDEAUX_DARK)
    poly([(35, 13), (38, 7), (32, 10)], BORDEAUX_DARK)

    # Tête
    ellipse(24, 24.5, 12.5, 13.5, GOLD)

    # Taches du pelage
    for cx, cy, r in [(17.5, 18.5, 1.5), (24, 15, 1.5), (30.5, 18.5, 1.5),
                      (14.5, 26, 1.3), (33.5, 26, 1.3),
                      (16.5, 32.5, 1.1), (31.5, 32.5, 1.1)]:
        circle(cx, cy, r, BORDEAUX)

    # Yeux
    ellipse(18.6, 23, 1.9, 2.5, BORDEAUX_DEEP)
    ellipse(29.4, 23, 1.9, 2.5, BORDEAUX_DEEP)
    circle(19.2, 22.2, 0.7, GOLD_LIGHT)
    circle(30.0, 22.2, 0.7, GOLD_LIGHT)

    # Museau
    ellipse(24, 30, 3.8, 3.2, GOLD_LIGHT)
    poly([(22.1, 30.4), (24, 28.9), (25.9, 30.4), (25, 32), (23, 32)], BORDEAUX_DEEP)

    # Points de moustaches
    for cx, cy in [(20.6, 34.6), (27.4, 34.6), (18.8, 36.4), (29.2, 36.4)]:
        circle(cx, cy, 0.6, BORDEAUX_DEEP)

    return img


def make_svg(size: int = 192) -> str:
    """Vignette SVG simple (fond bordeaux + M doré) pour les outils sans PNG."""
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" viewBox="0 0 {size} {size}">'
        f'<rect width="{size}" height="{size}" rx="{size * 0.17}" fill="{BORDEAUX}"/>'
        f'<circle cx="{size * 0.5}" cy="{size * 0.62}" r="{size * 0.30}" fill="{GOLD}"/>'
        f'<circle cx="{size * 0.5}" cy="{size * 0.62}" r="{size * 0.18}" fill="{BORDEAUX_DEEP}"/>'
        f'</svg>'
    )


def main() -> None:
    ICONS.mkdir(parents=True, exist_ok=True)
    for size in (192, 512):
        icon = make_icon(size)
        out = ICONS / f'icon-{size}.png'
        icon.save(out)
        print(f'OK  {out}  ({out.stat().st_size} octets)')

    # La vignette SVG sert de fallback/représentation (non référencée par le manifest)
    (ICONS / 'icon-192.svg').write_text(make_svg(), encoding='utf-8')
    print('OK  static/icons/icon-192.svg')


if __name__ == '__main__':
    main()
