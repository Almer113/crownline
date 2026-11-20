"""Make the white background of an emblem transparent.

    python clean_emblem.py assets/emblems/mangkualaman.jpg assets/emblems/mangkualaman.png

Every near-white pixel is background, including the white enclosed between the wreath and the
seal, which a flood fill from the edges would miss (the Mangkualaman emblem has no white of its
own). Along the edges the white is "un-mixed" from the anti-aliased pixels (colour to alpha), so
the emblem fades out cleanly instead of keeping a pale fringe; pixels away from the background
are left exactly as they are.
"""
import sys

import numpy as np
from PIL import Image, ImageFilter

WHITE = 236      # a pixel whose darkest channel is above this is background
EDGE = 2         # px around the background in which colours are un-mixed from white
UPSCALE = 2      # the source is small; enlarge before cleaning so the edges stay smooth


def main(src, dst):
    im = Image.open(src).convert("RGB")
    im = im.resize((im.width * UPSCALE, im.height * UPSCALE), Image.LANCZOS)
    a = np.asarray(im).astype(float)
    bg = a.min(axis=2) > WHITE
    mask = Image.fromarray((bg * 255).astype(np.uint8))
    edge = np.asarray(mask.filter(ImageFilter.MaxFilter(2 * EDGE * UPSCALE + 1))) > 0
    # colour to alpha against white: the least alpha that explains the pixel over white
    alpha = ((255 - a).max(axis=2) / 255).clip(1e-3, 1)
    unmixed = 255 - (255 - a) / alpha[..., None]
    rgb = np.where(edge[..., None], unmixed, a)
    al = np.where(edge, alpha, 1.0)
    al[bg] = 0
    out = np.dstack([rgb.clip(0, 255), al[..., None] * 255]).round().astype(np.uint8)
    Image.fromarray(out, "RGBA").save(dst)
    print(f"wrote {dst} ({out.shape[1]} x {out.shape[0]}), {bg.mean():.0%} background")


if __name__ == "__main__":
    main(*sys.argv[1:3])
