#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""生成「带指定状态」的预览副本并截图，用于视觉校对（Edge headless）。

用法（在项目根目录执行）：
    python tools/preview.py login
    python tools/preview.py projects --page projects --js "db.projects=[];saveDB();"
    python tools/preview.py roles --page accounts --js "state.acctTab='roles';"
    python tools/preview.py upload --dump          # 只取 data-probe，不截图
    python tools/preview.py --clean                # 清理所有 _preview_* 产物

参数：
    name            产物前缀，默认 preview
    --page PAGE     登录后进入的页面（dashboard/inbound/outbound/stock/projects/...）
    --js CODE       在 render() 之后执行的额外 JS（可用 db/state/saveDB 等全局）
    --guest         以游客身份进入（只读态）
    --no-login      不自动登录，停在登录页（等同默认行为）
    --w WIDTH       截图宽，默认 1360
    --h HEIGHT      截图高，默认 900
    --wait MS       virtual-time-budget，默认 2500
    --dump          输出 data-probe 而不是截图（配合 --js 里 setAttribute）
    --keep          保留生成的 html
"""
import argparse
import glob
import os
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INDEX = os.path.join(ROOT, 'index.html')

EDGE_CANDIDATES = [
    r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
    r'C:\Program Files\Microsoft\Edge\Application\msedge.exe',
    r'C:\Program Files\Google\Chrome\Application\chrome.exe',
]


def find_browser():
    for p in EDGE_CANDIDATES:
        if os.path.exists(p):
            return p
    raise SystemExit('未找到 Edge/Chrome，可手动修改 EDGE_CANDIDATES')


def build(name, page, js, guest, w, h, wait, dump, keep):
    html = open(INDEX, encoding='utf-8').read()

    if guest:
        boot = "enterGuest();"
    elif page:
        boot = ("session={userId:'u_admin',guest:false};saveSession();"
                "$('#loginRoot').innerHTML='';state.page='%s';render();" % page)
    else:
        boot = ""

    code = boot + (js or "")
    if not code and not dump:
        # 纯登录页：无需注入
        pass

    out_html = os.path.join(ROOT, '_preview_%s.html' % name)
    if code:
        inject = '<script>setTimeout(function(){%s},420);</script>' % code
        html = html.replace('</body>', inject + '</body>')
    open(out_html, 'w', encoding='utf-8').write(html)
    return out_html


def main():
    ap = argparse.ArgumentParser(add_help=True)
    ap.add_argument('name', nargs='?', default='preview')
    ap.add_argument('--page', default='')
    ap.add_argument('--js', default='')
    ap.add_argument('--guest', action='store_true')
    ap.add_argument('--w', type=int, default=1360)
    ap.add_argument('--h', type=int, default=900)
    ap.add_argument('--wait', type=int, default=2500)
    ap.add_argument('--dump', action='store_true')
    ap.add_argument('--keep', action='store_true')
    ap.add_argument('--clean', action='store_true')
    a = ap.parse_args()

    if a.clean:
        n = 0
        for p in glob.glob(os.path.join(ROOT, '_preview_*')):
            os.remove(p)
            n += 1
        print('cleaned %d file(s)' % n)
        return

    html = build(a.name, a.page, a.js, a.guest, a.w, a.h, a.wait, a.dump, a.keep)
    profile = os.path.join(tempfile.gettempdir(), 'wms_preview_' + a.name)
    base = [find_browser(), '--headless=new', '--disable-gpu', '--hide-scrollbars',
            '--window-size=%d,%d' % (a.w, a.h),
            '--virtual-time-budget=%d' % a.wait,
            '--user-data-dir=' + profile]

    if a.dump:
        r = subprocess.run(base + ['--dump-dom', 'file:///' + html.replace('\\', '/')],
                           capture_output=True, text=True, encoding='utf-8', errors='replace')
        import re
        m = re.search(r'data-probe="([^"]*)"', r.stdout or '')
        print(m.group(1) if m else '(no data-probe —— 检查 --js 是否设置了 document.body.dataset.probe)')
        if not a.keep:
            try:
                os.remove(html)
            except OSError:
                pass
        return

    png = os.path.join(ROOT, '_preview_%s.png' % a.name)
    subprocess.run(base + ['--screenshot=' + png, 'file:///' + html.replace('\\', '/')],
                   capture_output=True)
    if not a.keep:
        try:
            os.remove(html)
        except OSError:
            pass
    if not os.path.exists(png):
        raise SystemExit('截图失败：' + png)
    print(png)


if __name__ == '__main__':
    main()
