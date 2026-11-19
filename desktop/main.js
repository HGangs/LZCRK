'use strict';
/**
 * 出入库存工作台 · 桌面客户端主进程
 * - 离线运行 app/index.html（单文件页面，数据存 userData 的 localStorage）
 * - 备份目录用系统对话框选择，直接写盘（Electron 没有 File System Access API）
 * - 菜单「导入数据备份」把 JSON 文本交给页面，走页面原有的导入/恢复流程
 */
const { app, BrowserWindow, dialog, ipcMain, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;

const APP_TITLE = '出入库存工作台';
const ROOT = __dirname;
const PAGE = path.join(ROOT, 'app', 'index.html');
const ICON = path.join(ROOT, 'assets', 'icon.png');

let win = null;
let saveWinTimer = null;

const SELFTEST_JS = `(async function(){
  var out = { localStorage: false, loggedIn: false, dirReady: false, writeOk: false, imported: false };
  try{
    /* 1. localStorage 可写 + 上次运行的标记 */
    out.persistPrev = localStorage.getItem('__selftest_persist__') || '';
    localStorage.setItem('__selftest_persist__', String(Date.now()));
    out.localStorage = true;

    /* 2. 登录超管 */
    showLogin();
    document.querySelector('#lg-account').value = 'admin';
    document.querySelector('#lg-pwd').value = 'sl' + '123456';
    doLogin();
    out.loggedIn = !!currentUser();
    out.user = currentUser() ? currentUser().name : '';

    /* 3. 备份目录（主进程已指向临时目录） */
    var h = await loadBackupDirHandle();
    out.dirReady = !!(h && h.desktop);
    out.dirName = h ? h.name : '';

    /* 4. 真实写盘 */
    var item = { type: 'manual', payload: JSON.parse(JSON.stringify(db)), createdAt: nowTs(), path: '' };
    var r = await writeBackupFile(item, { ask: true });
    out.writeOk = !!(r && r.ok);
    out.writePath = (r && r.path) || (r && r.reason) || '';

    /* 5. 备份文件导入（走菜单同一条链路） */
    var before = backups.length;
    await importBackupText(JSON.stringify({ payload: JSON.parse(JSON.stringify(db)) }), 'selftest.json');
    out.imported = backups.length > before;
    out.backupCount = backups.length;

    /* 6. 页面基本渲染 */
    out.navCount = document.querySelectorAll('.nav-item').length;
    out.pageTitle = (document.querySelector('#pageTitle') || {}).textContent || '';
    return JSON.stringify(out);
  }catch(e){
    out.error = e && e.message ? e.message : String(e);
    return JSON.stringify(out);
  }
})()`;

/* ---------- 本机配置（窗口位置、备份目录） ---------- */
function cfgFile() {
  return path.join(app.getPath('userData'), 'desktop-config.json');
}
function readCfg() {
  try {
    return JSON.parse(fs.readFileSync(cfgFile(), 'utf8')) || {};
  } catch (e) {
    return {};
  }
}
function writeCfg(patch) {
  const c = Object.assign(readCfg(), patch || {});
  try {
    fs.mkdirSync(path.dirname(cfgFile()), { recursive: true });
    fs.writeFileSync(cfgFile(), JSON.stringify(c, null, 2), 'utf8');
  } catch (e) {
    /* 配置写失败不影响主流程 */
  }
  return c;
}
function backupDir() {
  const p = readCfg().backupDir;
  try {
    return p && fs.statSync(p).isDirectory() ? p : '';
  } catch (e) {
    return '';
  }
}
function sanitizeName(n) {
  const s = String(n || '').replace(/[\\/:*?"<>|]/g, '_').replace(/^\.+/, '').slice(0, 180);
  return s || 'wms_backup_' + Date.now() + '.json';
}

/* ---------- 窗口 ---------- */
function scheduleSaveWin() {
  clearTimeout(saveWinTimer);
  saveWinTimer = setTimeout(saveWinState, 500);
}
function saveWinState() {
  if (!win || win.isDestroyed()) return;
  const maximized = win.isMaximized();
  const b = maximized ? readCfg().window || {} : win.getNormalBounds();
  writeCfg({
    window: { width: b.width, height: b.height, x: b.x, y: b.y, maximized }
  });
}

function createWindow() {
  const st = readCfg().window || {};
  win = new BrowserWindow({
    width: Math.max(1100, st.width || 1440),
    height: Math.max(720, st.height || 900),
    x: typeof st.x === 'number' ? st.x : undefined,
    y: typeof st.y === 'number' ? st.y : undefined,
    minWidth: 1100,
    minHeight: 720,
    title: APP_TITLE,
    icon: ICON,
    backgroundColor: '#eef2f8',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(ROOT, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false
    }
  });

  const SELFTEST = process.argv.includes('--selftest');
  if (st.maximized && !SELFTEST) win.maximize();
  win.once('ready-to-show', () => {
    if (SELFTEST) win.showInactive();
    else win.show();
  });

  if (SELFTEST) {
    const tmp = path.join(app.getPath('temp'), 'wms-selftest-backup');
    try {
      fs.mkdirSync(tmp, { recursive: true });
      writeCfg({ backupDir: tmp });
    } catch (e) {}
    win.webContents.once('did-finish-load', async () => {
      await new Promise((r) => setTimeout(r, 1500));
      try {
        const shot = await win.webContents.capturePage();
        fs.writeFileSync(path.join(app.getPath('userData'), 'selftest.png'), shot.toPNG());
      } catch (e) {}
      try {
        const out = await win.webContents.executeJavaScript(SELFTEST_JS);
        try {
          fs.writeFileSync(path.join(app.getPath('userData'), 'selftest.json'), out, 'utf8');
          const tmp = path.join(app.getPath('temp'), 'wms-selftest-backup');
          const files = [];
          for (const sub of ['manual', 'auto']) {
            const d = path.join(tmp, sub);
            if (fs.existsSync(d)) for (const f of fs.readdirSync(d)) files.push(sub + '/' + f);
          }
          fs.writeFileSync(path.join(app.getPath('userData'), 'selftest-files.json'), JSON.stringify(files), 'utf8');
        } catch (e) {}
        console.log('SELFTEST ' + out);
      } catch (e) {
        console.log('SELFTEST_ERR ' + ((e && e.message) || e));
      }
      app.exit(0);
    });
  }
  win.loadFile(PAGE);

  win.on('resize', scheduleSaveWin);
  win.on('move', scheduleSaveWin);
  win.on('close', saveWinState);
  win.on('closed', () => {
    win = null;
  });

  /* 外链走系统浏览器；页面内部不做跳转 */
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('file://')) {
      e.preventDefault();
      if (/^https?:/i.test(url)) shell.openExternal(url);
    }
  });
  /* 拖入文件不触发页面导航（文件导入走页面内的选择器/菜单） */
  win.webContents.on('will-frame-navigate', (e) => {
    if (e.isMainFrame) e.preventDefault();
  });
  if (process.argv.includes('--dev')) win.webContents.openDevTools({ mode: 'detach' });
}

