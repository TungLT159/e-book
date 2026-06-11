/// <reference types="node" />

import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InteractivePdfFlipbook } from './InteractivePdfFlipbook';
import { sanitizeNarrationText } from '../utils/narration';

const flipNext = vi.fn();
const flipPrev = vi.fn();
const flipTo = vi.fn();
const synthesize = vi.fn(async () => new Uint8Array([1, 2, 3]).buffer);
const writeExtractedText = vi.fn(async () => 'C:\\Temp\\flipbook-react-electron\\extracted-text\\demo.txt');
const readExtractedTextPage = vi.fn(async (_filePath: string, pageNumber: number): Promise<string> =>
  pageNumber === 1
    ? 'Nội dung đọc từ file text trang một'
    : pageNumber === 2
      ? 'Nội dung đọc từ file text trang hai'
      : `Nội dung đọc từ file text trang ${pageNumber}`,
);
const getVoices = vi.fn(async () => [
  { ShortName: 'vi-VN-HoaiMyNeural', FriendlyName: 'Hoài My', Locale: 'vi-VN' },
  { ShortName: 'vi-VN-NamMinhNeural', FriendlyName: 'Nam Minh', Locale: 'vi-VN' },
]);
const play = vi.fn(() => Promise.resolve());
const pause = vi.fn();
const load = vi.fn();

