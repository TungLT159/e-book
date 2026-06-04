/// <reference types="node" />

import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InteractivePdfFlipbook, sanitizeNarrationText } from './InteractivePdfFlipbook';

const flipNext = vi.fn();
const synthesize = vi.fn(async () => new Uint8Array([1, 2, 3]).buffer);
const getVoices = vi.fn(async () => [
  { ShortName: 'vi-VN-HoaiMyNeural', FriendlyName: 'Hoài My', Locale: 'vi-VN' },
  { ShortName: 'vi-VN-NamMinhNeural', FriendlyName: 'Nam Minh', Locale: 'vi-VN' },
]);
const play = vi.fn(() => Promise.resolve());

vi.mock('react-pageflip', () => ({
  default: React.forwardRef(
    ({ children, onFlip }: { children: React.ReactNode; onFlip?: (event: { data: number }) => void }, ref) => {
      React.useImperativeHandle(ref, () => ({
        pageFlip: () => ({
          flipNext: () => {
            flipNext();
            onFlip?.({ data: 1 });
          },
          flipPrev: () => undefined,
          flip: () => undefined,
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
        onLoadSuccess?.({ numPages: 2 });
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
    flipNext.mockClear();
    synthesize.mockClear();
    getVoices.mockClear();
    play.mockClear();
    Object.defineProperty(window.HTMLMediaElement.prototype, 'play', {
      configurable: true,
      value: play,
    });
    window.edgeTts = { synthesize, getVoices };
  });

  it('reads PDF text with Edge TTS and flips after narration ends', async () => {
    render(<InteractivePdfFlipbook title="Demo book" pdfPath="/books/demo.pdf" />);

    expect(await screen.findByText('PDF page 1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /mở menu điều khiển/i }));
    fireEvent.click(screen.getByRole('button', { name: /đọc tự động/i }));

    await waitFor(() =>
      expect(synthesize).toHaveBeenCalledWith('Trang một nội dung mở đầu', { voice: 'vi-VN-HoaiMyNeural' }),
    );
    expect(play).toHaveBeenCalledTimes(1);

    const narrationAudio = screen.getByLabelText('Âm thanh đọc văn bản');
    act(() => {
      narrationAudio.dispatchEvent(new Event('ended'));
    });

    expect(flipNext).toHaveBeenCalledTimes(1);

    await waitFor(() =>
      expect(synthesize).toHaveBeenLastCalledWith('Trang hai nội dung tiếp theo', {
        voice: 'vi-VN-HoaiMyNeural',
      }),
    );
  });

  it('lets the user choose narration voice and speed', async () => {
    render(<InteractivePdfFlipbook title="Demo book" pdfPath="/books/demo.pdf" />);

    expect(await screen.findByText('PDF page 1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /mở menu điều khiển/i }));

    const voiceSelect = await screen.findByLabelText('Giọng đọc');
    fireEvent.change(voiceSelect, { target: { value: 'vi-VN-NamMinhNeural' } });

    const speedSlider = screen.getByLabelText('Tốc độ đọc');
    fireEvent.change(speedSlider, { target: { value: '25' } });

    fireEvent.click(screen.getByRole('button', { name: /đọc tự động/i }));

    await waitFor(() =>
      expect(synthesize).toHaveBeenCalledWith('Trang một nội dung mở đầu', {
        voice: 'vi-VN-NamMinhNeural',
        rate: '+25%',
      }),
    );
  });

  it('removes invalid surrogate characters before narration', () => {
    expect(sanitizeNarrationText('Trang \udc9d một\n  nội dung')).toBe('Trang một nội dung');
  });
});
