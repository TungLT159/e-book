/// <reference types="node" />

import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDocument } from 'pdfjs-dist';
import {
  InteractivePdfFlipbook,
  normalizeNarrationAudioData,
  sanitizeNarrationText,
  textContentItemsToNarrationText,
} from './InteractivePdfFlipbook';

const flipNext = vi.fn();
let mockPdfPageCount = 2;
const synthesize = vi.fn(async () => new Uint8Array([1, 2, 3]).buffer);
const writeExtractedText = vi.fn(async () => 'C:\\Temp\\flipbook-react-electron\\extracted-text\\demo.txt');
const readExtractedTextPage = vi.fn(async (_filePath: string, pageNumber: number): Promise<string> =>
  `Nội dung đọc từ file text trang ${pageNumber}`,
);
const emptyExtractedTextFile = vi.fn(async () => undefined);
const getVoices = vi.fn(async () => [
  { ShortName: 'vi-VN-HoaiMyNeural', FriendlyName: 'Hoài My', Locale: 'vi-VN' },
  { ShortName: 'vi-VN-NamMinhNeural', FriendlyName: 'Nam Minh', Locale: 'vi-VN' },
  { ShortName: 'en-US-JennyNeural', FriendlyName: 'Jenny', Locale: 'en-US' },
]);
const play = vi.fn(() => Promise.resolve());

async function advanceNarrationPagePause() {
  await act(async () => {
    vi.advanceTimersByTime(1500);
  });
}

async function flushNarrationWork() {
  await act(async () => undefined);
  await act(async () => undefined);
  await act(async () => undefined);
}

async function advanceFlipSettledTimer() {
  await act(async () => {
    vi.advanceTimersByTime(650);
  });
}

function discardPendingFakeTimers() {
  vi.clearAllTimers();
  vi.useRealTimers();
}

vi.mock('react-pageflip', () => ({
  default: React.forwardRef(
    ({ children, onFlip }: { children: React.ReactNode; onFlip?: (event: { data: number }) => void }, ref) => {
      const currentPageIndexRef = React.useRef(0);

      React.useImperativeHandle(ref, () => ({
        pageFlip: () => ({
          flipNext: () => {
            flipNext();
            const nextPageIndex = currentPageIndexRef.current === 0
              ? 1
              : Math.min(currentPageIndexRef.current + 2, mockPdfPageCount - 1);
            currentPageIndexRef.current = nextPageIndex;
            onFlip?.({ data: nextPageIndex });
          },
          flipPrev: () => undefined,
          flip: (pageIndex: number) => {
            currentPageIndexRef.current = pageIndex;
            onFlip?.({ data: pageIndex });
          },
        }),
      }));

      return <div>{children}</div>;
    },
  ),
}));

vi.mock('react-pdf', () => ({
  pdfjs: { GlobalWorkerOptions: { workerSrc: '' } },
  Document: ({ children, file, onLoadSuccess }: { children: React.ReactNode; file?: string; onLoadSuccess?: (pdf: { numPages: number }) => void }) => {
    React.useEffect(() => {
      if (file) {
        onLoadSuccess?.({ numPages: mockPdfPageCount });
      }
    }, [file, onLoadSuccess]);

    return <div data-testid="mock-document">{children}</div>;
  },
  Page: ({ pageNumber }: { pageNumber: number }) => <div>PDF page {pageNumber}</div>,
}));

vi.mock('pdfjs-dist', () => ({
  getDocument: vi.fn(() => ({
    promise: Promise.resolve({
      numPages: mockPdfPageCount,
      getPage: async (pageNumber: number) => ({
        getTextContent: async () => ({
          items: [
            { str: pageNumber === 1 ? 'Trang một' : 'Trang hai', hasEOL: true },
            { str: pageNumber === 1 ? 'nội dung mở đầu' : 'nội dung tiếp theo' },
          ],
        }),
      }),
    }),
  })),
  GlobalWorkerOptions: { workerSrc: '' },
}));

