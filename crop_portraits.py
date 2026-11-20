"""Crop portrait sources to square head-and-shoulders images for the chart.

    python crop_portraits.py              # sources in assets/portraits_src
    python crop_portraits.py <dir> ...    # or other source folders (later ones win)
                                          # (with the editor's crops, assets/portraits_src/crops.json, over CROPS)
    python crop_portraits.py --set tokugawa   # another chart's set: assets/portraits_src/tokugawa/crops.json
                                              # (the same (x, y, side) by id, plus "contrast": [ids]),
                                              # written to assets/portraits/tokugawa/

CROPS maps chart id -> (face_x, face_y, side): face centre as fractions of the image
width / height, square side as a fraction of the width. Most photographs are framed alike: the
face (as found by a face detector) about half the square wide and centred, its middle half way
down; paintings, drawings and poor detections are framed by hand. Credits: the media records in charts/wangsa-mataram/chart.json
(mn1–mn10 come from the original Wangsa Mataram.pptx draft).
"""
import os
import sys

from PIL import Image, ImageOps

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, "assets/portraits_src")
OUT = os.path.join(ROOT, "assets/portraits")
SIZE = 400
HEADROOM = 0.42   # share of the square above the face centre
EXTS = (".jpg", ".jpeg", ".png", ".webp")

CROPS = {
    # Mataram
    "senapati": (0.50, 0.30, 0.85),
    "ancilla": (0.507, 0.21, 0.321), "anglingkusumo": (0.502, 0.207, 0.464), "gkrpb": (0.57, 0.287, 0.245),
    "hb1": (0.55, 0.20, 0.45), "pa4": (0.642, 0.106, 0.787), "pa6": (0.50, 0.23, 0.85),
    "paundrakarna": (0.50, 0.42, 0.56), "agung": (0.45, 0.30, 0.75), "am2": (0.4, 0.17, 0.3),
    "am3": (0.25, 0.36, 0.26), "pb1": (0.50, 0.48, 0.75), "pb2": (0.50, 0.45, 0.75),
    # Surakarta
    "pb3": (0.55, 0.50, 0.95), "pb4": (0.50, 0.47, 0.60), "pb5": (0.48, 0.50, 0.90), "pb6": (0.50, 0.50, 0.60),
    "pb7": (0.545, 0.426, 0.489), "pb8": (0.516, 0.24, 0.45), "pb9": (0.412, 0.232, 0.254), "pb10": (0.51, 0.255, 0.414),
    "pb11": (0.46, 0.25, 0.75), "pb12": (0.512, 0.228, 0.393), "pb13": (0.511, 0.199, 0.414), "pb14h": (0.474, 0.395, 0.401),
    "pb14p": (0.515, 0.255, 0.514), "hemas_pb10": (0.482, 0.15, 0.313), "moeng": (0.465, 0.392, 0.859),
    "tedjowulan": (0.46, 0.25, 0.29), "mooryati": (0.498, 0.21, 0.521),
    # Yogyakarta
    "hb2": (0.5, 0.37, 0.56), "hb3": (0.5, 0.24, 0.68), "hb4": (0.47, 0.42, 0.55), "hb5": (0.419, 0.434, 0.627),
    "hb6": (0.506, 0.211, 0.238), "hb7": (0.541, 0.221, 0.233), "hb8": (0.557, 0.194, 0.225), "hb9": (0.48, 0.38, 0.80),
    "hb10": (0.50, 0.40, 0.80), "hemas_hb10": (0.50, 0.20, 0.75), "mangkubumi": (0.436, 0.234, 0.856),
    "diponegoro": (0.521, 0.206, 0.434),
    # Pakualaman
    "pa2": (0.512, 0.186, 0.515), "pa3": (0.377, 0.226, 0.273), "pa5": (0.622, 0.2, 0.304), "pa7": (0.495, 0.21, 0.14),
    "pa8": (0.497, 0.228, 0.464), "pa9": (0.47, 0.38, 0.75), "pa10": (0.48, 0.33, 0.75), "bimantoro": (0.5, 0.27, 0.85),
    "notosoeroto": (0.46, 0.33, 0.8), "nyihajar": (0.5, 0.36, 0.8), "suryopranoto": (0.55, 0.45, 0.95),
    "kihajar": (0.45, 0.40, 0.95), "retnopuwoso": (0.352, 0.284, 0.254), "wiroyudho": (0.335, 0.225, 0.125),
    # Mangkunegaran
    "mn1": (0.433, 0.338, 0.662), "mn2": (0.494, 0.267, 0.587), "mn3": (0.424, 0.187, 0.675), "mn4": (0.459, 0.297, 0.322),
    "mn5": (0.409, 0.22, 0.668), "mn6": (0.419, 0.261, 0.777), "mn7": (0.621, 0.391, 1.076), "mn8": (0.522, 0.311, 0.998),
    "mn9": (0.52, 0.33, 0.95), "mn10": (0.567, 0.191, 0.464), "timur": (0.539, 0.268, 0.651), "nurul": (0.556, 0.282, 0.639),
    "kyaimaja": (0.496, 0.221, 0.564), "condrokirono": (0.602, 0.193, 0.554), "maduretno": (0.54, 0.198, 0.676),
    "hayu": (0.435, 0.296, 0.972), "bendara2": (0.43, 0.2, 0.8),
    # outside the dynasty
    "hoesein": (0.5, 0.3, 0.9), "djatikusumo": (0.52, 0.27, 0.75), "haryomataram": (0.5, 0.4, 0.85),
    "surapati": (0.5, 0.4, 0.75),
    "sentot": (0.45, 0.24, 0.62), "butet": (0.498, 0.212, 0.847),
    "sukarno": (0.534, 0.288, 1.136), "sukmawati": (0.622, 0.379, 1.223), "tien": (0.493, 0.334, 1.042),
    "suharto": (0.56, 0.332, 0.862), "titiek": (0.517, 0.277, 1.077), "prabowo": (0.598, 0.28, 0.821),
}
SOURCE_NAME = {}   # chart id -> source file name, when they differ
CONTRAST = {"pa2", "mn4"}                       # faded photographs: stretch the tones


