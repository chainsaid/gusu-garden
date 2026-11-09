#!/usr/bin/env python3
"""把狮子林施工图指定页转成干净 SVG（坐标单位为毫米，图纸纸面尺寸）。

用法（在仓库根目录）：
    .venv/bin/python docs/reference/gualuo-shizilin/build-vectors.py

依赖：项目 .venv 内的 pymupdf（`pip install pymupdf`）。
说明：
- 直接遍历 page.get_drawings() 的路径操作符，不经过 MuPDF 自带导出，
  避免输出里出现 90° 旋转矩阵，坐标可直接阅读。
- 坐标系：原点在页面左上角，x 向右、y 向下，单位为**纸面毫米**。
  真实构件尺寸 = 坐标值 × 比例分母（建施-15 为 15，建施-20 为 10）。
- 该 PDF 内文字已转为曲线，因此 SVG 里没有 <text>，字形是填充路径。
"""
import os
import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
PDF = os.path.join(HERE, "shizilin-yiyuan-2024-06-construction-drawings.pdf")
OUT = os.path.join(HERE, "svg")
PT2MM = 25.4 / 72.0

# (PDF 页序, 输出名, 图号, 比例分母)
PAGES = [
    (17, "JS-15-p17_corridor-gualuo-details", "建施-15 回廊大样图", 15),
    (22, "JS-20-p22_sishixiaosa-ting-details", "建施-20 四时潇洒亭大样图", 10),
]


def num(v):
    s = f"{v:.4f}".rstrip("0").rstrip(".")
    return s if s else "0"


def path_d(items, k, m):
    """items -> SVG path data; each point goes through rotation matrix m, then pt->mm scale k."""
    def xy(p):
        q = p * m
        return f"{num(q.x*k)} {num(q.y*k)}"

    parts = []
    for it in items:
        op = it[0]
        if op == "l":
            parts.append(f"M{xy(it[1])}L{xy(it[2])}")
        elif op == "c":
            parts.append(f"C{xy(it[2])} {xy(it[3])} {xy(it[4])}")
        elif op == "re":
            r = it[1]
            c = [pymupdf.Point(r.x0, r.y0), pymupdf.Point(r.x1, r.y0),
                 pymupdf.Point(r.x1, r.y1), pymupdf.Point(r.x0, r.y1)]
            parts.append(f"M{xy(c[0])}L{xy(c[1])}L{xy(c[2])}L{xy(c[3])}Z")
        elif op == "qu":
            q = it[1]
            pts = [q.ul, q.ur, q.lr, q.ll, q.ul]
            parts.append(f"M{xy(pts[0])}" + "".join(f"L{xy(p)}" for p in pts[1:]))
    return "".join(parts)


def build(page, title, denom):
    w_mm, h_mm = page.rect.width * PT2MM, page.rect.height * PT2MM
    m = page.rotation_matrix  # 该页 /Rotate=270，原始坐标是竖版，需转到横版
    head = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{w_mm:.2f}mm" height="{h_mm:.2f}mm" '
        f'viewBox="0 0 {w_mm:.2f} {h_mm:.2f}">',
        f"<!-- source: {os.path.basename(PDF)} page {page.number + 1} ; {title} ; drawing scale 1:{denom} ; "
        f"units = paper millimetres ; real size = coordinate x {denom} -->",
        f'<g id="sheet-{page.number + 1}">',
    ]
    body = []
    for d in page.get_drawings():
        dd = path_d(d["items"], PT2MM, m)
        if not dd:
            continue
        attrs = []
        if d.get("fill") is not None:
            r, g, b = d["fill"]
            attrs.append(f'fill="#{int(r*255):02x}{int(g*255):02x}{int(b*255):02x}"')
        else:
            attrs.append('fill="none"')
        if d.get("color") is not None:
            r, g, b = d["color"]
            attrs.append(f'stroke="#{int(r*255):02x}{int(g*255):02x}{int(b*255):02x}"')
            attrs.append(f'stroke-width="{num((d.get("width") or 0) * PT2MM)}"')
        attrs.append('stroke-linecap="round" stroke-linejoin="round"')
        body.append(f"<path {' '.join(attrs)} d=\"{dd}\"/>")
    tail = ["</g>", "</svg>"]
    return "\n".join(head + body + tail), len(body)


def main():
    os.makedirs(OUT, exist_ok=True)
    doc = pymupdf.open(PDF)
    for pno, name, title, denom in PAGES:
        svg, n = build(doc[pno - 1], title, denom)
        fn = os.path.join(OUT, name + ".svg")
        open(fn, "w", encoding="utf-8").write(svg)
        print(f"{fn}  paths={n}  size={os.path.getsize(fn)/1e6:.2f}MB")


if __name__ == "__main__":
    main()
