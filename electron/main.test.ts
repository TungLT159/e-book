import { describe, expect, it, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => {
  const stat = vi.fn();
  const rm = vi.fn();
  const handle = vi.fn();
  const prepareEdgeTtsAudioCacheFile = vi.fn();
  const commandLine = { appendSwitch: vi.fn() };
  const app = {
    commandLine,
    setPath: vi.fn(),
    getPath: vi.fn(() => 'C:\\Temp\\flipbook-react-electron'),
    getAppPath: vi.fn(() => 'C:\\App'),
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

  return { stat, rm, handle, prepareEdgeTtsAudioCacheFile, commandLine, app, BrowserWindow };
});

vi.mock('electron', () => ({
  app: mocks.app,
  BrowserWindow: mocks.BrowserWindow,
  ipcMain: { handle: mocks.handle },
}));

vi.mock('node:fs/promises', () => ({
  stat: mocks.stat,
  rm: mocks.rm,
  default: { stat: mocks.stat, rm: mocks.rm },
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
    mocks.handle.mockReset();
    mocks.prepareEdgeTtsAudioCacheFile.mockReset();
    mocks.commandLine.appendSwitch.mockReset();
    mocks.app.setPath.mockReset();
    mocks.app.getPath.mockReturnValue('C:\\Temp\\flipbook-react-electron');
    mocks.app.getAppPath.mockReturnValue('C:\\App');
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
