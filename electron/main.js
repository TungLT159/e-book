import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import { readFile, rm, stat, writeFile } from 'node:fs/promises';
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
let readingProgressMutationQueue = Promise.resolve();

function getReadingProgressPath() {
  return path.join(app.getPath('userData'), 'reading-progress.json');
}

function createEmptyReadingProgressStore() {
  return { version: 1, updatedAt: new Date().toISOString(), books: {} };
}

function normalizeReadingProgressRecord(payload) {
  const lastOpenedAtTimestamp = typeof payload?.lastOpenedAt === 'string'
    ? Date.parse(payload.lastOpenedAt)
    : Number.NaN;
  if (
    !payload
    || typeof payload !== 'object'
    || typeof payload.bookId !== 'string'
    || payload.bookId.trim() === ''
    || !Number.isInteger(payload.lastPageIndex)
    || payload.lastPageIndex < 0
    || !Number.isFinite(payload.progressPercent)
    || payload.progressPercent < 0
    || payload.progressPercent > 100
    || typeof payload.completed !== 'boolean'
    || typeof payload.lastOpenedAt !== 'string'
    || !Number.isFinite(lastOpenedAtTimestamp)
    || new Date(lastOpenedAtTimestamp).toISOString() !== payload.lastOpenedAt
  ) {
    return null;
  }

  return {
    bookId: payload.bookId.trim(),
    lastPageIndex: payload.lastPageIndex,
    progressPercent: payload.progressPercent,
    completed: payload.completed,
    lastOpenedAt: payload.lastOpenedAt,
  };
}

function normalizeReadingProgressStore(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || value.version !== 1) {
    return createEmptyReadingProgressStore();
  }

  if (!value.books || typeof value.books !== 'object' || Array.isArray(value.books)) {
    return createEmptyReadingProgressStore();
  }

  const books = Object.entries(value.books).reduce((store, [bookId, record]) => {
    const normalizedRecord = normalizeReadingProgressRecord(record);
    if (normalizedRecord && normalizedRecord.bookId === bookId) {
      store[bookId] = normalizedRecord;
    }
    return store;
  }, {});

  return {
    version: 1,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : new Date().toISOString(),
    books,
  };
}

async function readReadingProgressStore() {
  try {
    const contents = await readFile(getReadingProgressPath(), 'utf8');
    return normalizeReadingProgressStore(JSON.parse(contents));
  } catch (error) {
    if (error instanceof SyntaxError) {
      return createEmptyReadingProgressStore();
    }

    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return createEmptyReadingProgressStore();
    }

    throw error;
  }
}

async function writeReadingProgressStore(store) {
  await writeFile(getReadingProgressPath(), JSON.stringify(store, null, 2), 'utf8');
}

function enqueueReadingProgressMutation(mutation) {
  const result = readingProgressMutationQueue.then(mutation);
  readingProgressMutationQueue = result.catch(() => {});
  return result;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 900,
    minWidth: 1024,
    minHeight: 720,
    backgroundColor: '#111111',
    autoHideMenuBar: true,
    icon: path.join(app.getAppPath(), 'public', 'iiticon.ico'),
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
    volume: typeof payload?.volume === 'string' ? payload.volume : '',
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
    volume: typeof payload?.volume === 'string' ? payload.volume : '',
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

ipcMain.handle('reading-progress:get-all', async () => {
  return readReadingProgressStore();
});

ipcMain.handle('reading-progress:save', async (_event, payload) => {
  return enqueueReadingProgressMutation(async () => {
    const store = await readReadingProgressStore();
    const record = normalizeReadingProgressRecord(payload);
    if (!record) {
      return store;
    }

    const nextStore = {
      version: 1,
      updatedAt: new Date().toISOString(),
      books: { ...store.books, [record.bookId]: record },
    };
    await writeReadingProgressStore(nextStore);
    return nextStore;
  });
});

ipcMain.handle('reading-progress:delete', async (_event, bookId) => {
  return enqueueReadingProgressMutation(async () => {
    const store = await readReadingProgressStore();
    if (typeof bookId !== 'string' || bookId.trim() === '') {
      return store;
    }

    const trimmedBookId = bookId.trim();
    const { [trimmedBookId]: _deleted, ...books } = store.books;
    const nextStore = { version: 1, updatedAt: new Date().toISOString(), books };
    await writeReadingProgressStore(nextStore);
    return nextStore;
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
  if (process.platform === 'win32') {
    app.setAppUserModelId(app.getName());
  }
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
