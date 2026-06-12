import { EventEmitter } from 'node:events';
import { describe, expect, it, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => {
  const spawn = vi.fn();
  const mkdtemp = vi.fn();
  const mkdir = vi.fn();
  const readFile = vi.fn();
  const rename = vi.fn();
  const rm = vi.fn();
  const writeFile = vi.fn();
  const createHash = vi.fn(() => ({
    update: vi.fn().mockReturnThis(),
    digest: vi.fn(() => 'abcdef1234567890abcdef1234567890deadbeef'),
  }));

  return { spawn, mkdtemp, mkdir, readFile, rename, rm, writeFile, createHash };
});

vi.mock('node:child_process', () => ({
  spawn: mocks.spawn,
  default: { spawn: mocks.spawn },
}));
vi.mock('node:fs/promises', () => ({
  mkdtemp: mocks.mkdtemp,
  mkdir: mocks.mkdir,
  readFile: mocks.readFile,
  rename: mocks.rename,
  rm: mocks.rm,
  writeFile: mocks.writeFile,
  default: {
    mkdtemp: mocks.mkdtemp,
    mkdir: mocks.mkdir,
    readFile: mocks.readFile,
    rename: mocks.rename,
    rm: mocks.rm,
    writeFile: mocks.writeFile,
  },
}));

vi.mock('node:os', () => ({ tmpdir: () => 'C:\\Temp', default: { tmpdir: () => 'C:\\Temp' } }));
vi.mock('node:path', () => ({
  dirname: (path: string) => path.split('\\').slice(0, -1).join('\\'),
  join: (...parts: string[]) => parts.join('\\'),
  default: {
    dirname: (path: string) => path.split('\\').slice(0, -1).join('\\'),
    join: (...parts: string[]) => parts.join('\\'),
  },
}));
vi.mock('node:crypto', () => ({
  createHash: mocks.createHash,
  randomUUID: () => 'uuid-1234',
  default: { createHash: mocks.createHash, randomUUID: () => 'uuid-1234' },
}));

function createChildProcess() {
  const child = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
    stdin: { write: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn> };
  };

  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.stdin = { write: vi.fn(), end: vi.fn() };

  return child;
}

