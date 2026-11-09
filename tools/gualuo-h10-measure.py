"""H10 挂落 (四时潇洒亭 月洞门挂落1, 建施20 P22, 1:10) — measure & rebuild.

Pipeline
  1. binarise the 1:10 elevation, erase the two annotation leaders and the
     "芯子15X30" text;
  2. flood-fill the background, label enclosed regions, keep the thin ones
     (erosion depth <= 10 px) -> that is the solid 格心, already 15 mm wide;
  3. re-derive the member sticks from their drawn edge pairs (intersection of
     the two edge spans), snap to the annotated lattice, and cross-check the
     snapped model against the pixel mask (IoU + per-edge deviation);
  4. emit the normalized coordinate table + an overlay of the sticks drawn back
     onto the scan + an orthographic 白模 view.

Everything is PIL + stdlib; no numpy, no browser.
"""
import json
import os
from collections import deque
from PIL import Image, ImageDraw, ImageFilter, ImageFont

SRC = 'out/reference/H-挂落正式图纸/H10_四时潇洒亭_月洞门挂落1_3190_建施20_P22.png'
OUT = 'out/gualuo/H10'

X0, Y0 = 211.0, 190.0            # px of (x=0, y=0)  = 梃 outer face / 上枋 top line
S = 0.87648                      # px per mm, from 3190/2 = 1595 spanning 211..1609
W_TOTAL, H_TOTAL = 3190.0, 510.0
HALF = 1595.0
AXIS_PX = 1609.0

ROI = (200, 186, 1616, 648)      # whole hanging panel; sticks are filtered below
CORE = (246, 227, 1606, 537)     # 格心 only: 梃 / 上枋 / 收头 come from annotations

ROW0 = 40.0                      # 上枋 inner face
ROWS = [40.0 + 70.0 * k for k in range(6)]      # 40 110 180 250 320 390
COL_PITCH = (HALF - ROW0) / 13.0                # 1555 / 13 = 119.615
COLS = [ROW0 + COL_PITCH * k for k in range(1, 14)]   # 159.6 .. 1595.0

ERASE = [                        # annotation furniture (px, inclusive)
    (694, 186, 714, 200),        # 梃40X60 leader stub
    (688, 512, 980, 600),        # 芯子15X30 text + leader
    (690, 96, 980, 132),         # 梃40X60 label above the drawing
]

def log(*a):
    print(*a)

# ---------------------------------------------------------------- pixel stage
def load():
    im = Image.open(SRC).convert('L')
    W, H = im.size
    px = im.load()
    dark = [[False] * W for _ in range(H)]
    for y in range(H):
        for x in range(W):
            if px[x, y] < 140:
                dark[y][x] = True
    for (a, b, c, d) in ERASE:
        for y in range(b, d + 1):
            for x in range(a, c + 1):
                dark[y][x] = False
    return dark, W, H

def dilate(m, W, H, r=1):
    out = [[False] * W for _ in range(H)]
    for y in range(H):
        for x in range(W):
            if m[y][x]:
                for yy in range(max(0, y - r), min(H, y + r + 1)):
                    row = out[yy]
                    for xx in range(max(0, x - r), min(W, x + r + 1)):
                        row[xx] = True
    return out

def enclosed_solid(m, W, H, box):
    """thin enclosed regions = the 15 mm 芯子 solids."""
    x0, y0, x1, y1 = box
    md = dilate(m, W, H, 1)
    lab = [[-1] * W for _ in range(H)]
    solid = [[False] * W for _ in range(H)]
    stats = []
    for y in range(y0, y1):
        for x in range(x0, x1):
            if md[y][x] or lab[y][x] >= 0:
                continue
            idx = len(lab)
            lab[y][x] = idx
            q = deque([(x, y)])
            pix = []
            open_ = False
            while q:
                cx, cy = q.popleft()
                pix.append((cx, cy))
                if cx <= x0 or cx >= x1 - 1 or cy <= y0 or cy >= y1 - 1:
                    open_ = True
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = cx + dx, cy + dy
                    if x0 <= nx < x1 and y0 <= ny < y1 and not md[ny][nx] and lab[ny][nx] < 0:
                        lab[ny][nx] = idx
                        q.append((nx, ny))
            if open_:
                continue
            cur = set(pix)
            d = 0
            while True:
                nxt = set()
                for (px_, py_) in cur:
                    if ((px_ + 1, py_) in cur and (px_ - 1, py_) in cur
                            and (px_, py_ + 1) in cur and (px_, py_ - 1) in cur):
                        nxt.add((px_, py_))
                if not nxt:
                    break
                cur = nxt
                d += 1
            stats.append((len(pix), d))
            if d <= 10:
                for (px_, py_) in pix:
                    solid[py_][px_] = True
    return solid, stats

