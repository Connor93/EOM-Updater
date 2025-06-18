const path = require('path');
const { app, BrowserWindow, ipcMain } = require('electron');
const { syncViaZip } = require('./src/httpZipSync');

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: { nodeIntegration: true, contextIsolation: false }
  });
  win.loadFile('renderer/index.html');

  win.webContents.once('did-finish-load', () => {
    win.webContents.send('auto-start-sync');
  });
}

app.whenReady().then(createWindow);

ipcMain.handle('start-sync', async (event) => {
  // Use the folder where the .exe is located (portable app folder)
  const execBase = process.env.PORTABLE_EXECUTABLE_DIR;
  return await syncViaZip(execBase, (msg) => {
    event.sender.send('sync-progress', msg);
  }, (percent) => {
    event.sender.send('sync-progress-percent', percent);
  });
});