/* ---------- 菜单 ---------- */
async function menuImport() {
  if (!win) return;
  const r = await dialog.showOpenDialog(win, {
    title: '导入数据备份',
    buttonLabel: '导入',
    filters: [{ name: '工作台备份文件', extensions: ['json'] }],
    properties: ['openFile']
  });
  if (r.canceled || !r.filePaths[0]) return;
  try {
    const text = await fsp.readFile(r.filePaths[0], 'utf8');
    win.webContents.send('backup-file', { text, name: path.basename(r.filePaths[0]) });
  } catch (e) {
    dialog.showMessageBox(win, {
      type: 'error',
      message: '读取备份文件失败',
      detail: String((e && e.message) || e)
    });
  }
}

function showAbout() {
  const dir = app.getPath('userData');
  dialog
    .showMessageBox(win, {
      type: 'info',
      title: '关于',
      message: APP_TITLE + '  v' + app.getVersion(),
      detail:
        '本地客户端 · 离线运行，数据保存在本机\n\n' +
        '数据目录：' + dir + '\n' +
        'Electron ' + process.versions.electron + ' / Chromium ' + process.versions.chrome,
      buttons: ['打开数据目录', '确定'],
      defaultId: 1,
      cancelId: 1
    })
    .then((r) => {
      if (r.response === 0) shell.openPath(dir);
    });
}