def runs_v(m, x, y0, y1, minlen=18):
    out, st = [], None
    for y in range(y0, y1):
        if m[y][x] and st is None:
            st = y
        elif not m[y][x] and st is not None:
            if y - st >= minlen:
                out.append((st, y - 1))
            st = None
    if st is not None and y1 - st >= minlen:
        out.append((st, y1 - 1))
    return out

def runs_h(m, y, x0, x1, minlen=18):
    out, st = [], None
    for x in range(x0, x1):
        if m[y][x] and st is None:
            st = x
        elif not m[y][x] and st is not None:
            if x - st >= minlen:
                out.append((st, x - 1))
            st = None
    if st is not None and x1 - st >= minlen:
        out.append((st, x1 - 1))
    return out

def inter(a, b):
    lo, hi = max(a[0], b[0]), min(a[1], b[1])
    return (lo, hi) if hi > lo else None

def merge_iv(listlike, gap):
    out = []
    for s in sorted(listlike):
        if out and s[0] - out[-1][1] <= gap:
            out[-1] = (out[-1][0], max(out[-1][1], s[1]))
        else:
            out.append((s[0], s[1]))
    return out

def union_iv(a, b):
    """Union of two edge-span lists: a member runs as far as *either* edge."""
    return merge_iv(list(a) + list(b), 1)

def mm_x(px): return (px - X0) / S
def mm_y(px): return (px - Y0) / S

def snap(v, vals, tol):
    best = min(vals, key=lambda t: abs(t - v))
    return best if abs(best - v) <= tol else v