def sources(dirs):
    files = {}
    for d in dirs:
        for f in sorted(os.listdir(d)):
            stem, ext = os.path.splitext(f)
            if ext.lower() in EXTS:
                if stem in files and os.path.normpath(os.path.dirname(files[stem])) == d:
                    print(f"  note: {stem} has several files in {d}; using {os.path.basename(files[stem])}")
                    continue
                files[stem] = os.path.join(d, f)
    return files


def load_rgb(path):
    with Image.open(path) as im:
        im = ImageOps.exif_transpose(im)
        if im.mode in ("RGBA", "LA", "P"):
            im = im.convert("RGBA")
            flat = Image.new("RGB", im.size, "white")
            flat.paste(im, mask=im.split()[-1])
            return flat
        return im.convert("RGB")


def main(dirs, crops=CROPS, out_dir=OUT, contrast=CONTRAST):
    missing = [d for d in dirs if not os.path.isdir(d)]
    if missing:
        sys.exit(f"source folder not found: {', '.join(missing)}")
    dirs = [os.path.normpath(d) for d in dirs]
    os.makedirs(out_dir, exist_ok=True)
    files = sources(dirs)
    done = 0
    for id_, (fx, fy, fs) in crops.items():
        path = files.get(SOURCE_NAME.get(id_, id_))
        if not path:
            print(f"  skip {id_}: no source file")
            continue
        im = load_rgb(path)
        w, h = im.size
        s = min(fs * w, w, h)
        x0 = min(max(fx * w - s / 2, 0), w - s)
        y0 = min(max(fy * h - HEADROOM * s, 0), h - s)
        out = im.crop((round(x0), round(y0), round(x0 + s), round(y0 + s))).resize((SIZE, SIZE), Image.LANCZOS)
        if id_ in contrast:
            out = ImageOps.autocontrast(out, cutoff=1)
        out.save(os.path.join(out_dir, id_ + ".jpg"), quality=90)
        done += 1
    print(f"cropped {done} of {len(crops)}")


def main_set(name):
    import json
    src = os.path.join(SRC, name)
    with open(os.path.join(src, "crops.json"), encoding="utf-8") as f:
        spec = json.load(f)
    main([src], {k: tuple(v) for k, v in spec["crops"].items()}, os.path.join(OUT, name), set(spec.get("contrast", [])))


def editor_crops():
    """crops made in the editor for the main set (assets/portraits_src/crops.json): they win over CROPS"""
    import json
    path = os.path.join(SRC, "crops.json")
    if not os.path.exists(path):
        return CROPS, CONTRAST
    with open(path, encoding="utf-8") as f:
        spec = json.load(f)
    return {**CROPS, **{k: tuple(v) for k, v in spec.get("crops", {}).items()}}, CONTRAST | set(spec.get("contrast", []))


if __name__ == "__main__":
    if sys.argv[1:2] == ["--set"]:
        main_set(sys.argv[2])
    elif sys.argv[1:]:
        main(sys.argv[1:])
    else:
        crops, contrast = editor_crops()
        main([SRC], crops, OUT, contrast)
