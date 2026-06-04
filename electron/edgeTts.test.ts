import { EventEmitter } from 'node:events';
import { describe, expect, it, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => {
  const spawn = vi.fn();
  const mkdtemp = vi.fn();
  const readFile = vi.fn();
  const rm = vi.fn();

  return { spawn, mkdtemp, readFile, rm };
});

vi.mock('node:child_process', () => ({
  spawn: mocks.spawn,
  default: { spawn: mocks.spawn },
}));
vi.mock('node:fs/promises', () => ({
  mkdtemp: mocks.mkdtemp,
  readFile: mocks.readFile,
  rm: mocks.rm,
  default: {
    mkdtemp: mocks.mkdtemp,
    readFile: mocks.readFile,
    rm: mocks.rm,
  },
}));

vi.mock('node:os', () => ({ tmpdir: () => 'C:\\Temp', default: { tmpdir: () => 'C:\\Temp' } }));
vi.mock('node:path', () => ({
  join: (...parts: string[]) => parts.join('\\'),
  default: { join: (...parts: string[]) => parts.join('\\') },
}));
vi.mock('node:crypto', () => ({
  randomUUID: () => 'uuid-1234',
  default: { randomUUID: () => 'uuid-1234' },
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
    mocks.readFile.mockReset();
    mocks.rm.mockReset();
    mocks.mkdtemp.mockResolvedValue('C:\\Temp\\flipbook-edge-tts');
    mocks.readFile.mockResolvedValue(Buffer.from([1, 2, 3]));
    mocks.rm.mockResolvedValue(undefined);
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

  it('skips synthesis for empty text', async () => {
    const { synthesizeEdgeTts } = await import('./edgeTts.js');

    await expect(synthesizeEdgeTts('   ')).resolves.toEqual(new Uint8Array());
    expect(mocks.spawn).not.toHaveBeenCalled();
  });
});
