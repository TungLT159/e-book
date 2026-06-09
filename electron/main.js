import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import { rm, stat } from 'node:fs/promises';
import {
  getEdgeTtsVoices,
  getOrCreateEdgeTtsAudioCacheFile,
  prepareEdgeTtsAudioCacheFile,
  synthesizeEdgeTts,
} from './edgeTts.js';
import {
  emptyExtractedTextFile,
  readExtractedTextPage,
  validateExtractedTextFile,
  writeExtractedTextDebug,
} from './extractedTextDebug.js';

const isDev = process.argv.includes('--dev');

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
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

ipcMain.handle('audio-cache:get-or-create-edge-tts-audio-cache-file', async (_event, payload) => {
  return getOrCreateEdgeTtsAudioCacheFile({
    userDataPath: app.getPath('userData'),
    bookKey: typeof payload?.bookKey === 'string' ? payload.bookKey : '',
    voice: typeof payload?.voice === 'string' ? payload.voice : '',
    rate: typeof payload?.rate === 'string' ? payload.rate : '',
    chunkIndex: Number(payload?.chunkIndex || 0),
    chunkText: typeof payload?.chunkText === 'string' ? payload.chunkText : '',
    lookup: async ({ audioPath, ttlMs }) => {
      try {
        const audioStats = await stat(audioPath);
        const isFresh = Number(audioStats.mtimeMs) >= Date.now() - ttlMs;

        if (isFresh) {
          return { audioPath, cacheHit: true };
        }

        await rm(audioPath, { force: true });
        return { cacheHit: false };
      } catch (error) {
        if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
          return { cacheHit: false };
        }

        throw error;
      }
    },
  });
});

ipcMain.handle('audio-cache:prepare-edge-tts-audio-cache-file', async (_event, payload) => {
  return prepareEdgeTtsAudioCacheFile({
    userDataPath: app.getPath('userData'),
    bookKey: typeof payload?.bookKey === 'string' ? payload.bookKey : '',
    voice: typeof payload?.voice === 'string' ? payload.voice : '',
    rate: typeof payload?.rate === 'string' ? payload.rate : '',
    chunkIndex: Number(payload?.chunkIndex || 0),
    chunkText: typeof payload?.chunkText === 'string' ? payload.chunkText : '',
    lookup: async ({ audioPath, ttlMs }) => {
      try {
        const audioStats = await stat(audioPath);
        const isFresh = Number(audioStats.mtimeMs) >= Date.now() - ttlMs;

        if (isFresh) {
          return { audioPath, cacheHit: true };
        }

        await rm(audioPath, { force: true });
        return { cacheHit: false };
      } catch (error) {
        if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
          return { cacheHit: false };
        }

        throw error;
      }
    },
  });
});

ipcMain.handle('debug:write-extracted-text', async (_event, payload) => {
  const outputPath = await writeExtractedTextDebug(app.getPath('userData'), payload);
  console.log('Extracted PDF text written to:', outputPath);
  return outputPath;
});

ipcMain.handle('debug:read-extracted-text-page', async (_event, payload) => {
  const filePath = typeof payload?.filePath === 'string' ? payload.filePath.trim() : '';
  const validatedFile = await validateExtractedTextFile(app.getPath('userData'), filePath);
  return readExtractedTextPage(validatedFile, Number(payload?.pageNumber || 0));
});

ipcMain.handle('debug:empty-extracted-text-file', async (_event, payload) => {
  const filePath = typeof payload?.filePath === 'string' ? payload.filePath.trim() : '';
  const validatedFile = await validateExtractedTextFile(app.getPath('userData'), filePath);
  await emptyExtractedTextFile(validatedFile);
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