function openBackupDir() {
  const d = backupDir();
  if (d) {
    shell.openPath(d);
    return;
  }
  dialog.showMessageBox(win, {
    type: 'info',
    message: '尚未连接本机备份目录',
    detail: '请到「系统管理 → 数据备份 → 备份设置」里点「选择目录」。',
    buttons: ['确定']
  });
}

function buildMenu() {
  const tpl = [
    {
      label: '文件',
      submenu: [
        { label: '导入数据备份…', accelerator: 'CmdOrCtrl+I', click: () => menuImport() },
        { type: 'separator' },
        { label: '打开备份目录', click: () => openBackupDir() },
        { label: '打开数据目录', click: () => shell.openPath(app.getPath('userData')) },
        { type: 'separator' },
        { label: '退出', role: 'quit' }
      ]
    },
    {
      label: '编辑',
      submenu: [
        { label: '撤销', role: 'undo' },
        { label: '重做', role: 'redo' },
        { type: 'separator' },
        { label: '剪切', role: 'cut' },
        { label: '复制', role: 'copy' },
        { label: '粘贴', role: 'paste' },
        { label: '全选', role: 'selectAll' }
      ]
    },
    {
      label: '视图',
      submenu: [
        { label: '重新加载', accelerator: 'CmdOrCtrl+R', click: () => win && win.reload() },
        { type: 'separator' },
        { label: '实际大小', role: 'resetZoom' },
        { label: '放大', role: 'zoomIn' },
        { label: '缩小', role: 'zoomOut' },
        { type: 'separator' },
        { label: '开发者工具', accelerator: 'F12', click: () => win && win.webContents.toggleDevTools() }
      ]
    },
    {
      label: '帮助',
      submenu: [{ label: '关于', click: () => showAbout() }]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(tpl));
}

/* ---------- IPC ---------- */
ipcMain.handle('app-info', () => {
  const d = backupDir();
  return {
    desktop: true,
    version: app.getVersion(),
    userData: app.getPath('userData'),
    backupDir: d,
    backupDirName: d ? path.basename(d) : ''
  };
});

ipcMain.handle('pick-dir', async () => {
  const r = await dialog.showOpenDialog(win, {
    title: '选择本机备份目录',
    buttonLabel: '使用此目录',
    properties: ['openDirectory', 'createDirectory']
  });
  if (r.canceled || !r.filePaths[0]) return { ok: false, canceled: true };
  const p = r.filePaths[0];
  writeCfg({ backupDir: p });
  try {
    await fsp.mkdir(path.join(p, 'manual'), { recursive: true });
    await fsp.mkdir(path.join(p, 'auto'), { recursive: true });
  } catch (e) {
    /* 目录不可写时 write-backup 会返回错误 */
  }
  return { ok: true, path: p, name: path.basename(p) };
});

ipcMain.handle('clear-dir', () => {
  writeCfg({ backupDir: '' });
  return { ok: true };
});

ipcMain.handle('get-dir', () => {
  const d = backupDir();
  return d ? { ok: true, path: d, name: path.basename(d) } : { ok: false };
});

ipcMain.handle('write-backup', async (e, req) => {
  const base = backupDir();
  if (!base) return { ok: false, reason: 'no-dir' };
  try {
    const sub = req && req.type === 'auto' ? 'auto' : 'manual';
    const dir = path.join(base, sub);
    await fsp.mkdir(dir, { recursive: true });
    const file = path.join(dir, sanitizeName(req && req.name));
    await fsp.writeFile(file, String((req && req.text) || ''), 'utf8');
    return {
      ok: true,
      path: path.basename(base) + '/' + sub + '/' + path.basename(file)
    };
  } catch (err) {
    return { ok: false, reason: 'error', message: String((err && err.message) || err) };
  }
});

ipcMain.handle('open-path', async (e, p) => {
  if (!p) return { ok: false };
  const r = await shell.openPath(String(p));
  return { ok: !r, message: r || '' };
});

/* ---------- 生命周期 ---------- */
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(() => {
    app.setAppUserModelId('com.wms.workbench');
    buildMenu();
    createWindow();
  });

  app.on('window-all-closed', () => app.quit());
}
