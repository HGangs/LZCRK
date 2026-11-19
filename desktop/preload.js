'use strict';
/**
 * 预加载脚本：只向页面暴露一个最小化的 desktopHost 对象。
 * contextIsolation=true，页面拿不到 Node/Electron 原生对象，只看到下面这些方法。
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopHost', {
  isDesktop: true,

  /* 版本、数据目录、当前备份目录 */
  info: () => ipcRenderer.invoke('app-info'),

  /* 原生目录选择（替代浏览器 File System Access API） */
  pickDir: () => ipcRenderer.invoke('pick-dir'),
  clearDir: () => ipcRenderer.invoke('clear-dir'),
  getDir: () => ipcRenderer.invoke('get-dir'),

  /* 把备份 JSON 真正写到本机目录：{ type:'auto'|'manual', name, text } */
  writeBackup: (req) => ipcRenderer.invoke('write-backup', req),

  /* 菜单「导入数据备份」→ 页面收到 { text, name } */
  onBackupFile: (cb) => {
    if (typeof cb !== 'function') return;
    ipcRenderer.on('backup-file', (e, payload) => {
      try {
        cb(payload);
      } catch (err) {
        /* 页面异常不影响主进程 */
      }
    });
  },

  openPath: (p) => ipcRenderer.invoke('open-path', p)
});
