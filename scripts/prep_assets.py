import sys, os
from PIL import Image
SRC = sys.argv[1]; OUT = sys.argv[2]
def save(im, name, h=None, w=None, q=88):
    im = im.convert('RGBA')
    bbox = im.getbbox(); im = im.crop(bbox)
    if h and im.height > h: im = im.resize((round(im.width*h/im.height), h), Image.LANCZOS)
    if w and im.width > w: im = im.resize((w, round(im.height*w/im.width)), Image.LANCZOS)
    p = os.path.join(OUT, name); im.save(p, 'WEBP', quality=q, method=6)
    print(name, im.size, os.path.getsize(p))
g = lambda f: Image.open(os.path.join(SRC, f))
save(g('header_atri.png'), 'atri_wave.webp', h=480)
save(g('clear_atri.png'), 'atri_happy.webp', h=420)
save(g('miss_atri.png'), 'atri_cry.webp', h=360)
save(g('crab.png'), 'crab.webp', h=160)
# sprite sheet: 2 cols x 4 rows, 600x600 cells
sheet = g('atri_anim_big.png').convert('RGBA')
def cell(c, r): return sheet.crop((c*600, r*600, c*600+600, r*600+600))
def strip(cells, name, size):
    # common bbox over frames so they align
    boxes = [x.getbbox() for x in cells]
    bb = (min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes))
    fr = [x.crop(bb) for x in cells]
    fw, fh = fr[0].size
    sc = size / fh
    fw2, fh2 = round(fw*sc), size
    out = Image.new('RGBA', (fw2*len(fr), fh2))
    for i, x in enumerate(fr): out.paste(x.resize((fw2, fh2), Image.LANCZOS), (i*fw2, 0))
    p = os.path.join(OUT, name); out.save(p, 'WEBP', quality=88, method=6)
    print(name, out.size, 'frame', (fw2, fh2), os.path.getsize(p))
strip([cell(0,3), cell(1,3)], 'swim_strip.webp', 180)
strip([cell(0,0), cell(1,0)], 'walk_strip.webp', 200)
# header town strip: drop the semi-transparent edge columns and crossfade the ends so it tiles seamlessly
src = g('header_bg.webp').convert('RGB'); w, h = src.size
im = src.crop((2, 0, w - 2, h)); W = im.width; B = 90
town = im.crop((0, 0, W - B, h)).copy()
for x in range(B):
    town.paste(Image.blend(im.crop((W - B + x, 0, W - B + x + 1, h)), im.crop((x, 0, x + 1, h)), x / B), (x, 0))
town.save(os.path.join(OUT, 'town.webp'), 'WEBP', quality=86, method=6); print('town', town.size)
# round head icon for the header / admin menu
wave = Image.open(os.path.join(OUT, 'atri_wave.webp')).convert('RGBA')
wave.crop((170, 0, 370, 200)).resize((160, 160), Image.LANCZOS).save(os.path.join(OUT, 'atri_head.webp'), 'WEBP', quality=90)
# rocket-punch pose and the 2-frame "sinking" flail (with bubbles) from the sprite sheet
save(cell(0, 1), 'atri_punch.webp', h=300)
strip([cell(0, 2), cell(1, 2)], 'sink_strip.webp', 200)
# treasure-get panels: wooden planks with a transparent window (theme colour shows through)
tre = g('treasure_get_anim.png').convert('RGBA')
for name, (fx, fy) in {'treasure_peek.webp': (1060, 0), 'treasure_cheer.webp': (1060, 600)}.items():
    fr = tre.crop((fx, fy + 28, fx + 1060, fy + 538)).resize((560, 269), Image.LANCZOS)
    fr.save(os.path.join(OUT, name), 'WEBP', quality=86, method=6)
    print(name, fr.size, os.path.getsize(os.path.join(OUT, name)))