describe('InteractivePdfFlipbook narration', () => {
  beforeEach(() => {
    vi.useRealTimers();
    mockPdfPageCount = 2;
    flipNext.mockClear();
    synthesize.mockClear();
    writeExtractedText.mockClear();
    readExtractedTextPage.mockClear();
    emptyExtractedTextFile.mockClear();
    getVoices.mockClear();
    play.mockClear();
    vi.mocked(getDocument).mockClear();
    Object.defineProperty(window.HTMLMediaElement.prototype, 'play', {
      configurable: true,
      value: play,
    });
    window.edgeTts = { synthesize, getVoices };
    window.audioCache = undefined;
    window.debugTools = { writeExtractedText, readExtractedTextPage, emptyExtractedTextFile };
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('reads PDF text with Edge TTS and flips after narration ends', async () => {
    readExtractedTextPage.mockImplementation(async (_filePath: string, pageNumber: number) =>
      pageNumber === 1 ? 'Nội dung đọc từ file text trang một' : 'Nội dung đọc từ file text trang hai',
    );

    render(<InteractivePdfFlipbook title="Demo book" pdfPath="/books/demo.pdf" />);

    expect(await screen.findByText('PDF page 1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /mở menu điều khiển/i }));
    fireEvent.click(screen.getByRole('button', { name: /đọc tự động/i }));

    await waitFor(() =>
      expect(synthesize).toHaveBeenCalledWith('Nội dung đọc từ file text trang một', { voice: 'vi-VN-NamMinhNeural' }),
    );
    expect(play).toHaveBeenCalledTimes(1);

    vi.useFakeTimers();
    const narrationAudio = screen.getByLabelText('Âm thanh đọc văn bản');
    act(() => {
      narrationAudio.dispatchEvent(new Event('ended'));
    });
    await advanceNarrationPagePause();
    await flushNarrationWork();

    expect(flipNext).toHaveBeenCalledTimes(1);
    expect(synthesize).toHaveBeenLastCalledWith('Nội dung đọc từ file text trang hai', {
      voice: 'vi-VN-NamMinhNeural',
    });
  });

  it('waits 1.5 seconds before starting the next page narration', async () => {
    readExtractedTextPage.mockImplementation(async (_filePath: string, pageNumber: number) =>
      pageNumber === 1 ? 'Nội dung đọc từ file text trang một' : 'Nội dung đọc từ file text trang hai',
    );

    render(<InteractivePdfFlipbook title="Demo book" pdfPath="/books/demo.pdf" />);

    expect(await screen.findByText('PDF page 1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /mở menu điều khiển/i }));
    fireEvent.click(screen.getByRole('button', { name: /đọc tự động/i }));

    await waitFor(() => expect(synthesize).toHaveBeenCalledTimes(1));

    vi.useFakeTimers();
    const narrationAudio = screen.getByLabelText('Âm thanh đọc văn bản');
    act(() => {
      narrationAudio.dispatchEvent(new Event('ended'));
    });

    expect(flipNext).not.toHaveBeenCalled();
    expect(readExtractedTextPage).not.toHaveBeenLastCalledWith(
      'C:\\Temp\\flipbook-react-electron\\extracted-text\\demo.txt',
      2,
    );
    expect(synthesize).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(1499);
    });
    expect(synthesize).toHaveBeenCalledTimes(1);
    expect(flipNext).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(1);
    });

    await act(async () => undefined);

    expect(readExtractedTextPage).toHaveBeenLastCalledWith(
      'C:\\Temp\\flipbook-react-electron\\extracted-text\\demo.txt',
      2,
    );
    expect(flipNext).toHaveBeenCalledTimes(1);
  });

  it('cancels a pending page pause when narration stops', async () => {
    readExtractedTextPage.mockImplementation(async (_filePath: string, pageNumber: number) =>
      pageNumber === 1 ? 'Nội dung đọc từ file text trang một' : 'Nội dung đọc từ file text trang hai',
    );

    render(<InteractivePdfFlipbook title="Demo book" pdfPath="/books/demo.pdf" />);

    expect(await screen.findByText('PDF page 1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /mở menu điều khiển/i }));
    fireEvent.click(screen.getByRole('button', { name: /đọc tự động/i }));
    await waitFor(() => expect(synthesize).toHaveBeenCalledTimes(1));

    vi.useFakeTimers();
    const narrationAudio = screen.getByLabelText('Âm thanh đọc văn bản');
    act(() => {
      narrationAudio.dispatchEvent(new Event('ended'));
    });

    fireEvent.click(screen.getByRole('button', { name: /dừng đọc/i }));

    await advanceNarrationPagePause();

    expect(readExtractedTextPage).not.toHaveBeenLastCalledWith(
      'C:\\Temp\\flipbook-react-electron\\extracted-text\\demo.txt',
      2,
    );
    expect(flipNext).not.toHaveBeenCalled();
  });

  it('reads both visible spread pages before flipping to the next spread', async () => {
    mockPdfPageCount = 5;

    render(<InteractivePdfFlipbook title="Demo book" pdfPath="/books/demo.pdf" />);

    expect(await screen.findByText('PDF page 1')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /trang tiếp theo/i }));
    await waitFor(() => expect(screen.getByText('Trang 2 / 5')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /mở menu điều khiển/i }));
    fireEvent.click(screen.getByRole('button', { name: /đọc tự động/i }));

    await waitFor(() =>
      expect(readExtractedTextPage).toHaveBeenLastCalledWith(
        'C:\\Temp\\flipbook-react-electron\\extracted-text\\demo.txt',
        2,
      ),
    );

    flipNext.mockClear();
    vi.useFakeTimers();
    const narrationAudio = screen.getByLabelText('Âm thanh đọc văn bản');
    act(() => {
      narrationAudio.dispatchEvent(new Event('ended'));
    });
    await advanceNarrationPagePause();
    await flushNarrationWork();

    expect(readExtractedTextPage).toHaveBeenLastCalledWith(
      'C:\\Temp\\flipbook-react-electron\\extracted-text\\demo.txt',
      3,
    );
    expect(flipNext).not.toHaveBeenCalled();
  });

  it('lets the user choose narration voice and speed', async () => {
    render(<InteractivePdfFlipbook title="Demo book" pdfPath="/books/demo.pdf" />);

    expect(await screen.findByText('PDF page 1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /mở menu điều khiển/i }));
    fireEvent.click(screen.getByRole('button', { name: /cài đặt tts/i }));

    const voiceSelect = await screen.findByLabelText('Giọng đọc');
    fireEvent.change(voiceSelect, { target: { value: 'vi-VN-NamMinhNeural' } });

    const speedSlider = screen.getByLabelText('Tốc độ đọc');
    fireEvent.change(speedSlider, { target: { value: '25' } });

    fireEvent.click(screen.getByRole('button', { name: /đọc tự động/i }));

    await waitFor(() =>
      expect(synthesize).toHaveBeenCalledWith('Nội dung đọc từ file text trang một', {
        voice: 'vi-VN-NamMinhNeural',
        rate: '+25%',
      }),
    );
  });

  it('only shows Vietnamese narration voices', async () => {
    render(<InteractivePdfFlipbook title="Demo book" pdfPath="/books/demo.pdf" />);

    expect(await screen.findByText('PDF page 1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /mở menu điều khiển/i }));
    fireEvent.click(screen.getByRole('button', { name: /cài đặt tts/i }));

    const voiceSelect = await screen.findByLabelText('Giọng đọc');
    const options = Array.from(voiceSelect.querySelectorAll('option')).map((option) => option.value);

    expect(options).toEqual(['vi-VN-NamMinhNeural', 'vi-VN-HoaiMyNeural']);
  });

  it('exports extracted PDF text when narration starts', async () => {
    render(<InteractivePdfFlipbook title="Demo book" pdfPath="/books/demo.pdf" />);

    expect(await screen.findByText('PDF page 1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /mở menu điều khiển/i }));
    fireEvent.click(screen.getByRole('button', { name: /đọc tự động/i }));

    await waitFor(() =>
      expect(writeExtractedText).toHaveBeenCalledWith({
        title: 'Demo book',
        pdfPath: '/books/demo.pdf',
        pages: ['Trang một nội dung mở đầu', 'Trang hai nội dung tiếp theo'],
      }),
    );
  });

  it('waits for the extracted text file write before reading or synthesizing', async () => {
    let resolveWrite: (filePath: string) => void = () => undefined;
    writeExtractedText.mockImplementationOnce(
      () => new Promise<string>((resolve) => {
        resolveWrite = resolve;
      }),
    );

    render(<InteractivePdfFlipbook title="Demo book" pdfPath="/books/demo.pdf" />);

    expect(await screen.findByText('PDF page 1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /mở menu điều khiển/i }));
    fireEvent.click(screen.getByRole('button', { name: /đọc tự động/i }));

    await waitFor(() => expect(writeExtractedText).toHaveBeenCalledTimes(1));
    expect(readExtractedTextPage).not.toHaveBeenCalled();
    expect(synthesize).not.toHaveBeenCalled();

    await act(async () => {
      resolveWrite('C:\\Temp\\flipbook-react-electron\\extracted-text\\demo.txt');
    });

    await waitFor(() =>
      expect(readExtractedTextPage).toHaveBeenCalledWith(
        'C:\\Temp\\flipbook-react-electron\\extracted-text\\demo.txt',
        1,
      ),
    );
    await waitFor(() => expect(synthesize).toHaveBeenCalledTimes(1));
  });

  it('uses the cached edge tts audio file when the cache hits', async () => {
    const getOrCreateEdgeTtsAudioCacheFile = vi.fn(async () => ({
      audioPath: 'C:\\Temp\\flipbook-cache\\chunk-1.mp3',
      audioUrl: 'file:///C:/Temp/flipbook-cache/chunk-1.mp3',
      cacheHit: true,
    }));

    window.audioCache = { getOrCreateEdgeTtsAudioCacheFile };

    render(<InteractivePdfFlipbook title="Demo book" pdfPath="/books/demo.pdf" />);

    expect(await screen.findByText('PDF page 1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /mở menu điều khiển/i }));
    fireEvent.click(screen.getByRole('button', { name: /đọc tự động/i }));

    await waitFor(() =>
      expect(getOrCreateEdgeTtsAudioCacheFile).toHaveBeenCalledWith(
        expect.objectContaining({
          bookKey: 'Demo book',
          voice: 'vi-VN-NamMinhNeural',
          rate: '',
          chunkIndex: 0,
          chunkText: 'Nội dung đọc từ file text trang một',
        }),
      ),
    );

    await waitFor(() => expect(play).toHaveBeenCalledTimes(1));
    expect(synthesize).not.toHaveBeenCalled();

    const narrationAudio = screen.getByLabelText('Âm thanh đọc văn bản');
    expect(narrationAudio.getAttribute('src')).toBe('file:///C:/Temp/flipbook-cache/chunk-1.mp3');
  });

  it('synthesizes and plays narration when the cache misses', async () => {
    const getOrCreateEdgeTtsAudioCacheFile = vi.fn(async () => ({
      audioPath: 'C:\\Temp\\flipbook-cache\\chunk-1.mp3',
      audioUrl: 'file:///C:/Temp/flipbook-cache/chunk-1.mp3',
      cacheHit: false,
    }));
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-audio');

    window.audioCache = { getOrCreateEdgeTtsAudioCacheFile };

    render(<InteractivePdfFlipbook title="Demo book" pdfPath="/books/demo.pdf" />);

    expect(await screen.findByText('PDF page 1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /mở menu điều khiển/i }));
    fireEvent.click(screen.getByRole('button', { name: /đọc tự động/i }));

    await waitFor(() =>
      expect(getOrCreateEdgeTtsAudioCacheFile).toHaveBeenCalledWith(
        expect.objectContaining({
          bookKey: 'Demo book',
          voice: 'vi-VN-NamMinhNeural',
          rate: '',
          chunkIndex: 0,
          chunkText: 'Nội dung đọc từ file text trang một',
        }),
      ),
    );

    await waitFor(() => expect(synthesize).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(play).toHaveBeenCalledTimes(1));

    const narrationAudio = screen.getByLabelText('Âm thanh đọc văn bản');
    expect(narrationAudio.getAttribute('src')).toBe('blob:mock-audio');

    createObjectURL.mockRestore();
  });

  it('preloads exactly one next narration page while current narration plays', async () => {
    mockPdfPageCount = 3;
    readExtractedTextPage.mockImplementation(async (_filePath: string, pageNumber: number) =>
      pageNumber === 1
        ? 'Nội dung đọc từ file text trang một'
        : pageNumber === 2
          ? 'Nội dung đọc từ file text trang hai'
          : 'Nội dung đọc từ file text trang ba',
    );
    const getOrCreateEdgeTtsAudioCacheFile = vi.fn(async () => ({
      audioPath: 'C:\\Temp\\flipbook-cache\\chunk-1.mp3',
      audioUrl: 'file:///C:/Temp/flipbook-cache/chunk-1.mp3',
      cacheHit: false,
    }));
    const preloadStartPlayCallCounts: number[] = [];
    const prepareEdgeTtsAudioCacheFile = vi.fn(async () => {
      preloadStartPlayCallCounts.push(play.mock.calls.length);

      return {
        audioPath: 'C:\\Temp\\flipbook-cache\\chunk-2.mp3',
        audioUrl: 'file:///C:/Temp/flipbook-cache/chunk-2.mp3',
        cacheHit: false,
      };
    });

    window.audioCache = { getOrCreateEdgeTtsAudioCacheFile, prepareEdgeTtsAudioCacheFile };

    render(<InteractivePdfFlipbook title="Demo book" pdfPath="/books/demo.pdf" />);

    expect(await screen.findByText('PDF page 1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /mở menu điều khiển/i }));
    fireEvent.click(screen.getByRole('button', { name: /đọc tự động/i }));

    await waitFor(() =>
      expect(prepareEdgeTtsAudioCacheFile).toHaveBeenCalledWith({
        bookKey: 'Demo book',
        voice: 'vi-VN-NamMinhNeural',
        rate: '',
        chunkIndex: 1,
        chunkText: 'Nội dung đọc từ file text trang hai',
      }),
    );
    expect(prepareEdgeTtsAudioCacheFile).toHaveBeenCalledTimes(1);
    expect(preloadStartPlayCallCounts).toEqual([1]);
  });

  it('keeps current narration playing and hides errors when next page preload fails', async () => {
    mockPdfPageCount = 3;
    readExtractedTextPage.mockImplementation(async (_filePath: string, pageNumber: number) =>
      pageNumber === 1
        ? 'Nội dung đọc từ file text trang một'
        : pageNumber === 2
          ? 'Nội dung đọc từ file text trang hai'
          : 'Nội dung đọc từ file text trang ba',
    );
    const getOrCreateEdgeTtsAudioCacheFile = vi.fn(async () => ({
      audioPath: 'C:\\Temp\\flipbook-cache\\chunk-1.mp3',
      audioUrl: 'file:///C:/Temp/flipbook-cache/chunk-1.mp3',
      cacheHit: false,
    }));
    const prepareEdgeTtsAudioCacheFile = vi.fn(async () => {
      throw new Error('Preload failed');
    });

    window.audioCache = { getOrCreateEdgeTtsAudioCacheFile, prepareEdgeTtsAudioCacheFile };

    render(<InteractivePdfFlipbook title="Demo book" pdfPath="/books/demo.pdf" />);

    expect(await screen.findByText('PDF page 1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /mở menu điều khiển/i }));
    fireEvent.click(screen.getByRole('button', { name: /đọc tự động/i }));

    await waitFor(() => expect(prepareEdgeTtsAudioCacheFile).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(synthesize).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(play).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('Preload failed')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /dừng đọc/i })).toBeInTheDocument();
  });

  it('shows the extracted text write error without reading or synthesizing', async () => {
    writeExtractedText.mockRejectedValueOnce(new Error('Cannot write narration file'));

    render(<InteractivePdfFlipbook title="Demo book" pdfPath="/books/demo.pdf" />);

    expect(await screen.findByText('PDF page 1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /mở menu điều khiển/i }));
    fireEvent.click(screen.getByRole('button', { name: /đọc tự động/i }));

    expect(await screen.findByText('Cannot write narration file')).toBeInTheDocument();
    expect(readExtractedTextPage).not.toHaveBeenCalled();
    expect(synthesize).not.toHaveBeenCalled();
  });

  it('ignores a pending narration start after rerendering to a different PDF', async () => {
    let resolveOldWrite: (filePath: string) => void = () => undefined;
    let resolveNewWrite: (filePath: string) => void = () => undefined;
    writeExtractedText.mockImplementationOnce(
      () => new Promise<string>((resolve) => {
        resolveOldWrite = resolve;
      }),
    );
    const { rerender } = render(
      <InteractivePdfFlipbook title="Old book" pdfPath="/books/old.pdf" />,
    );

    expect(await screen.findByText('PDF page 1')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /mở menu điều khiển/i }));
    fireEvent.click(screen.getByRole('button', { name: /đọc tự động/i }));
    await waitFor(() => expect(writeExtractedText).toHaveBeenCalledTimes(1));

    rerender(<InteractivePdfFlipbook title="New book" pdfPath="/books/new.pdf" />);
    await waitFor(() => expect(screen.getByRole('button', { name: /đọc tự động/i })).toBeEnabled());
    writeExtractedText.mockImplementationOnce(
      () => new Promise<string>((resolve) => {
        resolveNewWrite = resolve;
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: /đọc tự động/i }));
    await waitFor(() => expect(writeExtractedText).toHaveBeenCalledTimes(2));

    await act(async () => {
      resolveOldWrite('C:\\Temp\\old.txt');
    });

    expect(readExtractedTextPage).not.toHaveBeenCalled();
    expect(synthesize).not.toHaveBeenCalled();
    expect(screen.queryByText(/old/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /đọc tự động/i })).toBeDisabled();

    await act(async () => {
      resolveNewWrite('C:\\Temp\\new.txt');
    });
  });

  it('starts narration from page one after rerendering to a different PDF', async () => {
    const { rerender } = render(
      <InteractivePdfFlipbook title="Old book" pdfPath="/books/old.pdf" />,
    );

    expect(await screen.findByText('PDF page 1')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /trang tiếp theo/i }));
    await waitFor(() => expect(screen.getByText('Trang 2 / 2')).toBeInTheDocument());

    rerender(<InteractivePdfFlipbook title="New book" pdfPath="/books/new.pdf" />);
    fireEvent.click(screen.getByRole('button', { name: /mở menu điều khiển/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /đọc tự động/i })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: /đọc tự động/i }));

    await waitFor(() =>
      expect(readExtractedTextPage).toHaveBeenCalledWith(
        'C:\\Temp\\flipbook-react-electron\\extracted-text\\demo.txt',
        1,
      ),
    );
    expect(readExtractedTextPage).not.toHaveBeenCalledWith(
      'C:\\Temp\\flipbook-react-electron\\extracted-text\\demo.txt',
      2,
    );
  });

  it('clears narration memory and empties the generated file after final-page audio ends', async () => {
    render(<InteractivePdfFlipbook title="Demo book" pdfPath="/books/demo.pdf" />);

    expect(await screen.findByText('PDF page 1')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /mở menu điều khiển/i }));
    fireEvent.click(screen.getByRole('button', { name: /đọc tự động/i }));

    const narrationAudio = screen.getByLabelText('Âm thanh đọc văn bản');
    await waitFor(() => expect(synthesize).toHaveBeenCalledTimes(1));
    vi.useFakeTimers();
    act(() => narrationAudio.dispatchEvent(new Event('ended')));
    await advanceNarrationPagePause();
    await flushNarrationWork();
    expect(synthesize).toHaveBeenCalledTimes(2);
    await advanceFlipSettledTimer();
    vi.useRealTimers();
    act(() => narrationAudio.dispatchEvent(new Event('ended')));

    await waitFor(() =>
      expect(emptyExtractedTextFile).toHaveBeenCalledWith(
        'C:\\Temp\\flipbook-react-electron\\extracted-text\\demo.txt',
      ),
    );
    expect(screen.getByRole('button', { name: /đọc tự động/i })).toBeInTheDocument();
  });

  it('does not clear narration memory or empty the generated file when stopped early', async () => {
    render(<InteractivePdfFlipbook title="Demo book" pdfPath="/books/demo.pdf" />);

    expect(await screen.findByText('PDF page 1')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /mở menu điều khiển/i }));
    fireEvent.click(screen.getByRole('button', { name: /đọc tự động/i }));
    await waitFor(() => expect(synthesize).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: /dừng đọc/i }));

    expect(emptyExtractedTextFile).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /đọc tự động/i }));
    await waitFor(() => expect(writeExtractedText).toHaveBeenCalledTimes(2));
    expect(getDocument).toHaveBeenCalledTimes(1);
  });

  it('shows final cleanup errors and keeps narration disabled', async () => {
    emptyExtractedTextFile.mockRejectedValueOnce(new Error('Cannot empty narration file'));
    render(<InteractivePdfFlipbook title="Demo book" pdfPath="/books/demo.pdf" />);

    expect(await screen.findByText('PDF page 1')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /mở menu điều khiển/i }));
    fireEvent.click(screen.getByRole('button', { name: /đọc tự động/i }));

    const narrationAudio = screen.getByLabelText('Âm thanh đọc văn bản');
    await waitFor(() => expect(synthesize).toHaveBeenCalledTimes(1));
    vi.useFakeTimers();
    act(() => narrationAudio.dispatchEvent(new Event('ended')));
    await advanceNarrationPagePause();
    await flushNarrationWork();
    expect(synthesize).toHaveBeenCalledTimes(2);
    await advanceFlipSettledTimer();
    vi.useRealTimers();
    act(() => narrationAudio.dispatchEvent(new Event('ended')));

    expect(await screen.findByText('Cannot empty narration file')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /đọc tự động/i })).toBeInTheDocument();
  });

  it('ignores pending final cleanup after rerendering to a different PDF', async () => {
    let rejectOldCleanup: (error: Error) => void = () => undefined;
    let resolveNewWrite: (filePath: string) => void = () => undefined;
    emptyExtractedTextFile.mockImplementationOnce(
      () => new Promise<undefined>((_resolve, reject) => {
        rejectOldCleanup = reject;
      }),
    );
    const { rerender } = render(
      <InteractivePdfFlipbook title="Old book" pdfPath="/books/old.pdf" />,
    );

    expect(await screen.findByText('PDF page 1')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /mở menu điều khiển/i }));
    fireEvent.click(screen.getByRole('button', { name: /đọc tự động/i }));
    const narrationAudio = screen.getByLabelText('Âm thanh đọc văn bản');
    await waitFor(() => expect(synthesize).toHaveBeenCalledTimes(1));
    vi.useFakeTimers();
    act(() => narrationAudio.dispatchEvent(new Event('ended')));
    await advanceNarrationPagePause();
    await flushNarrationWork();
    expect(synthesize).toHaveBeenCalledTimes(2);
    act(() => narrationAudio.dispatchEvent(new Event('ended')));
    await flushNarrationWork();
    expect(emptyExtractedTextFile).toHaveBeenCalledTimes(1);
    discardPendingFakeTimers();

    rerender(<InteractivePdfFlipbook title="New book" pdfPath="/books/new.pdf" />);
    await waitFor(() => expect(screen.getByRole('button', { name: /đọc tự động/i })).toBeEnabled());
    writeExtractedText.mockImplementationOnce(
      () => new Promise<string>((resolve) => {
        resolveNewWrite = resolve;
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: /đọc tự động/i }));
    await waitFor(() => expect(writeExtractedText).toHaveBeenCalledTimes(2));

    await act(async () => {
      rejectOldCleanup(new Error('Old cleanup failed'));
    });

    expect(screen.queryByText('Old cleanup failed')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /đọc tự động/i })).toBeDisabled();

    await act(async () => {
      resolveNewWrite('C:\\Temp\\new.txt');
    });
  });

  it('re-extracts the PDF and creates a fresh file before replaying after final cleanup', async () => {
    render(<InteractivePdfFlipbook title="Demo book" pdfPath="/books/demo.pdf" />);

    expect(await screen.findByText('PDF page 1')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /mở menu điều khiển/i }));
    fireEvent.click(screen.getByRole('button', { name: /đọc tự động/i }));

    const narrationAudio = screen.getByLabelText('Âm thanh đọc văn bản');
    await waitFor(() => expect(synthesize).toHaveBeenCalledTimes(1));
    vi.useFakeTimers();
    act(() => narrationAudio.dispatchEvent(new Event('ended')));
    await advanceNarrationPagePause();
    await flushNarrationWork();
    expect(synthesize).toHaveBeenCalledTimes(2);
    act(() => narrationAudio.dispatchEvent(new Event('ended')));
    await flushNarrationWork();
    expect(emptyExtractedTextFile).toHaveBeenCalledTimes(1);
    discardPendingFakeTimers();

    const openMenuButton = screen.queryByRole('button', { name: /mở menu điều khiển/i });
    if (openMenuButton) {
      fireEvent.click(openMenuButton);
    }
    fireEvent.click(screen.getByRole('button', { name: /đọc tự động/i }));

    await waitFor(() => expect(getDocument).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(writeExtractedText).toHaveBeenCalledTimes(2));
    expect(writeExtractedText).toHaveBeenLastCalledWith({
      title: 'Demo book',
      pdfPath: '/books/demo.pdf',
      pages: ['Trang một nội dung mở đầu', 'Trang hai nội dung tiếp theo'],
    });
    await waitFor(() => expect(synthesize).toHaveBeenCalledTimes(3));
  });

  it('synthesizes narration from the exported text file page block', async () => {
    render(<InteractivePdfFlipbook title="Demo book" pdfPath="/books/demo.pdf" />);

    expect(await screen.findByText('PDF page 1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /mở menu điều khiển/i }));
    fireEvent.click(screen.getByRole('button', { name: /đọc tự động/i }));

    await waitFor(() =>
      expect(readExtractedTextPage).toHaveBeenCalledWith(
        'C:\\Temp\\flipbook-react-electron\\extracted-text\\demo.txt',
        1,
      ),
    );
    await waitFor(() =>
      expect(synthesize).toHaveBeenCalledWith('Nội dung đọc từ file text trang một', {
        voice: 'vi-VN-NamMinhNeural',
      }),
    );
  });

  it('shows the file read error without synthesizing narration', async () => {
    readExtractedTextPage.mockRejectedValueOnce(new Error('Cannot read narration file'));

    render(<InteractivePdfFlipbook title="Demo book" pdfPath="/books/demo.pdf" />);

    expect(await screen.findByText('PDF page 1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /mở menu điều khiển/i }));
    fireEvent.click(screen.getByRole('button', { name: /đọc tự động/i }));

    expect(await screen.findByText('Cannot read narration file')).toBeInTheDocument();
    expect(synthesize).not.toHaveBeenCalled();
  });

  it('shows an error without synthesizing when the file reader bridge is missing', async () => {
    window.debugTools = { writeExtractedText, emptyExtractedTextFile };

    render(<InteractivePdfFlipbook title="Demo book" pdfPath="/books/demo.pdf" />);

    expect(await screen.findByText('PDF page 1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /mở menu điều khiển/i }));
    fireEvent.click(screen.getByRole('button', { name: /đọc tự động/i }));

    expect(await screen.findByText('Không thể đọc file văn bản đã định dạng.')).toBeInTheDocument();
    expect(synthesize).not.toHaveBeenCalled();
  });

  it('advances without synthesizing when the extracted text page is empty', async () => {
    readExtractedTextPage.mockResolvedValueOnce(' \n\t ');

    render(<InteractivePdfFlipbook title="Demo book" pdfPath="/books/demo.pdf" />);

    expect(await screen.findByText('PDF page 1')).toBeInTheDocument();

    vi.useFakeTimers();
    fireEvent.click(screen.getByRole('button', { name: /mở menu điều khiển/i }));
    fireEvent.click(screen.getByRole('button', { name: /đọc tự động/i }));

    await act(async () => undefined);
    await act(async () => undefined);
    expect(readExtractedTextPage).toHaveBeenCalledWith(
      'C:\\Temp\\flipbook-react-electron\\extracted-text\\demo.txt',
      1,
    );
    await advanceNarrationPagePause();
    await flushNarrationWork();
    expect(flipNext).toHaveBeenCalledTimes(1);
    expect(synthesize).toHaveBeenCalledTimes(1);
    expect(synthesize).toHaveBeenCalledWith('Nội dung đọc từ file text trang hai', {
      voice: 'vi-VN-NamMinhNeural',
    });
  });

  it('removes invalid surrogate characters before narration', () => {
    expect(sanitizeNarrationText('Trang \udc9d một\n  nội dung')).toBe('Trang một nội dung');
  });

  it('normalizes decomposed Vietnamese combining marks before narration', () => {
    expect(sanitizeNarrationText('Bie\u0302\u0309u')).toBe('Biểu');
  });

  it('joins split Vietnamese PDF text items without inserting false spaces', () => {
    const pageItems = [
      { str: 'Khi tr', transform: [1, 0, 0, 1, 57, 108], width: 47 },
      { str: 'ờ', transform: [1, 0, 0, 1, 104, 108], width: 11 },
      { str: 'i mưa, sóc l', transform: [1, 0, 0, 1, 115, 108], width: 93 },
      { str: 'ấ', transform: [1, 0, 0, 1, 208, 108], width: 9 },
      { str: 'y m', transform: [1, 0, 0, 1, 217, 108], width: 31 },
      { str: 'ộ', transform: [1, 0, 0, 1, 247, 108], width: 10 },
      { str: 't ít h', transform: [1, 0, 0, 1, 257, 108], width: 37 },
      { str: 'ạ', transform: [1, 0, 0, 1, 294, 108], width: 9 },
      { str: 't d', transform: [1, 0, 0, 1, 303, 108], width: 21 },
      { str: 'ẻ', transform: [1, 0, 0, 1, 323, 108], width: 9 },
      { str: ' ', transform: [1, 0, 0, 1, 332, 108], width: 5 },
      { str: 'và', transform: [1, 0, 0, 1, 337, 108], width: 21 },
      { str: '', transform: [1, 0, 0, 1, 57, 85], width: 0, hasEOL: true },
      { str: 'nh', transform: [1, 0, 0, 1, 57, 85], width: 20 },
      { str: 'ữ', transform: [1, 0, 0, 1, 77, 85], width: 11 },
      { str: 'ng th', transform: [1, 0, 0, 1, 88, 85], width: 41 },
      { str: 'ứ', transform: [1, 0, 0, 1, 128, 85], width: 11 },
      { str: ' ', transform: [1, 0, 0, 1, 139, 85], width: 5 },
      { str: 'khác.', transform: [1, 0, 0, 1, 144, 85], width: 43 },
    ];

    expect(textContentItemsToNarrationText(pageItems)).toBe(
      'Khi trời mưa, sóc lấy một ít hạt dẻ và những thứ khác.',
    );
  });

  it('does not insert spaces between adjacent character items with missing widths', () => {
    const pageItems = [
      { str: 'K', transform: [1, 0, 0, 1, 57, 108], width: 0 },
      { str: 'h', transform: [1, 0, 0, 1, 66, 108], width: 0 },
      { str: 'i', transform: [1, 0, 0, 1, 75, 108], width: 0 },
      { str: ' ', transform: [1, 0, 0, 1, 84, 108], width: 5 },
      { str: 'tr', transform: [1, 0, 0, 1, 91, 108], width: 0 },
      { str: 'ờ', transform: [1, 0, 0, 1, 104, 108], width: 0 },
      { str: 'i', transform: [1, 0, 0, 1, 115, 108], width: 0 },
      { str: ' ', transform: [1, 0, 0, 1, 124, 108], width: 5 },
      { str: 'm', transform: [1, 0, 0, 1, 131, 108], width: 0 },
      { str: 'ư', transform: [1, 0, 0, 1, 142, 108], width: 0 },
      { str: 'a', transform: [1, 0, 0, 1, 153, 108], width: 0 },
    ];

    expect(textContentItemsToNarrationText(pageItems)).toBe('Khi trời mưa');
  });

  it('does not infer spaces from unstable PDF item coordinates', () => {
    const pageItems = [
      { str: 'Khi tr', transform: [20, 0, 0, 20, 57, 108], width: 47 },
      { str: 'ờ', transform: [20, 0, 0, 20, 110, 108], width: 11 },
      { str: 'i mưa, sóc l', transform: [20, 0, 0, 20, 127, 108], width: 93 },
      { str: 'ấ', transform: [20, 0, 0, 20, 226, 108], width: 9 },
      { str: 'y', transform: [20, 0, 0, 20, 241, 108], width: 10 },
    ];

    expect(textContentItemsToNarrationText(pageItems)).toBe('Khi trời mưa, sóc lấy');
  });

  it('removes leading page numbers before narration text', () => {
    expect(textContentItemsToNarrationText([{ str: '5Tâm Đầu Ý Hợp' }])).toBe(
      'Tâm Đầu Ý Hợp',
    );
    expect(textContentItemsToNarrationText([{ str: '5 Tâm Đầu Ý Hợp' }])).toBe(
      'Tâm Đầu Ý Hợp',
    );
  });

  it('shows when narration audio is being synthesized', async () => {
    let resolveSynthesize: (audio: ArrayBuffer) => void = () => undefined;
    synthesize.mockImplementationOnce(
      () => new Promise<ArrayBuffer>((resolve) => {
        resolveSynthesize = resolve;
      }),
    );

    render(<InteractivePdfFlipbook title="Demo book" pdfPath="/books/demo.pdf" />);

    expect(await screen.findByText('PDF page 1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /mở menu điều khiển/i }));
    fireEvent.click(screen.getByRole('button', { name: /đọc tự động/i }));

    expect(await screen.findByText('Đang tạo giọng đọc...')).toBeInTheDocument();

    await act(async () => {
      resolveSynthesize(new Uint8Array([1, 2, 3]).buffer);
    });

    await waitFor(() =>
      expect(screen.queryByText('Đang tạo giọng đọc...')).not.toBeInTheDocument(),
    );
  });

  it('normalizes Electron IPC buffer-like audio payloads', () => {
    expect(normalizeNarrationAudioData({ 0: 1, 1: 2, 2: 3 })).toEqual(new Uint8Array([1, 2, 3]).buffer);
    expect(normalizeNarrationAudioData({ type: 'Buffer', data: [4, 5, 6] })).toEqual(
      new Uint8Array([4, 5, 6]).buffer,
    );
  });
});
