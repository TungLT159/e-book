import { describe, expect, it, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => {
  const stat = vi.fn();
  const rm = vi.fn();
  const readFile = vi.fn();
  const writeFile = vi.fn();
  const handle = vi.fn();
  const prepareEdgeTtsAudioCacheFile = vi.fn();
  const commandLine = { appendSwitch: vi.fn() };
  const app = {
    commandLine,
    setPath: vi.fn(),
    getPath: vi.fn(() => 'C:\\Temp\\flipbook-react-electron'),
    getAppPath: vi.fn(() => 'C:\\App'),
    getName: vi.fn(() => 'Flipbook React'),
    setAppUserModelId: vi.fn(),
    whenReady: vi.fn(() => Promise.resolve()),
    on: vi.fn(),
    quit: vi.fn(),
  };

  class BrowserWindow {
    loadURL = vi.fn();
    webContents = { openDevTools: vi.fn() };
    loadFile = vi.fn(() => Promise.resolve());
    on = vi.fn();
  }

  return { stat, rm, readFile, writeFile, handle, prepareEdgeTtsAudioCacheFile, commandLine, app, BrowserWindow };
});

vi.mock('electron', () => ({
  app: mocks.app,
  BrowserWindow: mocks.BrowserWindow,
  ipcMain: { handle: mocks.handle },
}));

vi.mock('node:fs/promises', () => ({
  stat: mocks.stat,
  rm: mocks.rm,
  readFile: mocks.readFile,
  writeFile: mocks.writeFile,
  default: { stat: mocks.stat, rm: mocks.rm, readFile: mocks.readFile, writeFile: mocks.writeFile },
}));

vi.mock('./edgeTts.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./edgeTts.js')>();

  return {
    ...actual,
    prepareEdgeTtsAudioCacheFile: mocks.prepareEdgeTtsAudioCacheFile,
  };
});