vi.mock('react-pageflip', () => ({
  default: React.forwardRef(
    ({ children, onFlip }: { children: React.ReactNode; onFlip?: (event: { data: number }) => void }, ref) => {
      React.useImperativeHandle(ref, () => ({
        pageFlip: () => ({
          flipNext: () => {
            flipNext();
            onFlip?.({ data: 1 });
          },
          flipPrev: () => {
            flipPrev();
            onFlip?.({ data: 0 });
          },
          flip: (pageIndex: number) => {
            flipTo(pageIndex);
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
        onLoadSuccess?.({ numPages: file.includes('multi-page-demo') ? 6 : 2 });
      }
    }, [file, onLoadSuccess]);

    return <div data-testid="mock-document">{children}</div>;
  },
  Page: ({ pageNumber }: { pageNumber: number }) => <div>PDF page {pageNumber}</div>,
}));

vi.mock('pdfjs-dist', () => ({
  getDocument: vi.fn(() => ({
    promise: Promise.resolve({
      numPages: 2,
      getPage: async (pageNumber: number) => ({
        getTextContent: async () => ({
          items: [
            { str: pageNumber === 1 ? 'Trang một' : 'Trang hai' },
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
    window.localStorage.clear();
    flipNext.mockClear();
    flipPrev.mockClear();
    flipTo.mockClear();
    synthesize.mockClear();
    writeExtractedText.mockClear();
    readExtractedTextPage.mockClear();
    getVoices.mockClear();
    play.mockClear();
    Object.defineProperty(window.HTMLMediaElement.prototype, 'play', {
      configurable: true,
      value: play,
    });
    pause.mockClear();
    load.mockClear();
    Object.defineProperty(window.HTMLMediaElement.prototype, 'pause', {
      configurable: true,
      value: pause,
    });
    Object.defineProperty(window.HTMLMediaElement.prototype, 'load', {
      configurable: true,
      value: load,
    });
    window.edgeTts = { synthesize, getVoices };
    window.debugTools = { writeExtractedText, readExtractedTextPage };
  });

  it('reads PDF text with Edge TTS and flips after narration ends', async () => {
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

    await act(async () => {
      vi.advanceTimersByTime(1500);
    });
    await act(async () => {
      vi.advanceTimersByTime(650);
    });
    await act(async () => undefined);
    await act(async () => undefined);

    expect(flipTo).toHaveBeenCalledWith(1);
    expect(synthesize).toHaveBeenLastCalledWith('Nội dung đọc từ file text trang hai', {
      voice: 'vi-VN-NamMinhNeural',
    });
  });

  it('waits for the page flip to settle before reading the next page', async () => {
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

    await act(async () => {
      vi.advanceTimersByTime(1500);
    });

    expect(flipTo).toHaveBeenCalledWith(1);
    expect(synthesize).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(650);
    });
    await act(async () => undefined);
    await act(async () => undefined);

    expect(synthesize).toHaveBeenLastCalledWith('Nội dung đọc từ file text trang hai', {
      voice: 'vi-VN-NamMinhNeural',
    });
  });

  it('does not restart narration when the visible page updates during playback', async () => {
    render(<InteractivePdfFlipbook title="Demo book" pdfPath="/books/demo.pdf" />);

    expect(await screen.findByText('PDF page 1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /mở menu điều khiển/i }));
    fireEvent.click(screen.getByRole('button', { name: /đọc tự động/i }));

    await waitFor(() =>
      expect(synthesize).toHaveBeenCalledWith('Nội dung đọc từ file text trang một', { voice: 'vi-VN-NamMinhNeural' }),
    );

    vi.useFakeTimers();

    fireEvent.click(screen.getByRole('button', { name: /^trang tiếp theo$/i }));

    await act(async () => {
      vi.advanceTimersByTime(650);
    });
    await act(async () => undefined);

    expect(synthesize).toHaveBeenCalledTimes(1);
  });

  it('lets the user choose narration voice and speed', async () => {
    render(<InteractivePdfFlipbook title="Demo book" pdfPath="/books/demo.pdf" />);

    expect(await screen.findByText('PDF page 1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /mở menu điều khiển/i }));
    fireEvent.click(screen.getByRole('button', { name: /cài đặt giọng đọc/i }));

    const voiceTrigger = await screen.findByRole('button', { name: /^Giọng đọc\b/ });
    fireEvent.click(voiceTrigger);
    fireEvent.click(screen.getByRole('option', { name: /^Nam Minh\b/ }));

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

  it('passes narration volume from persisted settings without a neutral speech rate', async () => {
    window.localStorage.setItem(
      'interactivePdfFlipbook:narrationSettings:v1',
      JSON.stringify({
        selectedVoice: 'vi-VN-NamMinhNeural',
        speechRate: 0,
        speechVolume: 15,
      }),
    );

    render(<InteractivePdfFlipbook title="Demo book" pdfPath="/books/demo.pdf" />);

    expect(await screen.findByText('PDF page 1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /mở menu điều khiển/i }));
    fireEvent.click(screen.getByRole('button', { name: /đọc tự động/i }));

    await waitFor(() =>
      expect(synthesize).toHaveBeenCalledWith('Nội dung đọc từ file text trang một', {
        voice: 'vi-VN-NamMinhNeural',
        volume: '+15%',
      }),
    );
  });

  it('disables the narration voice control while voices are loading', async () => {
    getVoices.mockImplementationOnce(() => new Promise(() => undefined));

    render(<InteractivePdfFlipbook title="Demo book" pdfPath="/books/demo.pdf" />);

    expect(await screen.findByText('PDF page 1')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /mở menu điều khiển/i }));
    fireEvent.click(screen.getByRole('button', { name: /cài đặt giọng đọc/i }));

    expect(screen.getByRole('button', { name: /^Giọng đọc\b/ })).toBeDisabled();
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

    expect(await screen.findByRole('status', { name: /trạng thái đọc tự động/i })).toHaveTextContent(
      'Đang tạo giọng đọc...',
    );

    await act(async () => {
      resolveSynthesize(new Uint8Array([1, 2, 3]).buffer);
    });

    await waitFor(() =>
      expect(screen.queryByRole('status', { name: /trạng thái đọc tự động/i })).not.toBeInTheDocument(),
    );
  });

  it('shows the loading bar while extracted text is still being prepared', async () => {
    let resolveWrite!: (path: string) => void;
    writeExtractedText.mockReturnValueOnce(new Promise<string>((resolve) => {
      resolveWrite = resolve;
    }));

    render(<InteractivePdfFlipbook title="Demo book" pdfPath="/books/demo.pdf" />);
    await screen.findByText('PDF page 1');

    fireEvent.click(screen.getByRole('button', { name: /mở menu điều khiển/i }));
    fireEvent.click(screen.getByRole('button', { name: /đọc tự động/i }));

    expect(screen.getByRole('status', { name: /trạng thái đọc tự động/i })).toHaveTextContent(
      'Đang tạo giọng đọc...',
    );
    expect(synthesize).not.toHaveBeenCalled();

    await act(async () => {
      resolveWrite('C:\\Temp\\flipbook-react-electron\\extracted-text\\demo.txt');
    });

    await waitFor(() => expect(synthesize).toHaveBeenCalledTimes(1));
  });

  it('resumes the pending page transition after pausing during the inter-page delay', async () => {
    render(<InteractivePdfFlipbook title="Demo book" pdfPath="/books/demo.pdf" />);

    expect(await screen.findByText('PDF page 1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /mở menu điều khiển/i }));
    fireEvent.click(screen.getByRole('button', { name: /đọc tự động/i }));

    await waitFor(() =>
      expect(synthesize).toHaveBeenCalledWith('Nội dung đọc từ file text trang một', { voice: 'vi-VN-NamMinhNeural' }),
    );
    expect(await screen.findByRole('button', { name: /tạm dừng đọc/i })).toBeInTheDocument();

    vi.useFakeTimers();
    const narrationAudio = screen.getByLabelText('Âm thanh đọc văn bản');
    act(() => {
      narrationAudio.dispatchEvent(new Event('ended'));
    });

    fireEvent.click(screen.getByRole('button', { name: /tạm dừng đọc/i }));

    await act(async () => {
      vi.advanceTimersByTime(1500 + 650);
    });
    await act(async () => undefined);

    expect(flipNext).not.toHaveBeenCalled();
    expect(synthesize).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /tiếp tục đọc/i }));
    expect(play).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500 + 650);
    });
    await act(async () => undefined);

    expect(flipTo).toHaveBeenCalledWith(1);
    expect(synthesize).toHaveBeenLastCalledWith('Nội dung đọc từ file text trang hai', {
      voice: 'vi-VN-NamMinhNeural',
    });
    expect(synthesize).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('continues narration when manual navigation occurs during the inter-page pause', async () => {
    render(<InteractivePdfFlipbook title="Demo book" pdfPath="/books/demo.pdf" />);

    expect(await screen.findByText('PDF page 1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /mở menu điều khiển/i }));
    fireEvent.click(screen.getByRole('button', { name: /đọc tự động/i }));

    await waitFor(() =>
      expect(synthesize).toHaveBeenCalledWith('Nội dung đọc từ file text trang một', { voice: 'vi-VN-NamMinhNeural' }),
    );

    vi.useFakeTimers();
    act(() => {
      screen.getByLabelText('Âm thanh đọc văn bản').dispatchEvent(new Event('ended'));
    });
    fireEvent.click(screen.getByRole('button', { name: /^trang tiếp theo$/i }));

    await act(async () => {
      vi.advanceTimersByTime(1500 + 650);
    });
    await act(async () => undefined);
    await act(async () => undefined);

    expect(synthesize).toHaveBeenLastCalledWith('Nội dung đọc từ file text trang hai', {
      voice: 'vi-VN-NamMinhNeural',
    });
  });

  it('directly flips automatic narration to its next page when the visible page is far away', async () => {
    render(<InteractivePdfFlipbook title="Demo book" pdfPath="/books/multi-page-demo.pdf" />);

    expect(await screen.findByText('PDF page 1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /mở menu điều khiển/i }));
    fireEvent.click(screen.getByRole('button', { name: /đọc tự động/i }));

    await waitFor(() =>
      expect(synthesize).toHaveBeenCalledWith('Nội dung đọc từ file text trang một', { voice: 'vi-VN-NamMinhNeural' }),
    );

    fireEvent.click(screen.getByRole('button', { name: /^trang cuối$/i }));
    await waitFor(() => expect(flipTo).toHaveBeenCalledWith(5));
    flipTo.mockClear();

    vi.useFakeTimers();
    act(() => {
      screen.getByLabelText('Âm thanh đọc văn bản').dispatchEvent(new Event('ended'));
    });

    await act(async () => {
      vi.advanceTimersByTime(1500);
    });

    expect(flipTo).toHaveBeenCalledWith(1);
    expect(synthesize).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(650);
    });
    await act(async () => undefined);
    await act(async () => undefined);

    expect(synthesize).toHaveBeenLastCalledWith('Nội dung đọc từ file text trang hai', {
      voice: 'vi-VN-NamMinhNeural',
    });
  });

  it('shows the auto-read bar as loading first, then playback controls after audio starts', async () => {
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

    expect(await screen.findByRole('status', { name: /trạng thái đọc tự động/i })).toHaveTextContent(
      'Đang tạo giọng đọc...',
    );
    expect(screen.queryByRole('button', { name: /tạm dừng đọc/i })).not.toBeInTheDocument();

    await waitFor(() => expect(synthesize).toHaveBeenCalledTimes(1));

    await act(async () => {
      resolveSynthesize(new Uint8Array([1, 2, 3]).buffer);
    });

    await waitFor(() => expect(play).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole('button', { name: /tạm dừng đọc/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /đọc trang tiếp theo/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /đọc trang trước/i })).toBeDisabled();
    expect(screen.queryByText('Đang tạo giọng đọc...')).not.toBeInTheDocument();
  });

  it('pauses and resumes the current narration from the auto-read bar', async () => {
    render(<InteractivePdfFlipbook title="Demo book" pdfPath="/books/demo.pdf" />);

    expect(await screen.findByText('PDF page 1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /mở menu điều khiển/i }));
    fireEvent.click(screen.getByRole('button', { name: /đọc tự động/i }));

    await waitFor(() =>
      expect(synthesize).toHaveBeenCalledWith('Nội dung đọc từ file text trang một', { voice: 'vi-VN-NamMinhNeural' }),
    );
    expect(await screen.findByRole('button', { name: /tạm dừng đọc/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /tạm dừng đọc/i }));
    expect(pause).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /tiếp tục đọc/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /tiếp tục đọc/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /tạm dừng đọc/i })).toBeInTheDocument());
    expect(play).toHaveBeenCalledTimes(2);
    expect(synthesize).toHaveBeenCalledTimes(1);
  });

  it('clears paused narration state when resuming playback fails', async () => {
    render(<InteractivePdfFlipbook title="Demo book" pdfPath="/books/demo.pdf" />);

    await screen.findByText('PDF page 1');
    fireEvent.click(screen.getByRole('button', { name: /mở menu điều khiển/i }));
    fireEvent.click(screen.getByRole('button', { name: /đọc tự động/i }));
    expect(await screen.findByRole('button', { name: /tạm dừng đọc/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /tạm dừng đọc/i }));
    play.mockRejectedValueOnce(new Error('resume failed'));
    fireEvent.click(screen.getByRole('button', { name: /tiếp tục đọc/i }));

    expect(await screen.findByText('Không thể phát Edge TTS.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /đọc tự động/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /đọc tự động/i }));
    expect(await screen.findByRole('button', { name: /tạm dừng đọc/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /tiếp tục đọc/i })).not.toBeInTheDocument();

    const narrationAudio = screen.getByLabelText('Âm thanh đọc văn bản');
    vi.useFakeTimers();
    fireEvent.ended(narrationAudio);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });

    expect(flipTo).toHaveBeenCalledWith(1);
  });

  it('ignores a stale resume rejection after narration restarts', async () => {
    let rejectResume!: (reason?: unknown) => void;
    const deferredResume = new Promise<void>((_resolve, reject) => {
      rejectResume = reject;
    });

    render(<InteractivePdfFlipbook title="Demo book" pdfPath="/books/demo.pdf" />);

    await screen.findByText('PDF page 1');
    fireEvent.click(screen.getByRole('button', { name: /mở menu điều khiển/i }));
    fireEvent.click(screen.getByRole('button', { name: /đọc tự động/i }));
    expect(await screen.findByRole('button', { name: /tạm dừng đọc/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /tạm dừng đọc/i }));
    play.mockReturnValueOnce(deferredResume);
    fireEvent.click(screen.getByRole('button', { name: /tiếp tục đọc/i }));

    fireEvent.click(screen.getByRole('button', { name: /^dừng đọc$/i }));
    fireEvent.click(screen.getByRole('button', { name: /đọc tự động/i }));
    expect(await screen.findByRole('button', { name: /tạm dừng đọc/i })).toBeInTheDocument();

    await act(async () => {
      rejectResume(new Error('stale resume failed'));
      await deferredResume.catch(() => undefined);
    });

    expect(screen.queryByText('Không thể phát Edge TTS.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /tạm dừng đọc/i })).toBeInTheDocument();
  });

  it('ignores a pending resume rejection after narration stops', async () => {
    let rejectResume!: (reason?: unknown) => void;
    const deferredResume = new Promise<void>((_resolve, reject) => {
      rejectResume = reject;
    });

    render(<InteractivePdfFlipbook title="Demo book" pdfPath="/books/demo.pdf" />);

    await screen.findByText('PDF page 1');
    fireEvent.click(screen.getByRole('button', { name: /mở menu điều khiển/i }));
    fireEvent.click(screen.getByRole('button', { name: /đọc tự động/i }));
    expect(await screen.findByRole('button', { name: /tạm dừng đọc/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /tạm dừng đọc/i }));
    play.mockReturnValueOnce(deferredResume);
    fireEvent.click(screen.getByRole('button', { name: /tiếp tục đọc/i }));
    fireEvent.click(screen.getByRole('button', { name: /^dừng đọc$/i }));

    await act(async () => {
      rejectResume(new Error('stale resume failed'));
      await deferredResume.catch(() => undefined);
    });

    expect(screen.queryByText('Không thể phát Edge TTS.')).not.toBeInTheDocument();
    expect(screen.queryByRole('status', { name: /trạng thái đọc tự động/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /đọc tự động/i })).toBeInTheDocument();
  });

  it('clears paused narration state after an audio error disables auto-read', async () => {
    render(<InteractivePdfFlipbook title="Demo book" pdfPath="/books/demo.pdf" />);

    await screen.findByText('PDF page 1');
    fireEvent.click(screen.getByRole('button', { name: /mở menu điều khiển/i }));
    fireEvent.click(screen.getByRole('button', { name: /đọc tự động/i }));

    await waitFor(() => expect(play).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: /tạm dừng đọc/i }));

    const narrationAudio = screen.getByLabelText('Âm thanh đọc văn bản');
    fireEvent.error(narrationAudio);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /đọc tự động/i })).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole('button', { name: /đọc tự động/i }));
    await waitFor(() => expect(play).toHaveBeenCalledTimes(2));
    vi.useFakeTimers();
    fireEvent.ended(narrationAudio);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });

    expect(flipTo).toHaveBeenCalledWith(1);
  });

  it('reads the next page when Next is clicked in the auto-read bar', async () => {
    render(<InteractivePdfFlipbook title="Demo book" pdfPath="/books/demo.pdf" />);

    expect(await screen.findByText('PDF page 1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /mở menu điều khiển/i }));
    fireEvent.click(screen.getByRole('button', { name: /đọc tự động/i }));

    await waitFor(() =>
      expect(synthesize).toHaveBeenCalledWith('Nội dung đọc từ file text trang một', { voice: 'vi-VN-NamMinhNeural' }),
    );

    fireEvent.click(await screen.findByRole('button', { name: /đọc trang tiếp theo/i }));

    await waitFor(() => expect(flipTo).toHaveBeenCalledWith(1));
    await waitFor(() =>
      expect(synthesize).toHaveBeenLastCalledWith('Nội dung đọc từ file text trang hai', {
        voice: 'vi-VN-NamMinhNeural',
      }),
    );
  });

  it('reads the previous page when Prev is clicked in the auto-read bar', async () => {
    render(<InteractivePdfFlipbook title="Demo book" pdfPath="/books/demo.pdf" />);

    expect(await screen.findByText('PDF page 1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^trang tiếp theo$/i }));

    await waitFor(() => expect(flipNext).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(
        screen.getByText((_content, element) =>
          Boolean(element?.classList.contains('interactive-reader__status') && element.textContent === 'Trang 2 / 2'),
        ),
      ).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole('button', { name: /mở menu điều khiển/i }));
    fireEvent.click(screen.getByRole('button', { name: /đọc tự động/i }));

    await waitFor(() =>
      expect(synthesize).toHaveBeenCalledWith('Nội dung đọc từ file text trang hai', { voice: 'vi-VN-NamMinhNeural' }),
    );

    fireEvent.click(await screen.findByRole('button', { name: /đọc trang trước/i }));

    await waitFor(() => expect(flipTo).toHaveBeenCalledWith(0));
    await waitFor(() =>
      expect(synthesize).toHaveBeenLastCalledWith('Nội dung đọc từ file text trang một', {
        voice: 'vi-VN-NamMinhNeural',
      }),
    );
  });

  it('directly flips to the next narration page when the visible page is far away', async () => {
    render(<InteractivePdfFlipbook title="Demo book" pdfPath="/books/multi-page-demo.pdf" />);

    expect(await screen.findByText('PDF page 1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /mở menu điều khiển/i }));
    fireEvent.click(screen.getByRole('button', { name: /đọc tự động/i }));

    await waitFor(() =>
      expect(synthesize).toHaveBeenCalledWith('Nội dung đọc từ file text trang một', { voice: 'vi-VN-NamMinhNeural' }),
    );

    fireEvent.click(screen.getByRole('button', { name: /^trang cuối$/i }));

    await waitFor(() => expect(flipTo).toHaveBeenCalledWith(5));
    await waitFor(() =>
      expect(
        screen.getByText((_content, element) =>
          Boolean(element?.classList.contains('interactive-reader__status') && element.textContent === 'Trang 6 / 6'),
        ),
      ).toBeInTheDocument(),
    );
    flipTo.mockClear();

    fireEvent.click(await screen.findByRole('button', { name: /đọc trang tiếp theo/i }));

    await waitFor(() => expect(flipTo).toHaveBeenCalledWith(1));
    await waitFor(() =>
      expect(synthesize).toHaveBeenLastCalledWith('Nội dung đọc từ file text trang hai', {
        voice: 'vi-VN-NamMinhNeural',
      }),
    );
  });

  it('removes invalid surrogate characters before narration', () => {
    expect(sanitizeNarrationText('Trang \udc9d một\n  nội dung')).toBe('Trang một nội dung');
  });
});
