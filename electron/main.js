import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import { getEdgeTtsVoices, synthesizeEdgeTts } from './edgeTts.js';

const isDev = process.argv.includes('--dev');

app.setPath('userData', path.join(app.getPath('temp'), 'flipbook-react-electron'));

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 900,
    minWidth: 1024,
    minHeight: 720,
    backgroundColor: '#111111',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(app.getAppPath(), 'electron', 'preload.cjs'),
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://127.0.0.1:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
    return mainWindow;
  }

  const indexHtml = path.join(app.getAppPath(), 'dist', 'index.html');
  mainWindow.loadFile(indexHtml).catch((error) => {
    console.error('Failed to load Electron production bundle:', error);
    app.quit();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  return mainWindow;
}

ipcMain.handle('edge-tts:synthesize', async (_event, payload) => {
  const text = typeof payload?.text === 'string' ? payload.text : '';
  return synthesizeEdgeTts(text, {
    voice: payload?.voice || 'vi-VN-HoaiMyNeural',
    rate: payload?.rate || '',
    pitch: payload?.pitch || '',
    volume: payload?.volume || '',
  });
});

ipcMain.handle('edge-tts:get-voices', async () => {
  return getEdgeTtsVoices();
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