def main():
    dark, W, H = load()
    x0, y0, x1, y1 = ROI
    solid, stats = enclosed_solid(dark, W, H, ROI)
    log('enclosed regions: %d   thin(solid) classes: %s' %
        (len(stats), sorted(set(d for _, d in stats))[:4]))

    # --- vertical edge lines: group identical run patterns -------------------
    cx0, cy0, cx1, cy1 = CORE
    cols = {}
    for x in range(cx0, cx1):
        r = runs_v(dark, x, cy0, cy1)
        if r:
            cols[x] = r
    vs = []
    used = set()
    for x in sorted(cols):
        if x in used:
            continue
        for x2 in range(x + 11, x + 18):
            if x2 in cols and x2 not in used:
                pieces = union_iv(cols[x], cols[x2])
                pieces = [p for p in pieces if p[1] - p[0] >= 5]
                if pieces and sum(b - a for a, b in pieces) >= 0.5 * sum(b - a for a, b in cols[x]):
                    vs.append({'xL': x, 'xR': x2, 'cx': (x + x2) / 2, 'spans': pieces})
                    used.add(x); used.add(x2)
                    break
    # --- horizontal edge lines ---------------------------------------------
    rows = {}
    for y in range(cy0, cy1):
        r = runs_h(dark, y, cx0, cx1)
        if r:
            rows[y] = r
    hs = []
    used = set()
    for y in sorted(rows):
        if y in used:
            continue
        for y2 in range(y + 11, y + 18):
            if y2 in rows and y2 not in used:
                pieces = union_iv(rows[y], rows[y2])
                pieces = [p for p in pieces if p[1] - p[0] >= 5]
                if pieces and sum(b - a for a, b in pieces) >= 0.5 * sum(b - a for a, b in rows[y]):
                    hs.append({'yT': y, 'yB': y2, 'cy': (y + y2) / 2, 'spans': pieces})
                    used.add(y); used.add(y2)
                    break

    # --- snap to the annotated lattice -------------------------------------
    ysnap = sorted(set([r for r in ROWS] + [r - 15.0 for r in ROWS]))
    ycent = [r - 7.5 for r in ROWS]                # centres of the horizontal sticks
    xsnap = sorted(set([0.0, 40.0] + COLS + [c - 7.5 for c in COLS] + [c + 7.5 for c in COLS]))

    def dedupe(sticks):
        seen, out = set(), []
        for s in sticks:
            k = (s['axis'], round(s['c'], 1), round(s['a'], 1), round(s['b'], 1))
            if k in seen:
                continue
            seen.add(k)
            out.append(s)
        return out

    sticks_v = []
    for e in vs:
        cx = snap(mm_x(e['cx']), COLS, 3.0)
        for (a, b) in e['spans']:
            ya, yb = snap(mm_y(a), ysnap, 3.0), snap(mm_y(b), ysnap, 3.0)
            sticks_v.append({'axis': 'v', 'c': round(cx, 1), 'a': round(ya, 1), 'b': round(yb, 1)})
    sticks_h = []
    for e in hs:
        cy = snap(mm_y(e['cy']), ycent, 3.0)
        for (a, b) in e['spans']:
            xa, xb = snap(mm_x(a), xsnap, 3.0), snap(mm_x(b), xsnap, 3.0)
            sticks_h.append({'axis': 'h', 'c': round(cy, 1), 'a': round(xa, 1), 'b': round(xb, 1)})
    sticks_v = dedupe(sticks_v)
    sticks_h = dedupe(sticks_h)

    # --- merge pieces that a perpendicular stick covers (same solid) --------
    def covered_v(v):
        return any(h['c'] - 7.5 <= v['c'] <= h['c'] + 7.5 and h['a'] <= v['a'] and v['b'] <= h['b']
                   and h['a'] <= v['b'] and v['a'] <= h['b'] for h in sticks_h)
    def covered_h(h):
        return any(v['c'] - 7.5 <= h['c'] <= v['c'] + 7.5 and v['a'] <= h['a'] and h['b'] <= v['b']
                   for v in sticks_v)

    def merge_axis(sticks, covered):
        byc = {}
        for s in sticks:
            byc.setdefault(s['c'], []).append(s)
        out = []
        for c, ss in byc.items():
            ss.sort(key=lambda s: s['a'])
            cur = dict(ss[0])
            for s in ss[1:]:
                gap = s['a'] - cur['b']
                probe = {'axis': s['axis'], 'c': c, 'a': cur['b'], 'b': s['a']}
                if gap <= 16 and covered(probe):
                    cur['b'] = s['b']
                else:
                    out.append(cur)
                    cur = dict(s)
            out.append(cur)
        return out

    sticks_v = merge_axis(sticks_v, covered_v)
    sticks_h = merge_axis(sticks_h, covered_h)

    model = []
    for s in sticks_v:
        model.append({'kind': '芯子', 'rect_mm': [s['c'] - 7.5, s['a'], s['c'] + 7.5, s['b']]})
    for s in sticks_h:
        model.append({'kind': '芯子', 'rect_mm': [s['a'], s['c'] - 7.5, s['b'], s['c'] + 7.5]})
    # 对称轴竖条：半立面在轴线处切断（断开线 1595），图上只剩它的左边缘线 1587.5；
    # 断线在横条处被横条的填充盖住，不是分段，故它是一条整料 40..305。
    axis = ((40.0, 95.0), (110.0, 165.0), (180.0, 305.0))
    for (a, b) in axis:
        model.append({'kind': '芯子', 'rect_mm': [1587.5, a, HALF, b],
                      'note': '对称轴竖条（半立面只画 7.5 宽半边；镜像后成 15 宽整料）'})

    # --- 整料化：把在轴线处被切断的横条补到 1595，轴竖条三段并成一条 ----------
    model = [m for m in model
             if not (m['rect_mm'][0] == 1587.5 and m['rect_mm'][2] == HALF)]
    model.append({'kind': '芯子', 'rect_mm': [1587.5, 40.0, HALF, 305.0],
                  'note': '对称轴竖条，图上被横条填充盖住的断线按整料连通'})
    for m in model:
        r = m['rect_mm']
        if abs(r[2] - (HALF - 7.5)) < 0.5:
            r[2] = HALF          # 横条跨过轴线，镜像后两端相接

    # --- 交叉口补料：量取沿线取边时，横料在竖料处、竖料在横料处都被白填充切断，
    #     交点因此留下 15×15 的空格（渲染时成为比格心更深的成片暗点）。图上该格是
    #     同一块木头的实体，这里按整料补回；补前先在原图上确认该格内没有墨线。
    vert = [m['rect_mm'] for m in model if m['rect_mm'][2] - m['rect_mm'][0] < m['rect_mm'][3] - m['rect_mm'][1]]
    hori = [m['rect_mm'] for m in model if m['rect_mm'][2] - m['rect_mm'][0] >= m['rect_mm'][3] - m['rect_mm'][1]]

    def no_ink(c):
        a, c2 = int(round(X0 + c[0] * S)) + 2, int(round(X0 + c[2] * S)) - 2
        b, d = int(round(Y0 + c[1] * S)) + 2, int(round(Y0 + c[3] * S)) - 2
        return not any(dark[y][x] for y in range(b, d + 1) for x in range(a, c2 + 1))

    cells, seen = [], set()
    for v in vert:
        for h in hori:
            if max(v[0], h[0]) > min(v[2], h[2]) + 0.5 or max(v[1], h[1]) > min(v[3], h[3]) + 0.5:
                continue
            c = (v[0], h[1], v[2], h[3])
            if c in seen or not no_ink(c):
                continue
            seen.add(c)
            cells.append(c)
    for c in cells:
        model.append({'kind': '芯子', 'rect_mm': list(c),
                      'note': '交叉口整料补回：量取时横竖料在交口互相切断，图上该格为同一块木头的实体'})
    log('junction fills: %d' % len(cells))

    # --- structural members from the annotations ---------------------------
    members = []
    members.append({'id': 'head', 'kind': '上枋', 'rect_mm': [0.0, 0.0, HALF, 40.0], 'depth': [0.0, 60.0],
                    'note': '高 40（标注），进深 60（梃 40×60 同料）'})
    members.append({'id': 'post-L', 'kind': '梃', 'rect_mm': [0.0, 40.0, 40.0, 444.0], 'depth': [0.0, 60.0],
                    'note': '宽 40 标注；顶与上枋 45° 亚木角交接'})
    foot = [
        [0.0, 444.0, 33.0, 450.0],
        [0.0, 450.0, 31.0, 456.0],
        [0.0, 456.0, 33.0, 467.0],
        [0.0, 467.0, 16.0, 510.0],
    ]
    for i, r in enumerate(foot):
        members.append({'id': 'foot-%d' % i, 'kind': '收头', 'rect_mm': r, 'depth': [0.0, 60.0],
                        'note': '图上退级小料，最下沿 510'})
    for i, s in enumerate(model):
        members.append({'id': 'core-%02d' % i, 'kind': '芯子', 'rect_mm': s['rect_mm'], 'depth': [0.0, 30.0],
                        'note': s.get('note', '15×30 混面')})

    # --- verify: rasterise the snapped model, compare with the pixel mask ----
    chk = Image.new('1', (W, H), 0)
    dch = ImageDraw.Draw(chk)
    for s in model:
        rx0 = X0 + s['rect_mm'][0] * S
        rx1 = X0 + s['rect_mm'][2] * S
        ry0 = Y0 + s['rect_mm'][1] * S
        ry1 = Y0 + s['rect_mm'][3] * S
        dch.rectangle([round(rx0), round(ry0), round(rx1) - 1, round(ry1) - 1], fill=1)
    cp = chk.load()
    # the pixel mask holds member *interiors* only (it stops at the drawn line),
    # so one dilation brings it back to the drawn outline before comparing.
    sol_d = dilate(solid, W, H, 1)
    on = off = mask_n = 0
    for y in range(cy0, cy1):
        for x in range(cx0, cx1):
            if cp[x, y]:
                if sol_d[y][x]:
                    on += 1
                else:
                    off += 1
            if solid[y][x]:
                mask_n += 1
    cov = on / max(1, on + off)
    log('model px on the drawn outline: %.1f%%   mask interior px %d' % (100 * cov, mask_n))
    iou = cov

    # --- normalised table ---------------------------------------------------
    k = 3300.0 / W_TOTAL
    table = {
        'source': os.path.basename(SRC),
        'drawing': {'scale': '1:10', 'total_mm': [W_TOTAL, H_TOTAL], 'half_mm': HALF,
                    'height_chain': [40, 350, 120], 'row_cells': [70] * 5, 'col_pitch_mm': round(COL_PITCH, 2),
                    '梃': '40×60 亚木角', '芯子': '15×30 混面'},
        'calibration': {'px_per_mm': S, 'x0_px': X0, 'y0_px': Y0,
                        'x_check': '3190/2=1595 spans px 211..1609 -> 0.87649 px/mm',
                        'y_check': '40+350+120=510 spans px 190..637 -> 0.87647 px/mm'},
        'axes': {'origin': 'left outer face of 梃 at x=0, top line of 上枋 at y=0, y down',
                 'mirror': 'full elevation = x -> 3190 - x (drawing is a half-elevation with break marks)',
                 'normalised': 'u = x/3190, v = y/510'},
        'display_scale': {'k': round(k, 6), 'clear_span_mm': 3300.0,
                          'total_mm': round(W_TOTAL * k, 1), 'height_mm': round(H_TOTAL * k, 1),
                          '梃_mm': [round(40 * k, 1), round(60 * k, 1)],
                          '芯子_mm': [round(15 * k, 1), round(30 * k, 1)]},
        'verify': {'iou': round(iou, 3), 'px_per_mm': S},
        'notes': [
            '标注尺寸优先：总长 3190、半长 1555、总高 510、高度链 40+70×5+120、梃 40、芯子 15 均取图纸标注；量取值与标注冲突时以标注为准。',
            '镜像依据：图纸为半立面，右端以断开线收口；另一半按 x→3190−x 镜像补全，轴处竖条图上只存 1587.5..1595 的 7.5 宽半边，镜像后成 15 宽通条。',
            '分辨率：底图 1:10，实测 0.87648 px/mm，1 px ≈ 1.14 mm；15 芯子在图上仅约 13 px，拐点定位不确定度约 ±1 mm，吸附容差 3 mm。',
            '收头：图上 467..478 处有一道 36.5 宽的圆唇小凸，本表按直线退级简化为 33，偏差 ≤3.5 mm。',
            '收头底段：图上 467..510 为斜收至 16 宽；本表按矩形 [0,467,16,510] 表示，斜边未做多边形。',
            '进深：仅梃/上枋标注 40×60；芯子 15×30 取 30 进深，图上无剖面。芯子背面与梃齐平、前脸内凹 30 为假定。',
            '整料化：格心为同一材质的连续构件，相交处做并集、不画内部分界；轴处横条补到 1595 与镜像端相接，轴竖条三段并为一条 40..305；各交叉口按整料补回 15×15 的格子（量取时横竖料在交口被白填充切断，图上该格为同一块木头的实体）。',
            '施工图尺寸为设计复原值，可能与原物有偏差。',
        ],
        'members': [],
    }
    for m in members:
        r = m['rect_mm']
        table['members'].append({
            'id': m['id'], 'kind': m['kind'],
            'mm': [round(v, 1) for v in r],
            'depth_mm': m['depth'],
            'u': [round(r[0] / W_TOTAL, 4), round(r[2] / W_TOTAL, 4)],
            'v': [round(r[1] / H_TOTAL, 4), round(r[3] / H_TOTAL, 4)],
            'scaled_mm': [round(r[0] * k, 1), round(r[1] * k, 1), round(r[2] * k, 1), round(r[3] * k, 1)],
            'depth_scaled_mm': [round(m['depth'][0] * k, 1), round(m['depth'][1] * k, 1)],
            'note': m['note'],
        })
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, 'H10_归一化坐标表.json'), 'w') as f:
        json.dump(table, f, ensure_ascii=False, indent=1)
    log('members: %d  (芯子 %d)' % (len(members), len(model)))

    # --- overlay: the generated outline back onto the scan -------------------
    base = Image.open(SRC).convert('RGB')
    union = Image.new('L', base.size, 0)
    du = ImageDraw.Draw(union)
    for s in model:
        rx0 = X0 + s['rect_mm'][0] * S
        ry0 = Y0 + s['rect_mm'][1] * S
        rx1 = X0 + s['rect_mm'][2] * S
        ry1 = Y0 + s['rect_mm'][3] * S
        du.rectangle([rx0, ry0, rx1, ry1], fill=255)
    from PIL import ImageChops, ImageFilter
    edge = ImageChops.subtract(union, union.filter(ImageFilter.MinFilter(3)))
    ep = edge.load()
    ov = Image.new('RGBA', base.size, (0, 0, 0, 0))
    dev = []
    for y in range(cy0 - 4, cy1 + 4):
        for x in range(cx0 - 4, cx1 + 4):
            if ep[x, y] < 128:
                continue
            ov.putpixel((x, y), (215, 0, 0, 255))
            up = union.getpixel((x, y - 1)) > 128
            dn = union.getpixel((x, y + 1)) > 128
            vert = not (up and dn)          # horizontal edge -> probe vertically
            best = 9
            for dd in range(-4, 5):
                xx2, yy2 = (x, y + dd) if vert else (x + dd, y)
                if 0 <= xx2 < W and 0 <= yy2 < H and dark[yy2][xx2]:
                    best = min(best, abs(dd))
            dev.append(best / S)
    dev_s = sorted(dev)
    log('outline deviation mm: mean %.2f  p95 %.2f  max %.2f  (n=%d)' %
        (sum(dev) / len(dev), dev_s[int(len(dev_s) * 0.95)], dev_s[-1], len(dev)))
    hd = [d for d in dev if d <= 2.0]
    log('  points within 2 mm: %.1f%%' % (100 * len(hd) / len(dev)))

    img = Image.alpha_composite(base.convert('RGBA'), ov).convert('RGB')

    # 梃 / 上枋 / 收头 来自图纸标注（非量取），用蓝线以示区别
    struct = Image.new('L', base.size, 0)
    ds = ImageDraw.Draw(struct)
    for m in members:
        if m['kind'] == '芯子':
            continue
        r = m['rect_mm']
        ds.rectangle([X0 + r[0] * S, Y0 + r[1] * S, X0 + r[2] * S, Y0 + r[3] * S], fill=255)
    se = ImageChops.subtract(struct, struct.filter(ImageFilter.MinFilter(3))).load()
    ovb = Image.new('RGBA', base.size, (0, 0, 0, 0))
    for y in range(base.size[1]):
        for x in range(base.size[0]):
            if se[x, y] >= 128:
                ovb.putpixel((x, y), (30, 70, 190, 255))
    img = Image.alpha_composite(img.convert('RGBA'), ovb).convert('RGB')

    dd = ImageDraw.Draw(img)
    try:
        fl = ImageFont.truetype('/System/Library/Fonts/Hiragino Sans GB.ttc', 15)
    except Exception:
        fl = ImageFont.load_default()
    dd.text((26, 20), '红线 = 量取的格心（15×30），右半镜像补全', font=fl, fill=(200, 0, 0))
    dd.text((26, 40), '蓝线 = 梃 40×60 / 上枋 / 收头，按图纸标注', font=fl, fill=(30, 70, 190))
    img.save(os.path.join(OUT, 'H10_线稿叠合.png'))

    # --- white model, orthographic front view: 改前 / 改后 -------------------
    render_white_model(members, os.path.join(OUT, 'H10_白模正视.png'))

    table['verify']['outline_dev_mm'] = {
        'mean': round(sum(dev) / len(dev), 2),
        'p95': round(dev_s[int(len(dev_s) * 0.95)], 2),
        'max': round(dev_s[-1], 2),
        'within_2mm': round(100 * len(hd) / len(dev), 1),
    }
    with open(os.path.join(OUT, 'H10_归一化坐标表.json'), 'w') as f:
        json.dump(table, f, ensure_ascii=False, indent=1)

    return table, model, members, iou


