import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  lstat: vi.fn(),
  mkdir: vi.fn(),
  open: vi.fn(),
  readFile: vi.fn(),
  realpath: vi.fn(),
  writeFile: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
  lstat: mocks.lstat,
  mkdir: mocks.mkdir,
  open: mocks.open,
  readFile: mocks.readFile,
  realpath: mocks.realpath,
  writeFile: mocks.writeFile,
  default: {
    lstat: mocks.lstat,
    mkdir: mocks.mkdir,
    open: mocks.open,
    readFile: mocks.readFile,
    realpath: mocks.realpath,
    writeFile: mocks.writeFile,
  },
}));

describe('extracted text debug export', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('formats extracted PDF text by page', async () => {
    const { formatExtractedTextDebug } = await import('./extractedTextDebug.js');

    expect(
      formatExtractedTextDebug({
        title: 'Sóc không hề tham lam',
        pdfPath: '/books/soc.pdf',
        pages: ['Trang một', 'Khi trời mưa, sóc lấy hạt dẻ.'],
      }),
    ).toContain('--- Page 2 ---\nKhi trời mưa, sóc lấy hạt dẻ.');
  });

  it('writes extracted text into the userData debug folder', async () => {
    mocks.mkdir.mockResolvedValue(undefined);
    mocks.writeFile.mockResolvedValue(undefined);

    const { writeExtractedTextDebug } = await import('./extractedTextDebug.js');
    const outputPath = await writeExtractedTextDebug('C:\\Temp\\flipbook-user-data', {
      title: 'Sóc không hề tham lam',
      pdfPath: '/books/soc.pdf',
      pages: ['Khi trời mưa, sóc lấy hạt dẻ.'],
    });

    expect(outputPath).toContain('extracted-text');
    expect(outputPath).toContain('Soc-khong-he-tham-lam');
    expect(mocks.mkdir).toHaveBeenCalledWith(expect.stringContaining('extracted-text'), { recursive: true });
    expect(mocks.writeFile).toHaveBeenCalledWith(
      outputPath,
      expect.stringContaining('Khi trời mưa, sóc lấy hạt dẻ.'),
      'utf8',
    );
  });

  it('reads only the requested page block from an extracted text file', async () => {
    const fileHandle = {
      close: vi.fn().mockResolvedValue(undefined),
      readFile: vi.fn().mockResolvedValue([
      'Title: Demo',
      'PDF: /books/demo.pdf',
      'Pages: 2',
      '',
      '--- Page 1 ---',
      'Trang một',
      '',
      '--- Page 2 ---',
      'Khi trời mưa, sóc lấy hạt dẻ.',
      '',
      ].join('\n')),
      stat: vi.fn().mockResolvedValue({ dev: 1n, ino: 2n, isFile: () => true }),
    };
    mocks.open.mockResolvedValue(fileHandle);

    const { readExtractedTextPage } = await import('./extractedTextDebug.js');

    await expect(readExtractedTextPage({ filePath: 'C:\\Temp\\debug.txt', dev: 1n, ino: 2n }, 2)).resolves.toBe(
      'Khi trời mưa, sóc lấy hạt dẻ.',
    );
    expect(fileHandle.readFile).toHaveBeenCalledWith('utf8');
    expect(fileHandle.close).toHaveBeenCalledOnce();
  });

  it('verifies the opened file identity before emptying it', async () => {
    const close = vi.fn().mockResolvedValue(undefined);
    const truncate = vi.fn().mockResolvedValue(undefined);
    mocks.open.mockResolvedValue({
      close,
      stat: vi.fn().mockResolvedValue({ dev: 1n, ino: 2n, isFile: () => true }),
      truncate,
    });

    const { emptyExtractedTextFile } = await import('./extractedTextDebug.js');

    await expect(emptyExtractedTextFile({ filePath: 'C:\\Temp\\debug.txt', dev: 1n, ino: 2n })).resolves.toBeUndefined();
    expect(mocks.open).toHaveBeenCalledWith('C:\\Temp\\debug.txt', expect.any(Number));
    expect(truncate).toHaveBeenCalledWith(0);
    expect(close).toHaveBeenCalledOnce();
  });

  it('does not truncate when the file is replaced after validation', async () => {
    const close = vi.fn().mockResolvedValue(undefined);
    const truncate = vi.fn().mockResolvedValue(undefined);
    mocks.open.mockResolvedValue({
      close,
      stat: vi.fn().mockResolvedValue({ dev: 1n, ino: 3n, isFile: () => true }),
      truncate,
    });

    const { emptyExtractedTextFile } = await import('./extractedTextDebug.js');

    await expect(
      emptyExtractedTextFile({ filePath: 'C:\\Temp\\debug.txt', dev: 1n, ino: 2n }),
    ).rejects.toThrow('Invalid extracted text file');
    expect(truncate).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledOnce();
  });

  it('rejects a symbolic-link read path', async () => {
    mocks.lstat.mockResolvedValue({ isSymbolicLink: () => true });

    const { validateExtractedTextFile } = await import('./extractedTextDebug.js');

    await expect(
      validateExtractedTextFile('/user-data', '/user-data/extracted-text/debug.txt'),
    ).rejects.toThrow('Invalid extracted text file');
  });

  it('rejects a read path whose canonical parent is outside extracted-text', async () => {
    mocks.lstat.mockResolvedValue({ isFile: () => true, isSymbolicLink: () => false });
    mocks.realpath
      .mockResolvedValueOnce('/user-data/extracted-text')
      .mockResolvedValueOnce('/outside/debug.txt');

    const { validateExtractedTextFile } = await import('./extractedTextDebug.js');

    await expect(
      validateExtractedTextFile('/user-data', '/user-data/extracted-text/debug.txt'),
    ).rejects.toThrow('Invalid extracted text file');
  });
});
