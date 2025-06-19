const path = require('path');
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const { spawn } = require('child_process');

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  win.loadFile('renderer/index.html');

  win.once('ready-to-show', () => {
    win.show();
    win.webContents.send('auto-start-sync');
  });
}

app.whenReady().then(createWindow);

ipcMain.handle('start-sync', async (event) => {
  const { syncViaZip } = require('./src/httpZipSync'); 
  const execBase = process.env.PORTABLE_EXECUTABLE_DIR || process.cwd();
  return await syncViaZip(execBase, (msg) => {
    event.sender.send('sync-progress', msg);
  }, (percent) => {
    event.sender.send('sync-progress-percent', percent);
    if (percent >= 100) {
      event.sender.send('update-complete');
    }
  });
});

ipcMain.on('launch-game', () => {
  const baseDir = process.env.PORTABLE_EXECUTABLE_DIR || process.cwd();
  const exePath = path.join(baseDir, 'endless.exe');
  shell.openPath(exePath);
  app.quit();
});