describe('edge TTS python bridge', () => {
  beforeEach(() => {
    mocks.spawn.mockReset();
    mocks.mkdtemp.mockReset();
    mocks.mkdir.mockReset();
    mocks.readFile.mockReset();
    mocks.rename.mockReset();
    mocks.rm.mockReset();
    mocks.writeFile.mockReset();
    mocks.createHash.mockClear();
    mocks.mkdtemp.mockResolvedValue('C:\\Temp\\flipbook-edge-tts');
    mocks.mkdir.mockResolvedValue(undefined);
    mocks.readFile.mockResolvedValue(Buffer.from([1, 2, 3]));
    mocks.rename.mockResolvedValue(undefined);
    mocks.rm.mockResolvedValue(undefined);
    mocks.writeFile.mockResolvedValue(undefined);
  });

  it('uses the Python edge_tts module', async () => {
    const child = createChildProcess();
    mocks.spawn.mockReturnValue(child);

    const { getEdgeTtsVoices } = await import('./edgeTts.js');
    const voicesPromise = getEdgeTtsVoices();

    child.stdout.emit('data', Buffer.from(JSON.stringify([{ ShortName: 'vi-VN-HoaiMyNeural' }] )));
    child.emit('close', 0);

    await expect(voicesPromise).resolves.toEqual([{ ShortName: 'vi-VN-HoaiMyNeural' }]);
    expect(mocks.spawn).toHaveBeenCalledWith(
      'python',
      expect.arrayContaining(['-c', expect.stringContaining('edge_tts.list_voices()')]),
      expect.objectContaining({ stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true }),
    );
  });

  it('returns only Vietnamese voices', async () => {
    const child = createChildProcess();
    mocks.spawn.mockReturnValue(child);

    const { getEdgeTtsVoices } = await import('./edgeTts.js');
    const voicesPromise = getEdgeTtsVoices();

    child.stdout.emit(
      'data',
      Buffer.from(
        JSON.stringify([
          { ShortName: 'en-US-JennyNeural', Locale: 'en-US' },
          { ShortName: 'vi-VN-HoaiMyNeural', Locale: 'vi-VN' },
          { ShortName: 'vi-VN-NamMinhNeural', Locale: 'vi-VN' },
        ]),
      ),
    );
    child.emit('close', 0);

    await expect(voicesPromise).resolves.toEqual([
      { ShortName: 'vi-VN-HoaiMyNeural', Locale: 'vi-VN' },
      { ShortName: 'vi-VN-NamMinhNeural', Locale: 'vi-VN' },
    ]);
  });

  it('synthesizes audio through Python edge_tts', async () => {
    const child = createChildProcess();
    mocks.spawn.mockReturnValue(child);

    const { synthesizeEdgeTts } = await import('./edgeTts.js');
    const audioPromise = synthesizeEdgeTts('xin chao', {
      voice: 'vi-VN-HoaiMyNeural',
      rate: '+25%',
    });

    await Promise.resolve();
    child.emit('close', 0);

    await expect(audioPromise).resolves.toEqual(new Uint8Array([1, 2, 3]));
    expect(mocks.spawn).toHaveBeenCalledWith(
      'python',
      expect.arrayContaining(['-c', expect.stringContaining('edge_tts.Communicate')]),
      expect.objectContaining({ stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true }),
    );
    expect(child.stdin.write).toHaveBeenCalledWith('xin chao');
    expect(child.stdin.end).toHaveBeenCalledTimes(1);
    expect(mocks.mkdtemp).toHaveBeenCalledWith('C:\\Temp\\flipbook-edge-tts-');
    expect(mocks.readFile).toHaveBeenCalledWith('C:\\Temp\\flipbook-edge-tts\\uuid-1234.mp3');
    expect(mocks.rm).toHaveBeenCalledWith('C:\\Temp\\flipbook-edge-tts', { recursive: true, force: true });
  });

  it('falls back to the default Vietnamese voice for non-Vietnamese input voices', async () => {
    const child = createChildProcess();
    mocks.spawn.mockReturnValue(child);

    const { synthesizeEdgeTts } = await import('./edgeTts.js');
    const audioPromise = synthesizeEdgeTts('Khi trời mưa, sóc lấy hạt dẻ.', {
      voice: 'en-US-JennyNeural',
    });

    await Promise.resolve();
    child.emit('close', 0);

    await expect(audioPromise).resolves.toEqual(new Uint8Array([1, 2, 3]));
    expect(mocks.spawn).toHaveBeenCalledWith(
      'python',
      expect.arrayContaining(['vi-VN-HoaiMyNeural']),
      expect.any(Object),
    );
  });

  it('removes invalid surrogate characters before writing to Python stdin', async () => {
    const child = createChildProcess();
    mocks.spawn.mockReturnValue(child);

    const { synthesizeEdgeTts } = await import('./edgeTts.js');
    const audioPromise = synthesizeEdgeTts('xin \udc9d chao', {
      voice: 'vi-VN-HoaiMyNeural',
    });

    await Promise.resolve();
    child.emit('close', 0);

    await expect(audioPromise).resolves.toEqual(new Uint8Array([1, 2, 3]));
    expect(child.stdin.write).toHaveBeenCalledWith('xin chao');
  });

  it('normalizes decomposed Vietnamese text to NFC before writing to Python stdin', async () => {
    const child = createChildProcess();
    mocks.spawn.mockReturnValue(child);

    const { synthesizeEdgeTts } = await import('./edgeTts.js');
    const decomposedText = 'Bie\u0302\u0309u';
    const audioPromise = synthesizeEdgeTts(decomposedText, {
      voice: 'vi-VN-HoaiMyNeural',
    });

    await Promise.resolve();
    child.emit('close', 0);

    await expect(audioPromise).resolves.toEqual(new Uint8Array([1, 2, 3]));
    expect(child.stdin.write).toHaveBeenCalledWith('Biểu');
  });

  it('retries synthesis when Edge TTS returns no audio', async () => {
    const failedChild = createChildProcess();
    const successfulChild = createChildProcess();
    mocks.spawn.mockReturnValueOnce(failedChild).mockReturnValueOnce(successfulChild);

    const { synthesizeEdgeTts } = await import('./edgeTts.js');
    const audioPromise = synthesizeEdgeTts('Mình yêu mưa, cỏ xanh.', {
      voice: 'vi-VN-HoaiMyNeural',
    });

    await Promise.resolve();
    failedChild.stderr.emit(
      'data',
      Buffer.from('edge_tts.exceptions.NoAudioReceived: No audio was received.'),
    );
    failedChild.emit('close', 1);
    await Promise.resolve();
    successfulChild.emit('close', 0);

    await expect(audioPromise).resolves.toEqual(new Uint8Array([1, 2, 3]));
    expect(mocks.spawn).toHaveBeenCalledTimes(2);
  });

  it('keeps retrying transient Edge TTS no-audio responses beyond three attempts', async () => {
    const failedChildren = [createChildProcess(), createChildProcess(), createChildProcess()];
    const successfulChild = createChildProcess();
    mocks.spawn
      .mockReturnValueOnce(failedChildren[0])
      .mockReturnValueOnce(failedChildren[1])
      .mockReturnValueOnce(failedChildren[2])
      .mockReturnValueOnce(successfulChild);

    const { synthesizeEdgeTts } = await import('./edgeTts.js');
    const audioPromise = synthesizeEdgeTts('Trang tiếp theo cần đọc.', {
      voice: 'vi-VN-HoaiMyNeural',
    });

    for (const failedChild of failedChildren) {
      await Promise.resolve();
      failedChild.stderr.emit(
        'data',
        Buffer.from('edge_tts.exceptions.NoAudioReceived: No audio was received.'),
      );
      failedChild.emit('close', 1);
    }

    await Promise.resolve();
    successfulChild.emit('close', 0);

    await expect(audioPromise).resolves.toEqual(new Uint8Array([1, 2, 3]));
    expect(mocks.spawn).toHaveBeenCalledTimes(4);
  });

  it('skips synthesis for empty text', async () => {
    const { synthesizeEdgeTts } = await import('./edgeTts.js');

    await expect(synthesizeEdgeTts('   ')).resolves.toEqual(new Uint8Array());
    expect(mocks.spawn).not.toHaveBeenCalled();
  });

  it('also sanitizes text inside the Python script before calling edge_tts', async () => {
    const { SYNTHESIZE_SCRIPT } = await import('./edgeTts.js');

    expect(SYNTHESIZE_SCRIPT).toContain("encode('utf-8', 'ignore')");
    expect(SYNTHESIZE_SCRIPT).toContain("decode('utf-8', 'ignore')");
  });

  it('returns a cached audio URL on a fresh cache hit', async () => {
    const lookup = vi.fn().mockResolvedValue({
      audioPath:
        'C:\\Temp\\narration-audio\\demo-book\\vi-VN-HoaiMyNeural\\__default__\\__default__\\chunk-0-abcdef1234567890abcdef1234567890.mp3',
      cacheHit: true,
    });

    const { getOrCreateEdgeTtsAudioCacheFile } = await import('./edgeTts.js');

    await expect(
      getOrCreateEdgeTtsAudioCacheFile({
        userDataPath: 'C:\\Temp',
        bookKey: 'demo-book',
        voice: 'vi-VN-HoaiMyNeural',
        rate: '',
        chunkIndex: 0,
        chunkText: 'Biểu',
        lookup,
      }),
    ).resolves.toEqual({
      audioPath:
        'C:\\Temp\\narration-audio\\demo-book\\vi-VN-HoaiMyNeural\\__default__\\__default__\\chunk-0-abcdef1234567890abcdef1234567890.mp3',
      audioUrl:
        'file:///C:/Temp/narration-audio/demo-book/vi-VN-HoaiMyNeural/__default__/__default__/chunk-0-abcdef1234567890abcdef1234567890.mp3',
      cacheHit: true,
    });
    expect(mocks.createHash).toHaveBeenCalledWith('sha256');
  });

  it('returns a fresh prepared cache file without synthesizing or writing on a cache hit', async () => {
    const lookup = vi.fn().mockResolvedValue({
      audioPath:
        'C:\\Temp\\narration-audio\\demo-book\\vi-VN-HoaiMyNeural\\__default__\\__default__\\chunk-0-abcdef1234567890abcdef1234567890.mp3',
      cacheHit: true,
    });

    const { prepareEdgeTtsAudioCacheFile } = await import('./edgeTts.js');

    await expect(
      prepareEdgeTtsAudioCacheFile({
        userDataPath: 'C:\\Temp',
        bookKey: 'demo-book',
        voice: 'vi-VN-HoaiMyNeural',
        rate: '',
        chunkIndex: 0,
        chunkText: 'Biểu',
        lookup,
      }),
    ).resolves.toEqual({
      audioPath:
        'C:\\Temp\\narration-audio\\demo-book\\vi-VN-HoaiMyNeural\\__default__\\__default__\\chunk-0-abcdef1234567890abcdef1234567890.mp3',
      audioUrl:
        'file:///C:/Temp/narration-audio/demo-book/vi-VN-HoaiMyNeural/__default__/__default__/chunk-0-abcdef1234567890abcdef1234567890.mp3',
      cacheHit: true,
      timings: {
        cacheLookupMs: expect.any(Number),
        synthesisMs: 0,
      },
    });
    expect(mocks.spawn).not.toHaveBeenCalled();
    expect(mocks.mkdir).not.toHaveBeenCalled();
    expect(mocks.writeFile).not.toHaveBeenCalled();
  });

  it('synthesizes and writes the prepared cache file on a cache miss', async () => {
    const child = createChildProcess();
    const lookup = vi.fn().mockResolvedValue({
      audioPath: 'C:\\Temp\\unexpected\\stale.mp3',
      cacheHit: false,
    });
    mocks.spawn.mockReturnValue(child);

    const { prepareEdgeTtsAudioCacheFile } = await import('./edgeTts.js');
    const cachePromise = prepareEdgeTtsAudioCacheFile({
      userDataPath: 'C:\\Temp',
      bookKey: 'demo-book',
      voice: 'vi-VN-HoaiMyNeural',
      rate: '',
      chunkIndex: 0,
      chunkText: 'Biểu',
      lookup,
    });

    for (let attempt = 0; attempt < 10 && mocks.spawn.mock.calls.length === 0; attempt += 1) {
      await Promise.resolve();
    }
    expect(mocks.spawn).toHaveBeenCalledTimes(1);
    child.emit('close', 0);

    await expect(cachePromise).resolves.toEqual({
      audioPath:
        'C:\\Temp\\narration-audio\\demo-book\\vi-VN-HoaiMyNeural\\__default__\\__default__\\chunk-0-abcdef1234567890abcdef1234567890.mp3',
      audioUrl:
        'file:///C:/Temp/narration-audio/demo-book/vi-VN-HoaiMyNeural/__default__/__default__/chunk-0-abcdef1234567890abcdef1234567890.mp3',
      cacheHit: false,
      timings: {
        cacheLookupMs: expect.any(Number),
        synthesisMs: expect.any(Number),
      },
    });
    const preparedResult = await cachePromise;
    expect(preparedResult.timings.cacheLookupMs).toBeGreaterThanOrEqual(0);
    expect(preparedResult.timings.synthesisMs).toBeGreaterThanOrEqual(0);
    expect(mocks.mkdir).toHaveBeenCalledWith(
      'C:\\Temp\\narration-audio\\demo-book\\vi-VN-HoaiMyNeural\\__default__\\__default__',
      { recursive: true },
    );
    expect(mocks.writeFile).toHaveBeenCalledWith(
      'C:\\Temp\\narration-audio\\demo-book\\vi-VN-HoaiMyNeural\\__default__\\__default__\\chunk-0-abcdef1234567890abcdef1234567890.mp3.uuid-1234.tmp',
      new Uint8Array([1, 2, 3]),
    );
    expect(mocks.rename).toHaveBeenCalledWith(
      'C:\\Temp\\narration-audio\\demo-book\\vi-VN-HoaiMyNeural\\__default__\\__default__\\chunk-0-abcdef1234567890abcdef1234567890.mp3.uuid-1234.tmp',
      'C:\\Temp\\narration-audio\\demo-book\\vi-VN-HoaiMyNeural\\__default__\\__default__\\chunk-0-abcdef1234567890abcdef1234567890.mp3',
    );
  });

  it('removes the temporary cache file and rethrows when publishing fails', async () => {
    const child = createChildProcess();
    const publishError = new Error('rename failed');
    const lookup = vi.fn().mockResolvedValue({ cacheHit: false });
    mocks.spawn.mockReturnValue(child);
    mocks.rename.mockRejectedValueOnce(publishError);

    const { prepareEdgeTtsAudioCacheFile } = await import('./edgeTts.js');
    const cachePromise = prepareEdgeTtsAudioCacheFile({
      userDataPath: 'C:\\Temp',
      bookKey: 'demo-book',
      voice: 'vi-VN-HoaiMyNeural',
      rate: '',
      chunkIndex: 0,
      chunkText: 'Biểu',
      lookup,
    });

    for (let attempt = 0; attempt < 10 && mocks.spawn.mock.calls.length === 0; attempt += 1) {
      await Promise.resolve();
    }
    child.emit('close', 0);

    await expect(cachePromise).rejects.toThrow('rename failed');
    expect(mocks.rm).toHaveBeenCalledWith(
      'C:\\Temp\\narration-audio\\demo-book\\vi-VN-HoaiMyNeural\\__default__\\__default__\\chunk-0-abcdef1234567890abcdef1234567890.mp3.uuid-1234.tmp',
      { force: true },
    );
  });

  it('shares synthesis and publishing for overlapping requests to the same cache path', async () => {
    const child = createChildProcess();
    const lookup = vi.fn().mockResolvedValue({ cacheHit: false });
    mocks.spawn.mockReturnValue(child);

    const { prepareEdgeTtsAudioCacheFile } = await import('./edgeTts.js');
    const options = {
      userDataPath: 'C:\\Temp',
      bookKey: 'demo-book',
      voice: 'vi-VN-HoaiMyNeural',
      rate: '',
      volume: '+10%',
      chunkIndex: 0,
      chunkText: 'Biểu',
      lookup,
    };

    const first = prepareEdgeTtsAudioCacheFile(options);
    const second = prepareEdgeTtsAudioCacheFile(options);

    for (let attempt = 0; attempt < 10 && mocks.spawn.mock.calls.length === 0; attempt += 1) {
      await Promise.resolve();
    }
    expect(mocks.spawn).toHaveBeenCalledTimes(1);
    child.emit('close', 0);

    const results = await Promise.all([first, second]);
    expect(results).toEqual([
      expect.objectContaining({ cacheHit: false, timings: expect.any(Object) }),
      expect.objectContaining({ cacheHit: false, timings: expect.any(Object) }),
    ]);
    expect(results[0].timings.synthesisMs).toBe(results[1].timings.synthesisMs);
    expect(lookup).toHaveBeenCalledTimes(2);
    expect(mocks.writeFile).toHaveBeenCalledTimes(1);
    expect(mocks.rename).toHaveBeenCalledTimes(1);
  });

  it('shares preparation when distinct raw inputs canonicalize to the same cache path', async () => {
    const firstChild = createChildProcess();
    const duplicateChild = createChildProcess();
    const lookup = vi.fn().mockResolvedValue({ cacheHit: false });
    mocks.spawn.mockReturnValueOnce(firstChild).mockReturnValueOnce(duplicateChild);

    const { prepareEdgeTtsAudioCacheFile } = await import('./edgeTts.js');
    const commonOptions = {
      userDataPath: 'C:\\Temp',
      bookKey: 'demo-book',
      voice: 'vi-VN-HoaiMyNeural',
      volume: '+10%',
      chunkIndex: 0,
      chunkText: 'Biểu',
      lookup,
    };
    const first = prepareEdgeTtsAudioCacheFile({ ...commonOptions, rate: undefined });
    const second = prepareEdgeTtsAudioCacheFile({ ...commonOptions, rate: '' });

    for (let attempt = 0; attempt < 10 && mocks.spawn.mock.calls.length === 0; attempt += 1) {
      await Promise.resolve();
    }
    firstChild.emit('close', 0);
    if (mocks.spawn.mock.calls.length === 2) {
      duplicateChild.emit('close', 0);
    }

    const [firstResult, secondResult] = await Promise.all([first, second]);
    expect(firstResult.audioPath).toBe(secondResult.audioPath);
    expect(mocks.spawn).toHaveBeenCalledTimes(1);
    expect(mocks.writeFile).toHaveBeenCalledTimes(1);
    expect(mocks.rename).toHaveBeenCalledTimes(1);
  });

  it('shares a completed publication when an already-started stale lookup resolves later', async () => {
    const firstChild = createChildProcess();
    const duplicateChild = createChildProcess();
    let resolveFirstLookup!: (value: { cacheHit: false }) => void;
    let resolveSecondLookup!: (value: { cacheHit: false }) => void;
    const firstLookup = new Promise<{ cacheHit: false }>((resolve) => {
      resolveFirstLookup = resolve;
    });
    const secondLookup = new Promise<{ cacheHit: false }>((resolve) => {
      resolveSecondLookup = resolve;
    });
    const lookup = vi.fn()
      .mockReturnValueOnce(firstLookup)
      .mockReturnValueOnce(secondLookup);
    mocks.spawn.mockReturnValueOnce(firstChild).mockReturnValueOnce(duplicateChild);

    const { prepareEdgeTtsAudioCacheFile } = await import('./edgeTts.js');
    const options = {
      userDataPath: 'C:\\Temp',
      bookKey: 'demo-book',
      voice: 'vi-VN-HoaiMyNeural',
      rate: '',
      volume: '+10%',
      chunkIndex: 0,
      chunkText: 'Biểu',
      lookup,
    };

    const first = prepareEdgeTtsAudioCacheFile(options);
    const second = prepareEdgeTtsAudioCacheFile(options);
    expect(lookup).toHaveBeenCalledTimes(2);

    resolveFirstLookup({ cacheHit: false });
    for (let attempt = 0; attempt < 10 && mocks.spawn.mock.calls.length === 0; attempt += 1) {
      await Promise.resolve();
    }
    firstChild.emit('close', 0);
    await expect(first).resolves.toEqual(expect.objectContaining({ cacheHit: false }));
    expect(mocks.writeFile).toHaveBeenCalledTimes(1);

    resolveSecondLookup({ cacheHit: false });
    for (let attempt = 0; attempt < 10 && mocks.spawn.mock.calls.length < 2; attempt += 1) {
      await Promise.resolve();
    }
    if (mocks.spawn.mock.calls.length === 2) {
      duplicateChild.emit('close', 0);
    }
    await expect(second).resolves.toEqual(expect.objectContaining({ cacheHit: false }));
    expect(mocks.spawn).toHaveBeenCalledTimes(1);
    expect(mocks.writeFile).toHaveBeenCalledTimes(1);
    expect(mocks.rename).toHaveBeenCalledTimes(1);
  });

  it('removes a failed in-flight request so a later call can retry', async () => {
    const failedChild = createChildProcess();
    const retryChild = createChildProcess();
    const lookup = vi.fn().mockResolvedValue({ cacheHit: false });
    mocks.spawn.mockReturnValueOnce(failedChild).mockReturnValueOnce(retryChild);
    mocks.rename.mockRejectedValueOnce(new Error('rename failed')).mockResolvedValueOnce(undefined);

    const { prepareEdgeTtsAudioCacheFile } = await import('./edgeTts.js');
    const options = {
      userDataPath: 'C:\\Temp',
      bookKey: 'demo-book',
      voice: 'vi-VN-HoaiMyNeural',
      rate: '',
      volume: '+10%',
      chunkIndex: 0,
      chunkText: 'Biểu',
      lookup,
    };

    const failed = prepareEdgeTtsAudioCacheFile(options);
    for (let attempt = 0; attempt < 10 && mocks.spawn.mock.calls.length === 0; attempt += 1) {
      await Promise.resolve();
    }
    failedChild.emit('close', 0);
    await expect(failed).rejects.toThrow('rename failed');

    const retry = prepareEdgeTtsAudioCacheFile(options);
    for (let attempt = 0; attempt < 10 && mocks.spawn.mock.calls.length < 2; attempt += 1) {
      await Promise.resolve();
    }
    retryChild.emit('close', 0);

    await expect(retry).resolves.toEqual(expect.objectContaining({ cacheHit: false }));
    expect(lookup).toHaveBeenCalledTimes(2);
    expect(mocks.spawn).toHaveBeenCalledTimes(2);
    expect(mocks.writeFile).toHaveBeenCalledTimes(2);
  });

  it('does not deduplicate concurrent requests for different cache paths', async () => {
    const firstChild = createChildProcess();
    const secondChild = createChildProcess();
    const lookup = vi.fn().mockResolvedValue({ cacheHit: false });
    mocks.spawn.mockReturnValueOnce(firstChild).mockReturnValueOnce(secondChild);

    const { prepareEdgeTtsAudioCacheFile } = await import('./edgeTts.js');
    const commonOptions = {
      userDataPath: 'C:\\Temp',
      bookKey: 'demo-book',
      voice: 'vi-VN-HoaiMyNeural',
      rate: '',
      chunkText: 'Biểu',
      lookup,
    };
    const first = prepareEdgeTtsAudioCacheFile({ ...commonOptions, chunkIndex: 0 });
    const second = prepareEdgeTtsAudioCacheFile({ ...commonOptions, chunkIndex: 1 });

    for (let attempt = 0; attempt < 10 && mocks.spawn.mock.calls.length < 2; attempt += 1) {
      await Promise.resolve();
    }
    expect(mocks.spawn).toHaveBeenCalledTimes(2);
    firstChild.emit('close', 0);
    secondChild.emit('close', 0);

    const [firstResult, secondResult] = await Promise.all([first, second]);
    expect(firstResult.audioPath).not.toBe(secondResult.audioPath);
    expect(mocks.writeFile).toHaveBeenCalledTimes(2);
  });

  it('produces the same cache path for the same inputs', async () => {
    const lookup = vi.fn().mockResolvedValue({
      audioPath:
        'C:\\Temp\\narration-audio\\demo-book\\vi-VN-HoaiMyNeural\\__default__\\__default__\\chunk-0-abcdef1234567890abcdef1234567890.mp3',
      cacheHit: true,
    });

    const { getOrCreateEdgeTtsAudioCacheFile } = await import('./edgeTts.js');

    const first = await getOrCreateEdgeTtsAudioCacheFile({
      userDataPath: 'C:\\Temp',
      bookKey: 'demo-book',
      voice: 'vi-VN-HoaiMyNeural',
      rate: '',
      chunkIndex: 0,
      chunkText: 'Biểu',
      lookup,
    });
    const second = await getOrCreateEdgeTtsAudioCacheFile({
      userDataPath: 'C:\\Temp',
      bookKey: 'demo-book',
      voice: 'vi-VN-HoaiMyNeural',
      rate: '',
      chunkIndex: 0,
      chunkText: 'Biểu',
      lookup,
    });

    expect(first.audioPath).toBe(second.audioPath);
  });

  it('passes the cache ttl to lookup', async () => {
    const lookup = vi.fn().mockResolvedValue({
      audioPath:
        'C:\\Temp\\narration-audio\\demo-book\\vi-VN-HoaiMyNeural\\__default__\\__default__\\chunk-0-abcdef1234567890abcdef1234567890.mp3',
      cacheHit: false,
    });

    const { AUDIO_CACHE_TTL_MS, getOrCreateEdgeTtsAudioCacheFile } = await import('./edgeTts.js');

    await getOrCreateEdgeTtsAudioCacheFile({
      userDataPath: 'C:\\Temp',
      bookKey: 'demo-book',
      voice: 'vi-VN-HoaiMyNeural',
      rate: '',
      chunkIndex: 0,
      chunkText: 'Biểu',
      lookup,
    });

    expect(lookup).toHaveBeenCalledWith(
      expect.objectContaining({
        ttlMs: AUDIO_CACHE_TTL_MS,
      }),
    );
  });

  it('returns the deterministic cache path on a miss or expired lookup', async () => {
    const lookup = vi.fn().mockResolvedValue({
      audioPath: 'C:\\Temp\\unexpected\\stale.mp3',
      cacheHit: false,
    });

    const { getOrCreateEdgeTtsAudioCacheFile } = await import('./edgeTts.js');

    await expect(
      getOrCreateEdgeTtsAudioCacheFile({
        userDataPath: 'C:\\Temp',
        bookKey: 'demo-book',
        voice: 'vi-VN-HoaiMyNeural',
        rate: '',
        chunkIndex: 0,
        chunkText: 'Biểu',
        lookup,
      }),
    ).resolves.toEqual({
      audioPath:
        'C:\\Temp\\narration-audio\\demo-book\\vi-VN-HoaiMyNeural\\__default__\\__default__\\chunk-0-abcdef1234567890abcdef1234567890.mp3',
      audioUrl:
        'file:///C:/Temp/narration-audio/demo-book/vi-VN-HoaiMyNeural/__default__/__default__/chunk-0-abcdef1234567890abcdef1234567890.mp3',
      cacheHit: false,
    });
  });

  it('treats cache entries older than 30 days as stale and re-synthesized', async () => {
    const lookup = vi.fn().mockResolvedValue({
      audioPath:
        'C:\\Temp\\narration-audio\\demo-book\\vi-VN-HoaiMyNeural\\__default__\\__default__\\chunk-0-abcdef1234567890abcdef1234567890.mp3',
      cacheHit: false,
    });

    const { AUDIO_CACHE_TTL_MS, getOrCreateEdgeTtsAudioCacheFile } = await import('./edgeTts.js');

    await getOrCreateEdgeTtsAudioCacheFile({
      userDataPath: 'C:\\Temp',
      bookKey: 'demo-book',
      voice: 'vi-VN-HoaiMyNeural',
      rate: '',
      chunkIndex: 0,
      chunkText: 'Biểu',
      lookup,
    });

    expect(lookup).toHaveBeenCalledWith(
      expect.objectContaining({
        ttlMs: AUDIO_CACHE_TTL_MS,
      }),
    );
    expect(AUDIO_CACHE_TTL_MS).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it('uses a different cache path when the voice changes', async () => {
    const lookup = vi.fn().mockResolvedValue({
      audioPath:
        'C:\\Temp\\narration-audio\\demo-book\\vi-VN-NamMinhNeural\\__default__\\__default__\\chunk-0-abcdef1234567890abcdef1234567890.mp3',
      cacheHit: false,
    });

    const { getOrCreateEdgeTtsAudioCacheFile } = await import('./edgeTts.js');

    await expect(
      getOrCreateEdgeTtsAudioCacheFile({
        userDataPath: 'C:\\Temp',
        bookKey: 'demo-book',
        voice: 'vi-VN-NamMinhNeural',
        rate: '',
        chunkIndex: 0,
        chunkText: 'Biểu',
        lookup,
      }),
    ).resolves.toEqual({
      audioPath:
        'C:\\Temp\\narration-audio\\demo-book\\vi-VN-NamMinhNeural\\__default__\\__default__\\chunk-0-abcdef1234567890abcdef1234567890.mp3',
      audioUrl:
        'file:///C:/Temp/narration-audio/demo-book/vi-VN-NamMinhNeural/__default__/__default__/chunk-0-abcdef1234567890abcdef1234567890.mp3',
      cacheHit: false,
    });
  });

  it('uses a different cache path when the speech rate changes', async () => {
    const lookup = vi.fn().mockResolvedValue({
      audioPath:
        'C:\\Temp\\narration-audio\\demo-book\\vi-VN-HoaiMyNeural\\+25%\\__default__\\chunk-0-abcdef1234567890abcdef1234567890.mp3',
      cacheHit: false,
    });

    const { getOrCreateEdgeTtsAudioCacheFile } = await import('./edgeTts.js');

    await expect(
      getOrCreateEdgeTtsAudioCacheFile({
        userDataPath: 'C:\\Temp',
        bookKey: 'demo-book',
        voice: 'vi-VN-HoaiMyNeural',
        rate: '+25%',
        chunkIndex: 0,
        chunkText: 'Biểu',
        lookup,
      }),
    ).resolves.toEqual({
      audioPath:
        'C:\\Temp\\narration-audio\\demo-book\\vi-VN-HoaiMyNeural\\+25%\\__default__\\chunk-0-abcdef1234567890abcdef1234567890.mp3',
      audioUrl:
        'file:///C:/Temp/narration-audio/demo-book/vi-VN-HoaiMyNeural/+25%25/__default__/chunk-0-abcdef1234567890abcdef1234567890.mp3',
      cacheHit: false,
    });
  });

  it('uses different cache paths for different narration volumes', async () => {
    const lookup = vi.fn(async ({ audioPath }) => ({ audioPath, cacheHit: false }));

    const { getOrCreateEdgeTtsAudioCacheFile } = await import('./edgeTts.js');

    const quietResult = await getOrCreateEdgeTtsAudioCacheFile({
      userDataPath: 'C:\\Temp\\flipbook-user-data',
      bookKey: 'Sách thử nghiệm',
      voice: 'vi-VN-NamMinhNeural',
      rate: '',
      volume: '-10%',
      chunkIndex: 0,
      chunkText: 'Một đoạn văn bản.',
      lookup,
    });

    const loudResult = await getOrCreateEdgeTtsAudioCacheFile({
      userDataPath: 'C:\\Temp\\flipbook-user-data',
      bookKey: 'Sách thử nghiệm',
      voice: 'vi-VN-NamMinhNeural',
      rate: '',
      volume: '+10%',
      chunkIndex: 0,
      chunkText: 'Một đoạn văn bản.',
      lookup,
    });

    expect(quietResult.audioPath).not.toBe(loudResult.audioPath);
    expect(quietResult.audioPath).toContain('-10%');
    expect(loudResult.audioPath).toContain('+10%');
  });

  it('falls back to a legacy cache path when default volume misses the new path', async () => {
    const lookup = vi
      .fn()
      .mockResolvedValueOnce({ cacheHit: false })
      .mockImplementationOnce(async ({ audioPath }) => ({ audioPath, cacheHit: true }));

    const { getOrCreateEdgeTtsAudioCacheFile } = await import('./edgeTts.js');

    const result = await getOrCreateEdgeTtsAudioCacheFile({
      userDataPath: 'C:\\Temp',
      bookKey: 'demo-book',
      voice: 'vi-VN-HoaiMyNeural',
      rate: '',
      volume: '',
      chunkIndex: 0,
      chunkText: 'Biểu',
      lookup,
    });

    expect(lookup).toHaveBeenCalledTimes(2);
    expect(lookup.mock.calls[0]?.[0].audioPath).toContain(
      '\\vi-VN-HoaiMyNeural\\__default__\\__default__\\chunk-0-',
    );
    expect(lookup.mock.calls[1]?.[0].audioPath).toContain(
      '\\vi-VN-HoaiMyNeural\\__default__\\chunk-0-',
    );
    expect(result).toEqual({
      audioPath:
        'C:\\Temp\\narration-audio\\demo-book\\vi-VN-HoaiMyNeural\\__default__\\chunk-0-abcdef1234567890abcdef1234567890.mp3',
      audioUrl:
        'file:///C:/Temp/narration-audio/demo-book/vi-VN-HoaiMyNeural/__default__/chunk-0-abcdef1234567890abcdef1234567890.mp3',
      cacheHit: true,
    });
  });

  it('does not look up a legacy cache path for non-default volume', async () => {
    const lookup = vi.fn().mockResolvedValue({ cacheHit: false });

    const { getOrCreateEdgeTtsAudioCacheFile } = await import('./edgeTts.js');

    const result = await getOrCreateEdgeTtsAudioCacheFile({
      userDataPath: 'C:\\Temp',
      bookKey: 'demo-book',
      voice: 'vi-VN-HoaiMyNeural',
      rate: '',
      volume: '+10%',
      chunkIndex: 0,
      chunkText: 'Biểu',
      lookup,
    });

    expect(lookup).toHaveBeenCalledTimes(1);
    expect(result.audioPath).toContain(
      '\\vi-VN-HoaiMyNeural\\__default__\\+10%\\chunk-0-',
    );
    expect(result.cacheHit).toBe(false);
  });
});
