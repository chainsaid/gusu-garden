#!/usr/bin/env python3
"""H06 回纹挂落：从施工图 PDF 第 17 页提取矢量路径。

PDF 为未压缩对象结构（PDF-1.4），内容是 FlateDecode 路径流；
不依赖第三方库，纯 zlib + 自写内容流解析。

页面 17 = Kids[16] = object 36，/Rotate 270（仅影响栅格渲染，不影响矢量坐标）。
图比例 1:15；1 pt = 25.4/72 mm 图面 → 实尺 1 pt = 25.4/72*15 mm。

输出：
  out/reference/H-挂落正式图纸/h06_paths.json   （页面坐标 + 实尺 mm 路径）
  /tmp/h06_clusters.json                        （候选簇，供人工确认）
"""
import json
import math
import re
import zlib

PDF = "/Volumes/SSD/zhaozhenlong/Programs/gusu-garden/out/reference/drawings/shizilin_yiyuan_2019.pdf"
RAW = open(PDF, "rb").read()
MM_PER_PT = 25.4 / 72.0 * 15.0          # 1:15 图面 pt → 实尺 mm
PT_MM = 25.4 / 72.0


def obj(n):
    m = re.search(rb"(?<![0-9])%d\s+0\s+obj" % n, RAW)
    s = m.end()
    e = RAW.find(b"endobj", s)
    return RAW[s:e]


def stream_of(n):
    b = obj(n)
    i = b.find(b"stream") + 6
    if b[i:i + 1] == b"\r":
        i += 1
    if b[i:i + 1] == b"\n":
        i += 1
    e = b.rfind(b"endstream")
    return zlib.decompress(b[i:e])


NUM = re.compile(rb"[+-]?(?:\d+\.?\d*|\.\d+)")
OPS = set(
    b"m l c v y h re S s f F f* B b B* b* n q Q cm w J j M d ri i gs W w "
    b"RG rg G g K k d0 d1 sh Do BI ID EI".split()
)


def tokenize(s):
    """产出 (op, [numbers])；路径算子每次立即处理。"""
    i, n = 0, len(s)
    nums = []
    while i < n:
        c = s[i:i + 1]
        if c in b" \t\r\n":
            i += 1
            continue
        if c == b"%":
            while i < n and s[i:i + 1] not in b"\r\n":
                i += 1
            continue
        m = NUM.match(s, i)
        if m:
            nums.append(float(m.group()))
            i = m.end()
            continue
        # 操作符
        j = i
        while j < n and (s[j:j + 1].isalpha() or s[j:j + 1] in b"*'\"01"):
            j += 1
        op = s[i:j].decode("latin1")
        i = j
        if op == "BI":
            k = s.find(b"EI", i)
            i = k + 2 if k >= 0 else n
            continue
        yield op, nums
        nums = []


def flatten_cubic(p0, p1, p2, p3, k=6):
    out = []
    for i in range(1, k + 1):
        t = i / k
        u = 1 - t
        out.append((
            u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
            u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
        ))
    return out


def seg_paths(content):
    """返回子路径列表：{pts, w, paint, fill}"""
    recs = []
    cur = None          # 当前子路径点列
    start = None
    width = 0.36
    paint = "S"
    fill = False
    for op, a in tokenize(content):
        if op == "w":
            width = a[0]
        elif op == "m":
            if cur and len(cur) > 1:
                recs.append({"pts": cur, "w": width, "paint": paint, "fill": fill})
            cur = [(a[0], a[1])]
            start = cur[0]
            fill = False
        elif op == "l":
            if cur is not None:
                cur.append((a[0], a[1]))
        elif op == "re":
            x, y, w, h = a[:4]
            if cur and len(cur) > 1:
                recs.append({"pts": cur, "w": width, "paint": paint, "fill": fill})
            cur = [(x, y), (x + w, y), (x + w, y + h), (x, y + h), (x, y)]
            start = cur[0]
            fill = True
        elif op in ("c", "v", "y"):
            if cur is None:
                continue
            p0 = cur[-1]
            if op == "c":
                p1, p2, p3 = (a[0], a[1]), (a[2], a[3]), (a[4], a[5])
            elif op == "v":
                p1, p2, p3 = p0, (a[0], a[1]), (a[2], a[3])
            else:
                p1, p2, p3 = (a[0], a[1]), (a[2], a[3]), (a[2], a[3])
            cur.extend(flatten_cubic(p0, p1, p2, p3))
        elif op == "h":
            if cur and start:
                cur.append(start)
        elif op in ("S", "s", "f", "F", "f*", "B", "b", "B*", "b*", "n"):
            if cur and len(cur) > 1:
                recs.append({"pts": cur, "w": width, "paint": op,
                             "fill": op in ("f", "F", "f*", "B", "b", "B*", "b*")})
                if op in ("s", "b", "b*") and start:
                    recs[-1]["pts"].append(start)
            cur = None
            start = None
            fill = False
    if cur and len(cur) > 1:
        recs.append({"pts": cur, "w": width, "paint": paint, "fill": fill})
    return recs


def bbox(pts):
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    return min(xs), min(ys), max(xs), max(ys)


if __name__ == "__main__":
    recs = seg_paths(stream_of(37))
    print("subpaths", len(recs))
    big = []
    for i, r in enumerate(recs):
        x0, y0, x1, y1 = bbox(r["pts"])
        big.append({"i": i, "bbox": [round(v, 2) for v in (x0, y0, x1, y1)],
                    "w": round(x1 - x0, 2), "h": round(y1 - y0, 2),
                    "n": len(r["pts"]), "lw": r["w"], "paint": r["paint"]})
    json.dump(big, open("/tmp/h06_clusters.json", "w"), indent=0)
    # 挂落外框约 495 x 133 pt（2620 x 705 mm）
    cand = [b for b in big if 460 < b["w"] < 540 and 110 < b["h"] < 160]
    print("候选外框 (460-540 x 110-160 pt):", len(cand))
    for b in cand:
        print(b)
    print("\n最大的 20 段：")
    for b in sorted(big, key=lambda b: -b["w"] * b["h"])[:20]:
        print(b)
