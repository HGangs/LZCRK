#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""生成桌面客户端图标（纯标准库，无需 PIL）：蓝底 + 白色等轴测立方体。

输出：
    desktop/assets/icon.ico   256x256，内嵌 PNG（Windows Vista+ 支持）
    desktop/assets/icon.png   同图，窗口图标用
"""
import os
import struct
import zlib

W = 256
S = 3                     # 超采样倍数
N = W * S
R = 58                    # 圆角半径（256 坐标系）

TOP = (0x3E, 0x72, 0xE4)  # 渐变起
BOT = (0x1C, 0x3E, 0x96)  # 渐变止

# 等轴测立方体三个面（256 坐标系）
P_TOP = [(128, 50), (207, 91), (128, 132), (49, 91)]
P_LEFT = [(49, 91), (128, 132), (128, 207), (49, 166)]
P_RIGHT = [(207, 91), (128, 132), (128, 207), (207, 166)]
FACE_ALPHA = [(1.00, 1.00, 1.00), (0.84, 0.87, 0.94), (0.62, 0.66, 0.78)]


def in_round_rect(x, y, x0, y0, x1, y1, r):
    if x < x0 or x > x1 or y < y0 or y > y1:
        return False
    cx = min(max(x, x0 + r), x1 - r)
    cy = min(max(y, y0 + r), y1 - r)
    dx, dy = x - cx, y - cy
    return dx * dx + dy * dy <= r * r


def in_poly(x, y, pts):
    inside = False
    n = len(pts)
    j = n - 1
    for i in range(n):
        xi, yi = pts[i]
        xj, yj = pts[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside


def render():
    rows = []
    inv = 1.0 / (S * S)
    for py in range(W):
        row = bytearray()
        for px in range(W):
            r = g = b = a = 0.0
            for sy in range(S):
                for sx in range(S):
                    x = px + (sx + 0.5) / S
                    y = py + (sy + 0.5) / S
                    if not in_round_rect(x, y, 4, 4, W - 4, W - 4, R):
                        continue
                    t = y / W
                    br = TOP[0] + (BOT[0] - TOP[0]) * t
                    bg = TOP[1] + (BOT[1] - TOP[1]) * t
                    bb = TOP[2] + (BOT[2] - TOP[2]) * t
                    # 轻微高光：左上更亮
                    hl = max(0.0, 1.0 - ((x - 50) ** 2 + (y - 40) ** 2) / (2 * 150.0 ** 2))
                    br += (255 - br) * 0.16 * hl
                    bg += (255 - bg) * 0.16 * hl
                    bb += (255 - bb) * 0.16 * hl
                    for pts, col in zip((P_TOP, P_LEFT, P_RIGHT), FACE_ALPHA):
                        if in_poly(x, y, pts):
                            br = col[0] * 255
                            bg = col[1] * 255
                            bb = col[2] * 255
                            break
                    r += br
                    g += bg
                    b += bb
                    a += 255.0
            if a > 0:
                cnt = a / 255.0
                row += bytes((int(min(255, r / cnt)), int(min(255, g / cnt)), int(min(255, b / cnt)), int(a * inv)))
            else:
                row += b'\x00\x00\x00\x00'
        rows.append(bytes(row))
    return rows


def png_bytes(width, height, rows):
    raw = b''.join(b'\x00' + r for r in rows)

    def chunk(tag, data):
        return (struct.pack('>I', len(data)) + tag + data
                + struct.pack('>I', zlib.crc32(tag + data) & 0xFFFFFFFF))

    ihdr = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)
    return (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', ihdr)
            + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b''))


def ico_bytes(png, w=256, h=256):
    head = struct.pack('<HHH', 0, 1, 1)
    entry = struct.pack('<BBBBHHII', w % 256, h % 256, 0, 0, 1, 32, len(png), 22)
    return head + entry + png


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    out = os.path.join(here, 'assets')
    os.makedirs(out, exist_ok=True)
    png = png_bytes(W, W, render())
    open(os.path.join(out, 'icon.png'), 'wb').write(png)
    open(os.path.join(out, 'icon.ico'), 'wb').write(ico_bytes(png))
    print('icon.png', len(png), 'bytes')
    print('icon.ico', os.path.getsize(os.path.join(out, 'icon.ico')), 'bytes')


if __name__ == '__main__':
    main()