def render_white_model(members, path, P=0.62, ss=2):
    """正交正视白模：同一材质、同一深度 = 单一平面，内部不出现任何深浅。

    - 格心（30）并集后平涂一色；梃/上枋/收头（60）并集后平涂一色；
    - 除各自的外轮廓外不画任何线；
    - 深度只保留两处：整件与背景之间的柔影、梃/上枋与格心之间的明度差。
    """
    from PIL import ImageChops

    core = [m for m in members if m['depth'][1] <= 30.0]
    deep = [m for m in members if m['depth'][1] > 30.0]
    FBG, FCORE, FDEEP = (207, 207, 203), (238, 238, 234), (255, 255, 255)
    Lx, Ly, Lz = -0.40, -0.50, 0.77
    kx, ky = -Lx / Lz, -Ly / Lz

    def paint(cv, offx, offy, k):
        def mask_of(ms, dz=0.0, blur=0.0):
            im = Image.new('L', cv.size, 0)
            dr = ImageDraw.Draw(im)
            for m in ms:
                r = m['rect_mm']
                for mx0, mx1 in ((r[0], r[2]), (W_TOTAL - r[2], W_TOTAL - r[0])):
                    dr.rectangle([offx + (mx0 + dz * kx) * k, offy + (r[1] + dz * ky) * k,
                                  offx + (mx1 + dz * kx) * k, offy + (r[3] + dz * ky) * k], fill=255)
            return im.filter(ImageFilter.GaussianBlur(blur)) if blur else im

        core_mask, deep_mask = mask_of(core), mask_of(deep)
        all_mask = ImageChops.lighter(core_mask, deep_mask)

        # 唯一的影：只在整件外轮廓之外的背景上，面板内部的空格一律不落影
        sh = mask_of(core + deep, 30.0, 5.0 * k).point(lambda v: int(v * 0.5))
        keep = Image.new('L', cv.size, 0)
        ImageDraw.Draw(keep).rectangle(
            [offx - 1, offy - 1, offx + W_TOTAL * k + 1, offy + H_TOTAL * k + 1], fill=255)
        sh = ImageChops.multiply(sh, ImageChops.invert(keep))
        cv.paste(Image.new('RGB', cv.size, (176, 176, 172)), (0, 0), sh)

        cv.paste(Image.new('RGB', cv.size, FCORE), (0, 0), core_mask)
        cv.paste(Image.new('RGB', cv.size, FDEEP), (0, 0), deep_mask)

        for msk, col in ((core_mask, (124, 124, 120)), (deep_mask, (34, 34, 32))):
            e = ImageChops.subtract(msk, msk.filter(ImageFilter.MinFilter(2 * ss + 1)))
            cv.paste(Image.new('RGB', cv.size, col), (0, 0), e.filter(ImageFilter.MaxFilter(3)))
        return core_mask

    try:
        FONT = '/System/Library/Fonts/Hiragino Sans GB.ttc'
        f1 = ImageFont.truetype(FONT, 15 * ss)
        f2 = ImageFont.truetype(FONT, 11 * ss)
        f3 = ImageFont.truetype(FONT, 13 * ss)
    except Exception:
        f1 = f2 = f3 = ImageFont.load_default()
    kk = 3300.0 / W_TOTAL

    # ---- 整件 --------------------------------------------------------------
    Wm, Hm = int(W_TOTAL * P), int(H_TOTAL * P)
    padx, pady = 78, 30
    panelW, panelH = Wm + 2 * padx, Hm + 2 * pady + 34
    full = Image.new('RGB', (panelW * ss, panelH * ss), FBG)
    core_mask_full = paint(full, padx * ss, (pady + 22) * ss, P * ss)
    d = ImageDraw.Draw(full)
    d.rectangle([0, 0, full.size[0], 22 * ss], fill=(232, 232, 228))
    d.text((padx * ss, 4 * ss),
           'H10 四时潇洒亭 挂落1 · 整件正交正视（无透视）· 净跨 3300 / 总高 %.1f mm'
           % (H_TOTAL * kk), font=f3, fill=(60, 60, 58))

    # ---- 局部（对称轴接合处）2× -------------------------------------------
    DX0, DX1, DY0, DY1 = 1360.0, 1740.0, 60.0, 360.0
    k2 = 2 * P * ss
    dw, dh = int((DX1 - DX0) * k2), int((DY1 - DY0) * k2) + 26 * ss
    det = Image.new('RGB', (dw, dh), FBG)
    paint(det, -DX0 * k2, -DY0 * k2 + 26 * ss, k2)
    d2 = ImageDraw.Draw(det)
    d2.rectangle([0, 0, dw, 22 * ss], fill=(232, 232, 228))
    d2.text((10 * ss, 4 * ss), '局部 2×：对称轴接合与交叉口', font=f3, fill=(60, 60, 58))
    bx, by = 14 * ss, dh - 18 * ss
    d2.line([bx, by, bx + 100 * k2, by], fill=(50, 50, 48), width=max(1, ss))
    for xx in (0, 100):
        d2.line([bx + xx * k2, by - 4 * ss, bx + xx * k2, by + 4 * ss], fill=(50, 50, 48), width=max(1, ss))
    d2.text((bx + 100 * k2 + 8 * ss, by - 8 * ss), '100 mm', font=f2, fill=(70, 70, 66))

    # ---- 合图 --------------------------------------------------------------
    capH = 104
    img = Image.new('RGB', (max(panelW * ss, dw + 2 * padx * ss), panelH * ss + 26 * ss + dh + capH * ss), FBG)
    img.paste(full, (0, 0))
    img.paste(det, (padx * ss, panelH * ss + 26 * ss))

    d3 = ImageDraw.Draw(img)
    bx = padx * ss
    by = panelH * ss + 26 * ss + dh + 16 * ss
    d3.text((bx, by),
            '格心 30 / 梃·上枋 60：两者材质相同，交界只在明度上区分，格心内部无任何投影或分界线',
            font=f2, fill=(96, 96, 92))
    d3.text((bx, by + 18 * ss),
            '梃 %.1f×%.1f · 芯子 %.1f×%.1f（按 3300/3190 = %.3f 同系数缩放，料厚未单独放大）'
            % (40 * kk, 60 * kk, 15 * kk, 30 * kk, kk), font=f2, fill=(96, 96, 92))
    d3.text((bx, by + 36 * ss),
            '芯子 30 进深图上无剖面，按“背面与梃齐平、前脸内凹 %.0f”假定；施工图尺寸为设计复原值，可能与原物有偏差'
            % (30 * kk), font=f2, fill=(96, 96, 92))

    img = img.resize((img.size[0] // ss, img.size[1] // ss), Image.LANCZOS)
    img.save(path)
    log('wrote', path, img.size)

    # ---- 自查：格心内部不得出现比基色更深的成片色块，也不得有漏底的空格 ---
    lay = core_mask_full.filter(ImageFilter.MinFilter(9))   # 内缩，排除描边与抗锯齿
    lp, ip, n, bad, hole = lay.load(), full.load(), 0, 0, 0
    for y in range(full.size[1]):
        for x in range(full.size[0]):
            if lp[x, y] > 0:
                n += 1
                if ip[x, y][0] < FCORE[0] - 3:
                    bad += 1
                if ip[x, y][0] <= FBG[0] + 6:
                    hole += 1
    log('self-check: 格心内部 %d px，其中比基色更深的 %d px (%.2f%%)，漏出底色的 %d px' %
        (n, bad, 100.0 * bad / max(1, n), hole))


if __name__ == '__main__':
    main()
