'use strict';
/**
 * 打包桌面客户端（Windows x64）
 *
 * 用法：node build.js
 * 产物：dist/desktop/出入库存工作台-win32-x64/出入库存工作台.exe
 *       dist/出入库存工作台_v<版本>_桌面客户端.zip
 */
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const { execFileSync, execSync } = require('child_process');
const packager = require('@electron/packager');

const DESK = __dirname;
const ROOT = path.resolve(DESK, '..');
const APP_DIR = path.join(DESK, 'app');
const OUT_ROOT = path.join(ROOT, 'dist', 'desktop');
const APP_NAME = '出入库存工作台';
const pkg = require('./package.json');

/* Electron 二进制缓存包：packager 默认联网下载，证书受限环境会失败。
   本机已有 node_modules/electron/dist 时，自动压成 electronZipDir 需要的 zip。 */
function ensureElectronZip() {
  const ver = require(path.join(DESK, 'node_modules', 'electron', 'package.json')).version;
  const cacheDir = path.join(DESK, '.cache');
  const zip = path.join(cacheDir, 'electron-v' + ver + '-win32-x64.zip');
  if (fs.existsSync(zip)) return zip;
  const dist = path.join(DESK, 'node_modules', 'electron', 'dist');
  if (!fs.existsSync(path.join(dist, 'electron.exe'))) {
    console.log('      [warn] 未找到 node_modules/electron/dist，将尝试联网下载');
    return null;
  }
  fs.mkdirSync(cacheDir, { recursive: true });
  console.log('      正在用本机 Electron 生成缓存包（首次约 10 秒）…');
  const script =
    'import os,zipfile;src=r"' + dist + '";dst=r"' + zip + '";' +
    'z=zipfile.ZipFile(dst,"w",zipfile.ZIP_DEFLATED,compresslevel=1);' +
    '[z.write(os.path.join(r,f),os.path.relpath(os.path.join(r,f),src)) for r,d,fs in os.walk(src) for f in fs];' +
    'z.close();print("ok")';
  execFileSync('python', ['-c', script], { stdio: 'ignore' });
  return fs.existsSync(zip) ? zip : null;
}

async function main() {
  /* 0. 准备 Electron 缓存包 */
  const electronZip = ensureElectronZip();
  if (electronZip) console.log('      使用本地 Electron 包 ' + path.basename(electronZip));

  /* 1. 同步页面：始终用最新的 index.html */
  fs.mkdirSync(APP_DIR, { recursive: true });
  await fsp.copyFile(path.join(ROOT, 'index.html'), path.join(APP_DIR, 'index.html'));
  const size = (await fsp.stat(path.join(APP_DIR, 'index.html'))).size;
  console.log('[1/3] 页面已同步 app/index.html  ' + (size / 1024).toFixed(0) + ' KB');

  /* 2. 打包 */
  const paths = await packager({
    dir: DESK,
    out: OUT_ROOT,
    name: APP_NAME,
    appVersion: pkg.version,
    platform: 'win32',
    arch: 'x64',
    icon: path.join(DESK, 'assets', 'icon.ico'),
    asar: true,
    overwrite: true,
    /* 不联网下载 Electron：用本机 node_modules 里已装好的二进制（见 .cache/） */
    electronZipDir: electronZip ? path.dirname(electronZip) : undefined,
    prune: true,
    appCopyright: '',
    win32metadata: {
      CompanyName: 'WMS',
      FileDescription: '出入库存管理工作台 · 本地客户端',
      ProductName: APP_NAME,
      InternalName: 'WMSWorkbench',
      OriginalFilename: APP_NAME + '.exe'
    },
    /* 必须排除：打包缓存（166MB 的 Electron zip）、开发依赖目录 */
    ignore: [
      /^\/\.cache($|\/)/,
      /^\/node_modules($|\/)/,
      /^\/build\.js$/,
      /^\/make-icon\.py$/,
      /^\/README\.md$/,
      /^\/_zip_electron\.py$/,
      /^\/_fix_build\.py$/,
      /^\/dist($|\/)/
    ]
  });
  const outDir = paths[0];
  console.log('[2/3] 已打包 ' + outDir);

  /* 3. 体积统计（语言包保留全量，避免批量删除触发安全策略） */
  const asar = path.join(outDir, 'resources', 'app.asar');
  const asarSize = fs.existsSync(asar) ? (await fsp.stat(asar)).size : 0;
  console.log('      app.asar ' + (asarSize / 1024).toFixed(0) + ' KB');

  const rawExe = path.join(outDir, APP_NAME + '.exe');
  /* 需求：每次打包在 exe 名字后带版本号，便于区分多版本（数据目录不受影响） */
  const versionedExe = path.join(outDir, APP_NAME + '_v' + pkg.version + '.exe');
  if (fs.existsSync(rawExe)) {
    if (fs.existsSync(versionedExe)) await fsp.rm(versionedExe, { force: true });
    await fsp.rename(rawExe, versionedExe);
  }
  const exe = fs.existsSync(versionedExe) ? versionedExe : rawExe;
  const st = await fsp.stat(exe);
  console.log('[3/3] 主程序 ' + (st.size / 1048576).toFixed(1) + ' MB  ' + exe);

  /* 4. 压缩为 zip（用 PowerShell 的 Compress-Archive，避免额外依赖） */
  const zip = path.join(ROOT, 'dist', APP_NAME + '_v' + pkg.version + '_桌面客户端.zip');
  await fsp.rm(zip, { force: true });
  try {
    execFileSync('powershell.exe', [
      '-NoProfile', '-NonInteractive', '-Command',
      'Compress-Archive -Path "' + outDir + '" -DestinationPath "' + zip + '" -CompressionLevel Optimal -Force'
    ], { stdio: 'inherit' });
    const zs = await fsp.stat(zip);
    console.log('      压缩包 ' + (zs.size / 1048576).toFixed(1) + ' MB  ' + zip);
  } catch (e) {
    console.log('      压缩失败（不影响 exe）：' + e.message);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