describe('audio cache ipc bridge', () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.stat.mockReset();
    mocks.rm.mockReset();
    mocks.readFile.mockReset();
    mocks.writeFile.mockReset();
    mocks.handle.mockReset();
    mocks.prepareEdgeTtsAudioCacheFile.mockReset();
    mocks.commandLine.appendSwitch.mockReset();
    mocks.app.setPath.mockReset();
    mocks.app.getPath.mockReturnValue('C:\\Temp\\flipbook-react-electron');
    mocks.app.getAppPath.mockReturnValue('C:\\App');
    mocks.app.getName.mockReturnValue('Flipbook React');
    mocks.app.setAppUserModelId.mockReset();
  });

  it('registers the Windows app user model id when Electron is ready', async () => {
    await import('./main.js');
    await Promise.resolve();

    expect(mocks.app.getName).toHaveBeenCalledTimes(1);
    expect(mocks.app.setAppUserModelId).toHaveBeenCalledWith('Flipbook React');
  });

  it('returns a cache hit when the mp3 is fresh', async () => {
    const now = Date.now();
    mocks.stat.mockResolvedValue({ mtimeMs: now } as never);

    await import('./main.js');

    const handler = mocks.handle.mock.calls.find(
      ([channel]) => channel === 'audio-cache:get-or-create-edge-tts-audio-cache-file',
    )?.[1] as (event: unknown, payload: {
      bookKey: string;
      voice: string;
      rate: string;
      chunkIndex: number;
      chunkText: string;
    }) => Promise<{ audioPath: string; audioUrl: string; cacheHit: boolean }>;

    await expect(
      handler(null, {
        bookKey: 'Demo book',
        voice: 'vi-VN-HoaiMyNeural',
        rate: '',
        chunkIndex: 0,
        chunkText: 'Nội dung đọc từ file text trang một',
      }),
    ).resolves.toEqual({
      audioPath: expect.stringContaining('C:\\Temp\\flipbook-react-electron\\narration-audio\\Demo book\\vi-VN-HoaiMyNeural\\__default__\\chunk-0-'),
      audioUrl: expect.stringMatching(/^file:\/\/\/C:\/Temp\/flipbook-react-electron\/narration-audio\//),
      cacheHit: true,
    });
    expect(mocks.stat).toHaveBeenCalledTimes(1);
  });

  it('registers prepare edge tts audio cache file with sanitized payload values', async () => {
    const now = Date.now();
    mocks.stat.mockResolvedValue({ mtimeMs: now } as never);
    mocks.prepareEdgeTtsAudioCacheFile.mockResolvedValue({
      audioPath: 'C:\\Temp\\flipbook-react-electron\\narration-audio\\prepared.mp3',
      audioUrl: 'file:///C:/Temp/flipbook-react-electron/narration-audio/prepared.mp3',
      cacheHit: true,
    } as never);

    await import('./main.js');

    const handler = mocks.handle.mock.calls.find(
      ([channel]) => channel === 'audio-cache:prepare-edge-tts-audio-cache-file',
    )?.[1] as (event: unknown, payload: {
      bookKey?: unknown;
      voice?: unknown;
      rate?: unknown;
      chunkIndex?: unknown;
      chunkText?: unknown;
    }) => Promise<{ audioPath: string; audioUrl: string; cacheHit: boolean }>;

    expect(handler).toBeTypeOf('function');

    await expect(
      handler(null, {
        bookKey: 123,
        voice: 'vi-VN-HoaiMyNeural',
        rate: null,
        chunkIndex: '2',
        chunkText: 'Nội dung đọc từ file text trang một',
      }),
    ).resolves.toEqual({
      audioPath: 'C:\\Temp\\flipbook-react-electron\\narration-audio\\prepared.mp3',
      audioUrl: 'file:///C:/Temp/flipbook-react-electron/narration-audio/prepared.mp3',
      cacheHit: true,
    });

    expect(mocks.prepareEdgeTtsAudioCacheFile).toHaveBeenCalledWith({
      userDataPath: 'C:\\Temp\\flipbook-react-electron',
      bookKey: '',
      voice: 'vi-VN-HoaiMyNeural',
      rate: '',
      chunkIndex: 2,
      chunkText: 'Nội dung đọc từ file text trang một',
      lookup: expect.any(Function),
    });
  });

  it('returns a cache miss when the mp3 is stale', async () => {
    const now = Date.now();
    mocks.stat.mockResolvedValueOnce({ mtimeMs: now - (31 * 24 * 60 * 60 * 1000) } as never);

    await import('./main.js');

    const handler = mocks.handle.mock.calls.find(
      ([channel]) => channel === 'audio-cache:get-or-create-edge-tts-audio-cache-file',
    )?.[1] as (event: unknown, payload: {
      bookKey: string;
      voice: string;
      rate: string;
      chunkIndex: number;
      chunkText: string;
    }) => Promise<{ audioPath: string; audioUrl: string; cacheHit: boolean }>;

    await expect(
      handler(null, {
        bookKey: 'Demo book',
        voice: 'vi-VN-HoaiMyNeural',
        rate: '',
        chunkIndex: 0,
        chunkText: 'Nội dung đọc từ file text trang một',
      }),
    ).resolves.toEqual({
      audioPath: expect.stringContaining('C:\\Temp\\flipbook-react-electron\\narration-audio\\Demo book\\vi-VN-HoaiMyNeural\\__default__\\chunk-0-'),
      audioUrl: expect.stringMatching(/^file:\/\/\/C:\/Temp\/flipbook-react-electron\/narration-audio\//),
      cacheHit: false,
    });
    expect(mocks.stat).toHaveBeenCalledTimes(1);
    expect(mocks.rm).toHaveBeenCalledWith(
      expect.stringContaining('C:\\Temp\\flipbook-react-electron\\narration-audio\\Demo book\\vi-VN-HoaiMyNeural\\__default__\\chunk-0-'),
      expect.objectContaining({ force: true }),
    );
  });

  it('does not prune fresh cache files', async () => {
    const now = Date.now();
    mocks.stat.mockResolvedValueOnce({ mtimeMs: now } as never);

    await import('./main.js');

    const handler = mocks.handle.mock.calls.find(
      ([channel]) => channel === 'audio-cache:get-or-create-edge-tts-audio-cache-file',
    )?.[1] as (event: unknown, payload: {
      bookKey: string;
      voice: string;
      rate: string;
      chunkIndex: number;
      chunkText: string;
    }) => Promise<{ audioPath: string; audioUrl: string; cacheHit: boolean }>;

    await expect(
      handler(null, {
        bookKey: 'Demo book',
        voice: 'vi-VN-HoaiMyNeural',
        rate: '',
        chunkIndex: 0,
        chunkText: 'Nội dung đọc từ file text trang một',
      }),
    ).resolves.toEqual({
      audioPath: expect.stringContaining('C:\\Temp\\flipbook-react-electron\\narration-audio\\Demo book\\vi-VN-HoaiMyNeural\\__default__\\chunk-0-'),
      audioUrl: expect.stringMatching(/^file:\/\/\/C:\/Temp\/flipbook-react-electron\/narration-audio\//),
      cacheHit: true,
    });
    expect(mocks.rm).not.toHaveBeenCalled();
  });

  it('returns a cache miss when the mp3 is missing', async () => {
    mocks.stat.mockRejectedValueOnce(Object.assign(new Error('missing'), { code: 'ENOENT' }));

    await import('./main.js');

    const handler = mocks.handle.mock.calls.find(
      ([channel]) => channel === 'audio-cache:get-or-create-edge-tts-audio-cache-file',
    )?.[1] as (event: unknown, payload: {
      bookKey: string;
      voice: string;
      rate: string;
      chunkIndex: number;
      chunkText: string;
    }) => Promise<{ audioPath: string; audioUrl: string; cacheHit: boolean }>;

    await expect(
      handler(null, {
        bookKey: 'Demo book',
        voice: 'vi-VN-HoaiMyNeural',
        rate: '',
        chunkIndex: 0,
        chunkText: 'Nội dung đọc từ file text trang một',
      }),
    ).resolves.toEqual({
      audioPath: expect.stringContaining('C:\\Temp\\flipbook-react-electron\\narration-audio\\Demo book\\vi-VN-HoaiMyNeural\\__default__\\chunk-0-'),
      audioUrl: expect.stringMatching(/^file:\/\/\/C:\/Temp\/flipbook-react-electron\/narration-audio\//),
      cacheHit: false,
    });
    expect(mocks.stat).toHaveBeenCalledTimes(1);
  });
});

describe('reading progress ipc bridge', () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.stat.mockReset();
    mocks.rm.mockReset();
    mocks.readFile.mockReset();
    mocks.writeFile.mockReset();
    mocks.handle.mockReset();
    mocks.prepareEdgeTtsAudioCacheFile.mockReset();
    mocks.commandLine.appendSwitch.mockReset();
    mocks.app.setPath.mockReset();
    mocks.app.getPath.mockReturnValue('C:\\Temp\\flipbook-react-electron');
    mocks.app.getAppPath.mockReturnValue('C:\\App');
  });

  const importMainAndGetHandler = async <THandler extends (...args: never[]) => unknown>(channel: string) => {
    await import('./main.js');
    const handler = mocks.handle.mock.calls.find(([registeredChannel]) => registeredChannel === channel)?.[1];
    expect(handler).toBeTypeOf('function');
    return handler as THandler;
  };

  const expectIsoString = (value: unknown) => {
    expect(value).toEqual(expect.any(String));
    expect(Number.isNaN(Date.parse(value as string))).toBe(false);
  };

  const expectEmptyStoreWrapper = (store: unknown) => {
    expect(store).toEqual({ version: 1, updatedAt: expect.any(String), books: {} });
    expectIsoString((store as { updatedAt: unknown }).updatedAt);
  };

  const validRecord = (bookId = 'book-a') => ({
    bookId,
    lastPageIndex: 4,
    progressPercent: 40,
    completed: false,
    lastOpenedAt: '2025-01-01T00:00:00.000Z',
  });

  const deferred = <T>() => {
    let resolve!: (value: T) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((resolvePromise, rejectPromise) => {
      resolve = resolvePromise;
      reject = rejectPromise;
    });
    return { promise, resolve, reject };
  };

  it('registers handlers for reading progress get-all, save, and delete', async () => {
    await import('./main.js');

    expect(mocks.handle).toHaveBeenCalledWith('reading-progress:get-all', expect.any(Function));
    expect(mocks.handle).toHaveBeenCalledWith('reading-progress:save', expect.any(Function));
    expect(mocks.handle).toHaveBeenCalledWith('reading-progress:delete', expect.any(Function));
  });

  it('returns an empty store when the reading progress file is missing', async () => {
    mocks.readFile.mockRejectedValueOnce(Object.assign(new Error('missing'), { code: 'ENOENT' }));

    const handler = await importMainAndGetHandler<() => Promise<Record<string, unknown>>>('reading-progress:get-all');

    const store = await handler();
    expectEmptyStoreWrapper(store);
    expect(mocks.readFile).toHaveBeenCalledWith(
      'C:\\Temp\\flipbook-react-electron\\reading-progress.json',
      'utf8',
    );
  });

  it('recovers to an empty store when the reading progress file is invalid JSON', async () => {
    mocks.readFile.mockResolvedValueOnce('not json');

    const handler = await importMainAndGetHandler<() => Promise<Record<string, unknown>>>('reading-progress:get-all');

    const store = await handler();
    expectEmptyStoreWrapper(store);
  });

  it('creates a reading progress record on first save', async () => {
    mocks.readFile.mockRejectedValueOnce(Object.assign(new Error('missing'), { code: 'ENOENT' }));

    const handler = await importMainAndGetHandler<(_event: unknown, payload: Record<string, unknown>) => Promise<Record<string, unknown>>>(
      'reading-progress:save',
    );

    const payload = {
      bookId: ' book-a ',
      lastPageIndex: 4,
      progressPercent: 40,
      completed: false,
      lastOpenedAt: '2025-01-01T00:00:00.000Z',
    };
    const expectedRecord = { ...payload, bookId: 'book-a' };
    const store = await handler(null, payload);

    expect(store).toEqual({ version: 1, updatedAt: expect.any(String), books: { 'book-a': expectedRecord } });
    expectIsoString((store as { updatedAt: unknown }).updatedAt);
    expect(mocks.writeFile).toHaveBeenCalledWith(
      'C:\\Temp\\flipbook-react-electron\\reading-progress.json',
      JSON.stringify(store, null, 2),
      'utf8',
    );
  });

  it('overwrites the existing record for the same bookId on later save', async () => {
    const bookB = {
      bookId: 'book-b',
      lastPageIndex: 8,
      progressPercent: 80,
      completed: false,
      lastOpenedAt: '2025-01-01T00:00:00.000Z',
    };
    const existing = {
      version: 1,
      updatedAt: '2025-01-01T00:00:00.000Z',
      books: {
        'book-a': {
          bookId: 'book-a',
          lastPageIndex: 1,
          progressPercent: 10,
          completed: false,
          lastOpenedAt: '2025-01-01T00:00:00.000Z',
        },
        'book-b': bookB,
      },
    };
    mocks.readFile.mockResolvedValueOnce(JSON.stringify(existing));

    const handler = await importMainAndGetHandler<(_event: unknown, payload: Record<string, unknown>) => Promise<Record<string, unknown>>>(
      'reading-progress:save',
    );

    const updated = {
      bookId: 'book-a',
      lastPageIndex: 3,
      progressPercent: 30,
      completed: true,
      lastOpenedAt: '2025-01-02T00:00:00.000Z',
    };
    const store = await handler(null, updated);

    expect(store).toEqual({
      version: 1,
      updatedAt: expect.any(String),
      books: { 'book-a': updated, 'book-b': bookB },
    });
    expectIsoString((store as { updatedAt: unknown }).updatedAt);
    expect(mocks.writeFile).toHaveBeenCalledWith(
      'C:\\Temp\\flipbook-react-electron\\reading-progress.json',
      JSON.stringify(store, null, 2),
      'utf8',
    );
  });

  it('saves only whitelisted reading progress fields', async () => {
    mocks.readFile.mockRejectedValueOnce(Object.assign(new Error('missing'), { code: 'ENOENT' }));

    const handler = await importMainAndGetHandler<(_event: unknown, payload: Record<string, unknown>) => Promise<Record<string, unknown>>>(
      'reading-progress:save',
    );

    const store = await handler(null, {
      bookId: 'book-a',
      lastPageIndex: 4,
      progressPercent: 40,
      completed: false,
      lastOpenedAt: '2025-01-01T00:00:00.000Z',
      arbitrary: 'do-not-persist',
      nested: { unsafe: true },
    });

    expect(store).toEqual({
      version: 1,
      updatedAt: expect.any(String),
      books: {
        'book-a': {
          bookId: 'book-a',
          lastPageIndex: 4,
          progressPercent: 40,
          completed: false,
          lastOpenedAt: '2025-01-01T00:00:00.000Z',
        },
      },
    });
    expect(Object.keys((store as { books: Record<string, unknown> }).books['book-a'] as Record<string, unknown>)).toEqual([
      'bookId',
      'lastPageIndex',
      'progressPercent',
      'completed',
      'lastOpenedAt',
    ]);
  });

  it('returns the existing store without writing when saving a malformed payload', async () => {
    const existingRecord = {
      bookId: 'book-a',
      lastPageIndex: 4,
      progressPercent: 40,
      completed: false,
      lastOpenedAt: '2025-01-01T00:00:00.000Z',
    };
    mocks.readFile.mockResolvedValueOnce(JSON.stringify({
      version: 1,
      updatedAt: '2025-01-01T00:00:00.000Z',
      books: { 'book-a': existingRecord },
    }));

    const handler = await importMainAndGetHandler<(_event: unknown, payload: Record<string, unknown>) => Promise<Record<string, unknown>>>(
      'reading-progress:save',
    );

    await expect(handler(null, { bookId: 'book-b', lastPageIndex: 'not-a-number' })).resolves.toEqual({
      version: 1,
      updatedAt: '2025-01-01T00:00:00.000Z',
      books: { 'book-a': existingRecord },
    });
    expect(mocks.writeFile).not.toHaveBeenCalled();
  });

  it.each([
    ['negative lastPageIndex', { lastPageIndex: -1 }],
    ['fractional lastPageIndex', { lastPageIndex: 1.5 }],
    ['progressPercent below zero', { progressPercent: -0.1 }],
    ['progressPercent above 100', { progressPercent: 100.1 }],
    ['invalid timestamp', { lastOpenedAt: 'not-a-date' }],
    ['noncanonical timestamp', { lastOpenedAt: '2025-01-01T00:00:00Z' }],
  ])('returns the normalized existing store without writing for %s', async (_name, invalidFields) => {
    const existingRecord = validRecord();
    const invalidFileRecord = { ...validRecord('invalid-book'), lastPageIndex: -1 };
    mocks.readFile.mockResolvedValueOnce(JSON.stringify({
      version: 1,
      updatedAt: '2025-01-01T00:00:00.000Z',
      books: { 'book-a': existingRecord, 'invalid-book': invalidFileRecord },
    }));

    const handler = await importMainAndGetHandler<(_event: unknown, payload: Record<string, unknown>) => Promise<Record<string, unknown>>>(
      'reading-progress:save',
    );

    await expect(handler(null, { ...validRecord('book-b'), ...invalidFields })).resolves.toEqual({
      version: 1,
      updatedAt: '2025-01-01T00:00:00.000Z',
      books: { 'book-a': existingRecord },
    });
    expect(mocks.writeFile).not.toHaveBeenCalled();
  });

  it('serializes concurrent saves so the second read follows the first write without losing the first update', async () => {
    const firstWrite = deferred<void>();
    const emptyStore = { version: 1, updatedAt: '2025-01-01T00:00:00.000Z', books: {} };
    let persistedStore = emptyStore;
    mocks.readFile.mockImplementation(async () => JSON.stringify(persistedStore));
    mocks.writeFile.mockImplementationOnce(async (_path, contents) => {
      persistedStore = JSON.parse(contents as string);
      await firstWrite.promise;
    }).mockImplementationOnce(async (_path, contents) => {
      persistedStore = JSON.parse(contents as string);
    });

    const save = await importMainAndGetHandler<(_event: unknown, payload: Record<string, unknown>) => Promise<Record<string, unknown>>>(
      'reading-progress:save',
    );
    const saveA = save(null, validRecord('book-a'));
    const saveB = save(null, validRecord('book-b'));

    await vi.waitFor(() => expect(mocks.writeFile).toHaveBeenCalledTimes(1));
    expect(mocks.readFile).toHaveBeenCalledTimes(1);
    firstWrite.resolve();

    const [resultA, resultB] = await Promise.all([saveA, saveB]);
    expect(Object.keys((resultA as { books: object }).books)).toEqual(['book-a']);
    expect(Object.keys((resultB as { books: object }).books)).toEqual(['book-a', 'book-b']);
    expect(Object.keys(persistedStore.books)).toEqual(['book-a', 'book-b']);
    expect(mocks.readFile).toHaveBeenCalledTimes(2);
    expect(mocks.writeFile).toHaveBeenCalledTimes(2);
  });

  it('serializes save then delete in invocation order', async () => {
    const saveWrite = deferred<void>();
    let persistedStore = { version: 1, updatedAt: '2025-01-01T00:00:00.000Z', books: {} };
    mocks.readFile.mockImplementation(async () => JSON.stringify(persistedStore));
    mocks.writeFile.mockImplementationOnce(async (_path, contents) => {
      persistedStore = JSON.parse(contents as string);
      await saveWrite.promise;
    }).mockImplementationOnce(async (_path, contents) => {
      persistedStore = JSON.parse(contents as string);
    });

    await import('./main.js');
    const save = mocks.handle.mock.calls.find(([channel]) => channel === 'reading-progress:save')?.[1] as
      (_event: unknown, payload: Record<string, unknown>) => Promise<Record<string, unknown>>;
    const deleteRecord = mocks.handle.mock.calls.find(([channel]) => channel === 'reading-progress:delete')?.[1] as
      (_event: unknown, bookId: string) => Promise<Record<string, unknown>>;
    const saveResult = save(null, validRecord('book-a'));
    const deleteResult = deleteRecord(null, 'book-a');

    await vi.waitFor(() => expect(mocks.writeFile).toHaveBeenCalledTimes(1));
    expect(mocks.readFile).toHaveBeenCalledTimes(1);
    saveWrite.resolve();

    await expect(saveResult).resolves.toMatchObject({ books: { 'book-a': validRecord('book-a') } });
    await expect(deleteResult).resolves.toMatchObject({ books: {} });
    expect(persistedStore.books).toEqual({});
    expect(mocks.readFile).toHaveBeenCalledTimes(2);
    expect(mocks.writeFile).toHaveBeenCalledTimes(2);
  });

  it('continues processing mutations after a rejected mutation', async () => {
    const emptyStore = { version: 1, updatedAt: '2025-01-01T00:00:00.000Z', books: {} };
    mocks.readFile.mockResolvedValue(JSON.stringify(emptyStore));
    mocks.writeFile.mockRejectedValueOnce(new Error('disk failure')).mockResolvedValueOnce(undefined);

    const save = await importMainAndGetHandler<(_event: unknown, payload: Record<string, unknown>) => Promise<Record<string, unknown>>>(
      'reading-progress:save',
    );
    const failed = save(null, validRecord('book-a'));
    const succeeding = save(null, validRecord('book-b'));

    await expect(failed).rejects.toThrow('disk failure');
    await expect(succeeding).resolves.toMatchObject({ books: { 'book-b': validRecord('book-b') } });
    expect(mocks.writeFile).toHaveBeenCalledTimes(2);
  });

  it('deletes only the requested reading progress record', async () => {
    const bookB = {
      bookId: 'book-b',
      lastPageIndex: 8,
      progressPercent: 80,
      completed: false,
      lastOpenedAt: '2025-01-01T00:00:00.000Z',
    };
    const existing = {
      version: 1,
      updatedAt: '2025-01-01T00:00:00.000Z',
      books: {
        'book-a': {
          bookId: 'book-a',
          lastPageIndex: 1,
          progressPercent: 10,
          completed: false,
          lastOpenedAt: '2025-01-01T00:00:00.000Z',
        },
        'book-b': bookB,
      },
    };
    mocks.readFile.mockResolvedValueOnce(JSON.stringify(existing));

    const handler = await importMainAndGetHandler<(_event: unknown, bookId: string) => Promise<Record<string, unknown>>>(
      'reading-progress:delete',
    );

    const store = await handler(null, ' book-a ');

    expect(store).toEqual({ version: 1, updatedAt: expect.any(String), books: { 'book-b': bookB } });
    expectIsoString((store as { updatedAt: unknown }).updatedAt);
    expect(mocks.writeFile).toHaveBeenCalledWith(
      'C:\\Temp\\flipbook-react-electron\\reading-progress.json',
      JSON.stringify(store, null, 2),
      'utf8',
    );
  });
});
